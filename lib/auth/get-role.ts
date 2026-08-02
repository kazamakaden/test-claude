import "server-only";
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

/**
 * Real role source once a Supabase project is configured; falls back to the
 * dev-cookie stub (development only, never in production) until then.
 * Fails closed to "guest" on any missing session or lookup error — never
 * escalates.
 */
export async function getRole(): Promise<Role> {
  if (!isSupabaseConfigured) return getDevCookieRole();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "guest";

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !data) return "guest";

  return data.role;
}
