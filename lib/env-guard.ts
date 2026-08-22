import { isTurnstileTestKeyValue } from "./turnstile";
import { resolveConfiguredSiteUrl } from "./site-url";

/**
 * Fails the build when a Vercel Production deploy is missing config that
 * would otherwise only surface at the first login attempt as a runtime 500
 * (see README "Deploying to Vercel"). Gated on VERCEL_ENV, not NODE_ENV —
 * `next build` runs locally with NODE_ENV=production using the Cloudflare
 * test sitekey, and that must keep succeeding.
 */
export function assertDeployEnvConfigured(): void {
  if (process.env.VERCEL_ENV !== "production") return;

  const problems: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.");
  }
  if (!resolveConfiguredSiteUrl()) {
    problems.push(
      "Neither NEXT_PUBLIC_SITE_URL nor VERCEL_PROJECT_PRODUCTION_URL is set — actions/auth.ts's emailRedirectTo falls back to one of them when the origin request header is absent, and without either, a signup/reset email's link goes nowhere. On a standard Vercel import, VERCEL_PROJECT_PRODUCTION_URL is injected automatically unless 'Automatically expose System Environment Variables' has been turned off for this project — set NEXT_PUBLIC_SITE_URL by hand in that case."
    );
  }

  // SMTP is required, unlike the VAPID keys below. Setting a password is the
  // only route into an account that has none, that route is one emailed
  // link, and this app now sends that mail itself (0064) — so an unset
  // SMTP_* is not a missing enhancement, it is a locked front door that
  // fails silently at 3am rather than loudly at build time.
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) {
    problems.push(
      "SMTP_USER / SMTP_PASSWORD / SMTP_FROM are not all set — the password-setup and password-reset emails are sent by this app, so without them nobody can set a password. See docs/email-setup.md."
    );
  }

  // The secret half is as required as the sitekey. Since this app now runs
  // Cloudflare's siteverify itself (lib/turnstile-server.ts), a missing secret
  // means verifyTurnstileToken() fails closed in production and nobody can
  // sign in — the same "locked front door" argument as SMTP above, not the
  // graceful degradation the VAPID note below describes.
  if (!process.env.TURNSTILE_SECRET_KEY) {
    problems.push(
      "TURNSTILE_SECRET_KEY is not set — the app verifies captcha tokens itself now, and without the secret every submission is refused. See README \"CAPTCHA\"."
    );
  }

  // Required from the moment the login button routes through this app's own
  // Google flow. While that flow was reachable only by typing its URL, a
  // missing value degraded to "that URL doesn't work"; now it is the only way
  // in, so a missing value is a locked front door — the same argument as SMTP
  // above, and the opposite of the VAPID note below.
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    problems.push(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not both set — Google sign-in now runs through this app's own OAuth flow, so without them nobody can sign in. See README \"Google sign-in setup\"."
    );
  }

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!turnstileSiteKey) {
    problems.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set.");
  } else if (isTurnstileTestKeyValue(turnstileSiteKey)) {
    problems.push(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY is a Cloudflare testing key (always-pass) — not valid in production."
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Production deploy is missing required configuration:\n${problems
        .map((p) => `  - ${p}`)
        .join("\n")}\nSee README "Deploying to Vercel".`
    );
  }
}

// Deliberately NOT checking NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY
// here. Unlike Supabase/Turnstile/site-URL, the app is not broken without
// them — lib/push.ts#isPushConfigured hides the Settings web-push toggle
// entirely when the public key is unset, so a missing key degrades to "no
// push option shown," not a runtime failure. Failing the build over it
// would be wrong for what is meant to be a progressive enhancement. Do not
// "fix" this omission without re-reading this comment.
