import "server-only";
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * This app's own Google OAuth flow (§7).
 *
 * Until now Google sign-in went through Supabase's hosted flow:
 * signInWithOAuth() redirected to Supabase, Supabase to Google, and back via
 * Supabase's own callback. That put two things outside our control that have
 * both broken sign-in in production before — Supabase's redirect-URL
 * allow-list, and which Google app the consent screen belonged to.
 *
 * Here the app runs the dance itself with the college's own OAuth client, and
 * Supabase is handed only the finished, verified Google identity
 * (signInWithIdToken). That is deliberately where the line sits: Supabase still
 * ISSUES the session, so auth.uid() and all 83 RLS policies keep working
 * untouched. We own the OAuth, not the crypto — the project moved to ECC JWT
 * signing, and minting our own tokens is both impossible and the wrong thing to
 * be responsible for.
 *
 * `server-only`: GOOGLE_CLIENT_SECRET must never reach the client bundle.
 */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
/** Google issues with either form; both are legitimate. */
const VALID_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

export const isGoogleOAuthConfigured = Boolean(clientId && clientSecret);

/**
 * The redirect URI is FIXED to the default locale rather than following the
 * viewer's language.
 *
 * Google matches redirect_uri exactly, so a per-locale path would mean
 * registering two URLs per domain and would silently break sign-in the day a
 * third locale is added. The viewer's actual locale rides in the state cookie
 * instead, and the callback redirects there at the end.
 */
export function googleRedirectUri(origin: string): string {
  return `${origin}/th/auth/google/callback`;
}

/** Cookie names for the three values that must survive the round trip. */
export const OAUTH_STATE_COOKIE = "g_state";
export const OAUTH_NONCE_COOKIE = "g_nonce";
export const OAUTH_VERIFIER_COOKIE = "g_verifier";
export const OAUTH_LANG_COOKIE = "g_lang";
/** Long enough to read a consent screen, short enough not to linger. */
export const OAUTH_COOKIE_MAX_AGE_S = 10 * 60;

export function randomUrlSafe(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** PKCE S256 challenge for a verifier. */
export function codeChallengeFor(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthorizeUrl(options: {
  origin: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(options.origin),
    response_type: "code",
    scope: "openid email profile",
    state: options.state,
    nonce: options.nonce,
    code_challenge: codeChallengeFor(options.codeVerifier),
    code_challenge_method: "S256",
    // A hint to the account picker only — Google does NOT enforce it, and a
    // user can pick any account. The real domain check happens in
    // verifyGoogleIdToken below, server-side, before any row is touched.
    hd: "udontech.ac.th",
    // Without this, a browser already signed in to one Google account skips
    // the picker entirely, which is confusing on a shared machine.
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchanges the one-time code for Google's ID token. Null on any failure. */
export async function exchangeCodeForIdToken(options: {
  code: string;
  codeVerifier: string;
  origin: string;
}): Promise<string | null> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: options.code,
        code_verifier: options.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: googleRedirectUri(options.origin),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      // Google's error body names the cause (redirect_uri_mismatch,
      // invalid_grant on a replayed code, invalid_client on a bad secret) and
      // is worth logging — none of it is sensitive.
      console.error("[google-oauth] token exchange failed:", response.status, await response.text());
      return null;
    }

    const payload = (await response.json()) as { id_token?: string };
    return payload.id_token ?? null;
  } catch (error) {
    console.error("[google-oauth] token exchange error:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Cached across requests — Google's keys rotate slowly and jose handles it. */
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export type GoogleIdentity = {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

/**
 * Verifies Google's ID token and enforces the college-domain rule.
 *
 * This is the security boundary of the whole flow, so every check is explicit:
 * signature against Google's JWKS, issuer, audience (our client id), expiry,
 * and the nonce WE generated — which is what stops a token obtained elsewhere
 * being replayed into our callback.
 *
 * The domain rule is enforced here rather than relying on `hd`, which is only a
 * UI hint. `email_verified` matters too: an unverified address on a Workspace
 * domain would otherwise be a way in.
 *
 * Returns null on any failure — a caller must not be able to tell which check
 * failed.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string
): Promise<GoogleIdentity | null> {
  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: VALID_ISSUERS,
      audience: clientId,
    });
    return checkGoogleClaims(payload, expectedNonce);
  } catch (error) {
    console.error("[google-oauth] id_token verification failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * The claim rules, split out from the signature check so they can be tested
 * exhaustively without a live Google.
 *
 * jwtVerify above covers signature, issuer, audience and expiry — the parts
 * only Google's keys can attest. Everything this app decides for itself is
 * here: the nonce that binds the token to one sign-in attempt, and the college
 * domain rule.
 */
export function checkGoogleClaims(
  payload: Record<string, unknown>,
  expectedNonce: string
): GoogleIdentity | null {
  // An empty expected nonce must never match an absent claim — that would make
  // a missing cookie silently equivalent to a passing check.
  if (!expectedNonce || payload.nonce !== expectedNonce) {
    console.error("[google-oauth] nonce mismatch");
    return null;
  }

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!email || payload.email_verified !== true) {
    console.error("[google-oauth] missing or unverified email");
    return null;
  }
  if (!email.endsWith("@udontech.ac.th")) {
    console.error("[google-oauth] rejected non-college address");
    return null;
  }

  return {
    email,
    fullName: typeof payload.name === "string" ? payload.name : null,
    avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
  };
}
