/**
 * Single source of truth for whether a real Supabase project is wired up.
 * Drives the dev-role cookie fallback in getRole() and the dev role switcher
 * — both disappear the moment real credentials land in the environment.
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
