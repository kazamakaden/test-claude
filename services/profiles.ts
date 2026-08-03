import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PendingProfile } from "@/types/profiles";
import type { Role } from "@/types/auth";

// Explicit column list — never select("*"); same discipline as
// services/members.ts even though this table has no citizen_id-style
// restricted column today.
const PENDING_PROFILE_COLUMNS = "id, email, full_name, student_id, created_at";

/** RLS (profiles_select_admin, 0002) already scopes this to admin — no status filter needed beyond role. */
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
    studentId: row.student_id,
    createdAt: row.created_at,
  }));
}

/**
 * profiles_update_admin (0002) grants this unconditionally to admin, and
 * prevent_role_self_escalation (0002) permits an admin-initiated role
 * change through the same trigger that blocks everyone else's.
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

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
