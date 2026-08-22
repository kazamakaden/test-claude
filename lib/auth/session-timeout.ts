export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Basis is Supabase's own `last_sign_in_at`, set on a real sign-in and not
 * bumped by token refresh — a true session start, reported by the auth
 * server rather than a client-writable cookie. A missing/unparseable value
 * is treated as not expired: the field is always present in practice for a
 * real session, and signing every user out over an absent field would be a
 * worse failure than the one this guards against.
 */
export function isSessionExpired(lastSignInAt: string | undefined): boolean {
  if (!lastSignInAt) return false;

  const signedInAt = new Date(lastSignInAt).getTime();
  if (Number.isNaN(signedInAt)) return false;

  return Date.now() - signedInAt > SESSION_MAX_AGE_MS;
}
