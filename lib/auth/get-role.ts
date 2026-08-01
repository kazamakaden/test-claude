import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/types/auth";
import { roles } from "@/types/auth";

/**
 * Dev-only role source until Supabase auth lands (§30.5). Reads a `dev_role`
 * cookie written by the dev role switcher. Production always resolves to
 * "guest" here since the cookie is never set outside development.
 */
export async function getRole(): Promise<Role> {
  if (process.env.NODE_ENV !== "development") return "guest";

  const cookieStore = await cookies();
  const value = cookieStore.get("dev_role")?.value;

  if (value && (roles as readonly string[]).includes(value)) {
    return value as Role;
  }

  return "guest";
}
