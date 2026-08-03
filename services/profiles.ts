import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PendingProfile } from "@/types/profiles";
import type { Role } from "@/types/auth";

// Explicit column list — never select("*"); same discipline as
// services/members.ts even though this table has no citizen_id-style
// restricted column today.
const PENDING_PROFILE_COLUMNS = "id, email, full_name, avatar_url, student_id, created_at";

/**
 * NOT scoped to admin by RLS — profiles_select_directory (0004) is
 * `using (true)` for every authenticated user, so any signed-in caller can
 * read every profiles row over PostgREST regardless of this query's own
 * `.eq("role", "pending")` filter. The actual gate on who may reach this
 * function at all is `requirePermission("member:approve", lang)` in the
 * page/action that calls it — not RLS.
 */
export async function listPendingProfiles(): Promise<PendingProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PENDING_PROFILE_COLUMNS)
    .eq("role", "pending")
    .order("created_at", { ascending: true }); // longest-waiting first

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    studentId: row.student_id,
    createdAt: row.created_at,
  }));
}

/**
 * profiles_update_admin (0002) and profiles_update_aft_teacher (0024) grant
 * this to admin and aft_teacher respectively. prevent_role_self_escalation
 * (0002, rewritten in 0024) is the actual authority on which (actor, new
 * role) pairs are legal — it blocks self-escalation for anyone including
 * admin, and requires admin specifically to mint/demote an `admin` or grant
 * `aft_teacher`. A caller here that violates those rules gets a Postgres
 * exception, mapped below to a message key rather than surfaced raw.
 */
export async function setProfileRole(
  id: string,
  role: Exclude<Role, "guest" | "pending" | "admin">,
  departmentId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, department_id: departmentId })
    .eq("id", id);

  if (error) {
    // Both prevent_role_self_escalation raises ("insufficient privilege to
    // change role" / "...to grant aft_teacher") surface as a generic
    // Postgres RAISE EXCEPTION, not a distinct SQLSTATE — string-match is
    // the only way to distinguish "you're not allowed" from an unrelated
    // failure without changing the trigger to use a custom SQLSTATE.
    if (error.message.includes("insufficient privilege")) {
      return { ok: false, error: "forbiddenRole" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
