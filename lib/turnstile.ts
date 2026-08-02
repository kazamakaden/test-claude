/**
 * Single source of truth for Turnstile config — mirrors the
 * isSupabaseConfigured pattern in lib/supabase/env.ts. Isomorphic (no
 * server-only): both the Client login form and the signIn Server Action
 * read it. Only the NEXT_PUBLIC_ sitekey lives here; the secret stays in
 * the Supabase dashboard and never enters this repo.
 */
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export const isTurnstileConfigured = turnstileSiteKey.length > 0;

/**
 * Cloudflare's five documented testing sitekeys (developers.cloudflare.com/
 * turnstile/troubleshooting/testing). Always-pass keys make local dev
 * frictionless but must never reach production — they defeat the CAPTCHA
 * more convincingly than a missing key does.
 */
const TURNSTILE_TEST_SITE_KEYS = new Set([
  "1x00000000000000000000AA", // always passes, visible widget
  "2x00000000000000000000AB", // always blocks, visible widget
  "1x00000000000000000000BB", // always passes, invisible widget
  "2x00000000000000000000BB", // always blocks, invisible widget
  "3x00000000000000000000FF", // forces an interactive challenge
]);

export function isTurnstileTestKeyValue(key: string): boolean {
  return TURNSTILE_TEST_SITE_KEYS.has(key);
}

export const isTurnstileTestKey = isTurnstileTestKeyValue(turnstileSiteKey);

/**
 * Called at the top of signIn(). A missing sitekey would otherwise fail
 * open — the login form silently ships with no CAPTCHA at all — and a test
 * sitekey would fail open in a worse way, since it's a documented
 * always-pass key. Both are unreachable outside development.
 */
export function assertTurnstileSafeForProduction(): void {
  if (process.env.NODE_ENV !== "production") return;

  if (!isTurnstileConfigured) {
    throw new Error(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set in production. See README 'CAPTCHA + SMTP setup'."
    );
  }

  if (isTurnstileTestKey) {
    throw new Error(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY is a Cloudflare testing key (always-pass) in production. See README 'CAPTCHA + SMTP setup'."
    );
  }
}
