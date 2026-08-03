import { isTurnstileTestKeyValue } from "./turnstile";

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
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    problems.push(
      "NEXT_PUBLIC_SITE_URL is not set — actions/auth.ts's emailRedirectTo falls back to it when the origin request header is absent, and without either, a signup/reset email's link goes nowhere."
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
