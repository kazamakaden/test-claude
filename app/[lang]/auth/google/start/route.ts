import { NextResponse, type NextRequest } from "next/server";
import {
  buildAuthorizeUrl,
  isGoogleOAuthConfigured,
  randomUrlSafe,
  OAUTH_COOKIE_MAX_AGE_S,
  OAUTH_LANG_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from "@/lib/google-oauth";
import { resolveConfiguredSiteUrl } from "@/lib/site-url";
import { isLocale, defaultLocale } from "@/lib/i18n/config";

/**
 * Starts this app's own Google sign-in.
 *
 * Runs alongside the existing Supabase-hosted flow rather than replacing it.
 * Sign-in is the highest-consequence path in the app and this environment
 * cannot reach Google or the deployed site to test it, so the working path
 * stays until this one is proven on a real browser. /login is unchanged.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : defaultLocale;

  if (!isGoogleOAuthConfigured) {
    console.error("[google-oauth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set.");
    return NextResponse.redirect(new URL(`/${lang}/login?error=oauthFailed`, request.url));
  }

  // Configured value only, never a request header. Google matches redirect_uri
  // exactly, so a poisoned Host would simply fail the exchange — but building
  // it from configuration keeps the failure at deploy time rather than at a
  // user's sign-in.
  const origin = resolveConfiguredSiteUrl() ?? request.nextUrl.origin;

  const state = randomUrlSafe();
  const nonce = randomUrlSafe();
  const codeVerifier = randomUrlSafe(64);

  const response = NextResponse.redirect(
    buildAuthorizeUrl({ origin, state, nonce, codeVerifier })
  );

  // All four are httpOnly: `state` is the CSRF defence, `nonce` is what binds
  // the returned id_token to THIS request, and the verifier is the PKCE
  // secret. None may be readable from JavaScript.
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: OAUTH_COOKIE_MAX_AGE_S,
    // Google returns to a fixed /th/... path regardless of the viewer's
    // locale, so these must be readable there — a locale-scoped path would
    // hide them from the callback.
    path: "/",
  };
  response.cookies.set(OAUTH_STATE_COOKIE, state, options);
  response.cookies.set(OAUTH_NONCE_COOKIE, nonce, options);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, codeVerifier, options);
  // Where to land at the end. The redirect_uri is fixed to the default locale,
  // so without this a Thai user starting from /en would come back into Thai.
  response.cookies.set(OAUTH_LANG_COOKIE, lang, options);

  return response;
}
