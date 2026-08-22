import "server-only";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  generateToken,
  hashToken,
  MINT_LIMIT,
  MINT_WINDOW_MS,
  TOKEN_TTL_MS,
} from "@/lib/password-tokens";

/**
 * The database half of the self-issued password link (0064).
 *
 * EVERY function here uses the SERVICE-ROLE client, and this is the first
 * unauthenticated path to that key in the codebase — the caller is, by
 * definition, someone who cannot sign in. So the preconditions are stated
 * rather than implied, and each function does exactly one thing so no
 * caller can accidentally skip one:
 *
 *   findUserByEmail  -> is this a real account?      (no side effect)
 *   mintToken        -> throttled; returns raw token (send it, never store it)
 *   peekToken        -> is this link still good?     (NEVER consumes — see below)
 *   consumeToken     -> atomically spend it, once    (returns the user id)
 *   applyNewPassword -> the only place the password is written
 *
 * The user id ALWAYS comes from the row consumeToken returns. It is never
 * read from a request, a cookie or a form field anywhere in this flow.
 */

export type MintOutcome =
  | { status: "ok"; token: string }
  /** Throttled, or no such account. The caller must render these identically. */
  | { status: "declined" };

/**
 * Returns the profile id for a college address, or null.
 *
 * Deliberately reads public.profiles rather than listing auth.users: the
 * profiles row is what carries password_set, and an auth user with no
 * profile row is a broken state we should not mint a link for.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  if (!isSupabaseAdminConfigured) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

/**
 * Mints a link for a known-good user id, subject to the throttle.
 *
 * The throttle is a fixed-window count of this user's recent mints — the
 * qr_scan_attempts (0056) shape. It exists to stop the endpoint being used
 * to make the server email a college address repeatedly; it is not a
 * guessing defence, because a 256-bit token has nothing to guess.
 *
 * An address that is NOT registered mints nothing, so it has no row to
 * count and is bounded by Turnstile alone. That is proportionate: it costs
 * one indexed lookup and sends no mail, and the only addresses this can
 * ever mail are ones that already exist.
 *
 * Being throttled MUST NOT change what the caller tells the user. The
 * uniform "check your email" response is the entire account-enumeration
 * guard; a "you're doing that too often" message would hand back exactly
 * the fact it hides — that this address is registered.
 */
export async function mintToken(userId: string): Promise<MintOutcome> {
  if (!isSupabaseAdminConfigured) return { status: "declined" };

  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - MINT_WINDOW_MS).toISOString();

  const { count, error: countError } = await admin
    .from("password_setup_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  // Fail CLOSED on a counting failure. An unreadable throttle is an absent
  // throttle, and the cost of being wrong here is one unsent email.
  if (countError) {
    console.error("[password-setup] throttle read failed:", countError.message);
    return { status: "declined" };
  }
  if ((count ?? 0) >= MINT_LIMIT) {
    return { status: "declined" };
  }

  const token = generateToken();
  const { error } = await admin.from("password_setup_tokens").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });

  if (error) {
    console.error("[password-setup] mint failed:", error.message);
    return { status: "declined" };
  }

  return { status: "ok", token };
}

/**
 * Is this link still good? Validates WITHOUT consuming.
 *
 * This distinction is the single most important behaviour in the flow.
 * Gmail, Outlook and corporate antivirus all fetch links in mail before a
 * human ever sees them. A token consumed by that GET is dead by the time
 * the recipient clicks it — and worse, only sometimes, so the flow would
 * appear to break at random for reasons no log would explain.
 *
 * Single-use is not weakened by this: "use" means setting a password, which
 * only consumeToken() below can do. A scanner that follows the link learns
 * nothing and spends nothing.
 */
export async function peekToken(rawToken: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured) return false;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("password_setup_tokens")
    .select("id")
    .eq("token_hash", hashToken(rawToken))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return !error && Boolean(data);
}

/**
 * Spends the token and returns whose account it belongs to, or null.
 *
 * ONE statement — an UPDATE whose WHERE carries every condition — so two
 * concurrent submissions cannot both win. Postgres serialises the row
 * update; the loser's WHERE no longer matches (used_at is set) and it
 * returns zero rows. A read-then-write would leave exactly that race open.
 */
export async function consumeToken(rawToken: string): Promise<string | null> {
  if (!isSupabaseAdminConfigured) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("password_setup_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(rawToken))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id")
    .maybeSingle();

  if (error || !data) return null;
  return data.user_id;
}

/**
 * The only place a password is written by this flow.
 *
 * Reachable only after: a raw token arrived in an httpOnly cookie, hashed
 * to a row that was unused and unexpired, that row was spent atomically and
 * returned exactly one user_id, and the new password passed
 * newPasswordSchema. `userId` is that returned value.
 *
 * profiles.password_set is written with the admin client too, which departs
 * from the house rule that admin is used only for auth-schema work
 * (services/members.ts uses the caller's own client for its profiles half so
 * the triggers still apply). There is no caller client here — the user is
 * not signed in, which is the whole point. The write is one boolean on one
 * row and touches nothing prevent_role_self_escalation (0024) or
 * prevent_member_identity_change (0025) guards.
 *
 * Returns whether this was a FIRST-time setup, so the caller can pick
 * between the "your account is ready" and "password changed" notices —
 * read before the write, or it is always false.
 */
export async function applyNewPassword(
  userId: string,
  password: string
): Promise<{ ok: true; firstTime: boolean } | { ok: false }> {
  if (!isSupabaseAdminConfigured) return { ok: false };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("password_set")
    .eq("id", userId)
    .maybeSingle();
  const firstTime = !profile?.password_set;

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("[password-setup] updateUserById failed:", error.message);
    return { ok: false };
  }

  await admin.from("profiles").update({ password_set: true }).eq("id", userId);

  // Any other outstanding link for this account is now stale. Spending one
  // link should not leave two more valid ones sitting in an inbox.
  await admin
    .from("password_setup_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);

  return { ok: true, firstTime };
}
