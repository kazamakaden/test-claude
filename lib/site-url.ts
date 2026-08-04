/**
 * Single source of truth for this deployment's public origin — used by both
 * the build-time guard (next.config.ts) and the runtime redirect builder
 * (actions/auth.ts). Isomorphic, no server-only marker, same reasoning as
 * lib/turnstile.ts: next.config.ts imports it from plain Node before any
 * request context exists.
 *
 * VERCEL_PROJECT_PRODUCTION_URL (not VERCEL_URL) is used for the Vercel
 * fallback — VERCEL_URL is the per-deployment ephemeral hostname, which is
 * never in Supabase's Auth URL allow-list, so a link built from it would be
 * rejected at send time. VERCEL_PROJECT_PRODUCTION_URL is the stable
 * production domain and is only present when Vercel's "Automatically expose
 * System Environment Variables" project setting is on.
 */
export function resolveConfiguredSiteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;

  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionHost) return `https://${vercelProductionHost}`;

  return null;
}
