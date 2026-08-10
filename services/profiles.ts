import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import type { PendingProfile, OwnProfile } from "@/types/profiles";
import type { Role } from "@/types/auth";

const OWN_PROFILE_COLUMNS =
  "id, email, full_name, avatar_url, role, student_id, class_name, academic_year, password_set, departments(name_th), clubs(name_th)";

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

/**
 * Sends an already-approved member back to `pending` — the "stop approve"
 * counterpart to setProfileRole, deliberately a separate narrow function
 * rather than widening setProfileRole to accept `role: "pending"`:
 * setProfileRole's `Exclude<..., "pending">` is a real guard on the approve
 * path, and its `department_id: departmentId` write would clear the
 * member's department on every call, which is wrong for a revoke that
 * should touch nothing else. `prevent_role_self_escalation` (0002/0024)
 * already blocks self-revoke (`new.id = auth.uid()` raises) and protects
 * `admin` rows (an `old.role = 'admin'` update requires an admin actor) —
 * the action calling this still re-checks both server-side rather than
 * relying on the trigger alone (§19: never trust a single layer).
 *
 * `.select("id").maybeSingle()` — unlike setProfileRole, a zero-row result
 * (RLS silently denied the row, or `id` doesn't exist) must not read back
 * as `{ ok: true }`; same discipline as services/members.ts#updateMember.
 */
export async function revokeProfileApproval(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: "pending" })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.message.includes("insufficient privilege") || error.message.includes("cannot change your own role")) {
      return { ok: false, error: "forbiddenRole" };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "not found or not allowed" };
  return { ok: true };
}

/**
 * Task 3 /profile read. tryCreateClient() fail-soft to null — same contract
 * as every other read function in this codebase (services/books.ts,
 * services/activities.ts) — so a Supabase misconfiguration renders the
 * page's normal error state instead of crashing. profiles_select_own (0002)
 * scopes this to the caller's own row; the explicit column list never
 * touches citizen_id.
 */
export async function getOwnProfile(userId: string): Promise<OwnProfile | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(OWN_PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    avatarUrl: data.avatar_url,
    role: data.role,
    studentId: data.student_id,
    departmentName: data.departments?.name_th ?? null,
    className: data.class_name,
    clubName: data.clubs?.name_th ?? null,
    academicYear: data.academic_year,
    passwordSet: data.password_set,
  };
}

/**
 * Task 3 /profile edit — full_name is the only column a user may change on
 * themselves that isn't already covered by a dedicated action elsewhere
 * (password_set via actions/settings.ts, avatar_url only Google-synced).
 * profiles_update_own (0002) backs this; no trigger blocks full_name, so
 * this is a plain UPDATE. `.select("id").maybeSingle()` turns an RLS denial
 * into a detectable `{ ok: false }` rather than a false success.
 */
export async function updateOwnProfile(
  userId: string,
  fullName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}
