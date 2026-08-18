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
