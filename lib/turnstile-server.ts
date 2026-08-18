import "server-only";

/**
 * Server-side Turnstile verification (§19).
 *
 * Until now this app never verified a captcha token at all. `readCaptchaToken`
 * in actions/auth.ts checked only that the field was non-empty and then handed
 * the token to Supabase, which did the real check as a project-level setting —
 * and once 0064 stopped calling resetPasswordForEmail, the token on the
 * password-link form was checked for presence and then thrown away. A POST
 * carrying `cf-turnstile-response=x` passed that gate.
 *
 * This module does the actual check, so the app no longer depends on Supabase
 * for it. That dependency was also the cause of a long trail of pain recorded
 * in CLAUDE.md: a project-level captcha applies to EVERY public auth endpoint,
 * which is why server-initiated calls were refused with "captcha protection:
 * request disallowed" and why /set-password had to exist as an interstitial.
 *
 * `server-only`: the secret must never reach the client bundle. The sitekey
 * half stays in lib/turnstile.ts, which is deliberately isomorphic.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const secret = process.env.TURNSTILE_SECRET_KEY ?? "";

/** Extra hostnames to accept, comma-separated. See the hostname note below. */
const extraHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export const isTurnstileSecretConfigured = secret.length > 0;

/** The shape Cloudflare documents. Only `success` is guaranteed present. */
type SiteverifyResponse = {
  success: boolean;
  hostname?: string;
  "error-codes"?: string[];
};

/**
 * True only if Cloudflare says this exact token was solved, once, for our
 * sitekey.
 *
 * FAILS CLOSED on anything unexpected — a non-200, malformed JSON, a network
 * error, a timeout. An unverifiable captcha must never become a way in, and
 * this runs in front of the endpoint that makes the server send mail.
 *
 * The one deliberate exception is a missing secret OUTSIDE production: the
 * sitekey is already optional in development (lib/turnstile.ts), so requiring
 * the secret there would break local sign-in for anyone who has not set one.
 * Production cannot reach that branch — lib/env-guard.ts fails the build when
 * TURNSTILE_SECRET_KEY is unset, and this logs loudly regardless.
 *
 * A token is single-use at Cloudflare. Calling this twice for the same token
 * returns false the second time, so it must be called exactly once per
 * submission, and the token must NOT also be forwarded to Supabase.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  options: { remoteIp?: string | null; expectedHostname?: string | null } = {}
): Promise<boolean> {
  if (!token) return false;

  if (!isTurnstileSecretConfigured) {
    if (process.env.NODE_ENV === "production") {
      console.error("[turnstile] TURNSTILE_SECRET_KEY is not set — refusing to accept the token.");
      return false;
    }
    console.warn("[turnstile] no TURNSTILE_SECRET_KEY set; skipping verification (development only).");
    return true;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (options.remoteIp) body.set("remoteip", options.remoteIp);

  let payload: SiteverifyResponse;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      // Cloudflare is fast; a hung request must not hold a Server Action open.
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[turnstile] siteverify returned", response.status);
      return false;
    }

    payload = (await response.json()) as SiteverifyResponse;
  } catch (error) {
    console.error("[turnstile] siteverify failed:", error instanceof Error ? error.message : error);
    return false;
  }

  if (!payload.success) {
    // error-codes names the cause: invalid-input-response (bad/expired token),
    // timeout-or-duplicate (already spent — the double-verify trap above),
    // invalid-input-secret (wrong secret key).
    console.error("[turnstile] rejected:", payload["error-codes"]?.join(", ") ?? "no error-codes");
    return false;
  }

  // Hostname check — defence in depth, NOT the primary control.
  //
  // Cloudflare already refuses to render the widget on a hostname that is not
  // on the sitekey's own list (that is the 110200 error this project has hit
  // before), so a token cannot legitimately be solved elsewhere. This is a
  // second look at the same fact.
  //
  // It is deliberately compared against the CURRENT REQUEST's host rather than
  // a hardcoded list. This project has lost sign-in twice to a stale hostname
  // allow-list — once in Cloudflare, once in Supabase's redirect URLs — and a
  // third list that silently breaks login on a new domain is exactly the
  // mistake worth not repeating. Comparing to the live request host means a
  // new domain or a Vercel preview URL just works.
  const expected = options.expectedHostname?.toLowerCase();
  const actual = payload.hostname?.toLowerCase();
  if (expected && actual && actual !== expected && !extraHostnames.includes(actual)) {
    console.error(`[turnstile] hostname mismatch: solved on ${actual}, expected ${expected}`);
    return false;
  }

  return true;
}
