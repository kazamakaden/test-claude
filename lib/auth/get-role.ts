import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { tryCreateClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Role } from "@/types/auth";
import { roles } from "@/types/auth";

async function getDevCookieRole(): Promise<Role> {
  if (process.env.NODE_ENV !== "development") return "guest";

  const cookieStore = await cookies();
  const value = cookieStore.get("dev_role")?.value;

  if (value && (roles as readonly string[]).includes(value)) {
    return value as Role;
  }

  return "guest";
}

export interface SessionProfile {
  /** Signed-in user's id, or null for a guest / unconfigured Supabase.
   * Pages that only need "who is looking at this" read it via
   * getSessionUserId() instead of opening their own client. */
  userId: string | null;
  role: Role;
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
    const role = await getDevCookieRole();
    return { userId: null, role, fullName: null, avatarUrl: null, email: null, passwordSet: false };
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
    .select("role, full_name, avatar_url, password_set")
    .eq("id", user.id)
    .single();

  if (error || !data) return GUEST_PROFILE;

  return {
    userId: user.id,
    role: data.role,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    email: user.email ?? null,
    passwordSet: data.password_set,
  };
});

export async function getRole(): Promise<Role> {
  const profile = await getSessionProfile();
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
