import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { tryCreateClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { MemberPosition, Role } from "@/types/auth";
import { isMemberPosition, roles, toRole } from "@/types/auth";

async function getDevCookieRole(): Promise<Role> {
  if (process.env.NODE_ENV !== "development") return "guest";

  const cookieStore = await cookies();
  const value = cookieStore.get("dev_role")?.value;

  if (value && (roles as readonly string[]).includes(value)) {
    return value as Role;
  }

  return "guest";
}

/**
 * Dev-only counterpart to `dev_role`, so the officer half of the matrix is
 * exercisable without a live Supabase project. Same production guard: this
 * returns null outside development, so no cookie can ever confer an office.
 */
async function getDevCookiePosition(): Promise<MemberPosition | null> {
  if (process.env.NODE_ENV !== "development") return null;

  const cookieStore = await cookies();
  const value = cookieStore.get("dev_position")?.value;

  return isMemberPosition(value) ? value : null;
}

export interface SessionProfile {
  /** Signed-in user's id, or null for a guest / unconfigured Supabase.
   * Pages that only need "who is looking at this" read it via
   * getSessionUserId() instead of opening their own client. */
  userId: string | null;
  role: Role;
  /**
   * อวท. office, or null. DISPLAY ONLY — it grants nothing by itself (0049
   * removed the officer permission axis). What it does is set the role:
   * an admin assigning a ตำแหน่ง promotes student -> aft via
   * sync_role_with_position(), so authorization reads `role`, never this.
   */
  position: MemberPosition | null;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
  /** Task 5: settings dialog's password section reads this to decide
   * between "change password" and "set a password" copy — a Google-only
   * account has none yet (see 0030's header). */
  passwordSet: boolean;
}

const GUEST_PROFILE: SessionProfile = {
  userId: null,
  role: "guest",
  position: null,
  fullName: null,
  avatarUrl: null,
  email: null,
  passwordSet: false,
};

/**
 * Real role/profile source once a Supabase project is configured; falls
 * back to the dev-cookie stub (development only, never in production)
 * until then. Fails closed to guest on any missing session or lookup
 * error — never escalates. Wrapped in React's cache() so the top-nav
 * (which needs fullName/avatarUrl) and requirePermission (via getRole()
 * below, which only needs role) share one Supabase round trip per request
 * instead of two.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile> => {
  if (!isSupabaseConfigured) {
    const [role, position] = await Promise.all([getDevCookieRole(), getDevCookiePosition()]);
    return {
      userId: null,
      role,
      position,
      fullName: null,
      avatarUrl: null,
      email: null,
      passwordSet: false,
    };
  }

  // tryCreateClient(), not createClient() — createClient() throws
  // synchronously when Supabase isn't configured, which every caller of
  // getRole()/getSessionProfile() (including page-level top-level awaits
  // like /members') would let escape as an unhandled crash instead of the
  // intended fail-closed-to-guest behavior. Same pattern already used by
  // (app)/profile/page.tsx.
  const supabase = await tryCreateClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user || !supabase) return GUEST_PROFILE;

  const { data, error } = await supabase
    .from("profiles")
    .select("role, position, full_name, avatar_url, password_set")
    .eq("id", user.id)
    .single();

  if (error || !data) return GUEST_PROFILE;

  return {
    userId: user.id,
    role: toRole(data.role),
    position: data.position,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    email: user.email ?? null,
    passwordSet: data.password_set,
  };
});

/**
 * The caller's effective role.
 *
 * An account that has not finished the set-password step reports `guest`, not
 * its stored role. Public pages (/members, /documents, /aft-11) render
 * privileged controls straight from `can(role, …)` without going through
 * requirePermission, so a half-onboarded admin would otherwise be shown Add /
 * Edit / Delete buttons whose actions immediately bounce them to
 * /set-password. Reporting `guest` makes the whole UI agree with what the
 * guards will actually allow.
 *
 * This does NOT weaken the guards: requirePermission reads getSessionProfile()
 * directly and checks password_set before role, so it still redirects to
 * /set-password rather than /login, and every write action stays refused.
 */
export async function getRole(): Promise<Role> {
  const profile = await getSessionProfile();

  if (profile.userId !== null && !profile.passwordSet) return "guest";

  return profile.role;
}



/**
 * The viewer's own id, for pages that render differently for the owner of a
 * row ("is this my project?"). Shares getSessionProfile()'s cached round trip
 * rather than opening a second client, and inherits its fail-closed
 * behavior: an unconfigured Supabase yields null, never a throw.
 */
export async function getSessionUserId(): Promise<string | null> {
  const profile = await getSessionProfile();
  return profile.userId;
}
