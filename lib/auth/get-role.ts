import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

const GUEST_PROFILE: SessionProfile = { role: "guest", fullName: null, avatarUrl: null, email: null };

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
    return { role, fullName: null, avatarUrl: null, email: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return GUEST_PROFILE;

  const { data, error } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (error || !data) return GUEST_PROFILE;

  return { role: data.role, fullName: data.full_name, avatarUrl: data.avatar_url, email: user.email ?? null };
});

export async function getRole(): Promise<Role> {
  const profile = await getSessionProfile();
  return profile.role;
}
