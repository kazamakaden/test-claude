import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import type { OwnProfile } from "@/types/profiles";
import { toRole } from "@/types/auth";

const OWN_PROFILE_COLUMNS =
  "id, email, full_name, avatar_url, role, student_id, class_name, academic_year, password_set, departments(name_th), clubs(name_th)";

// Explicit column list — never select("*"); same discipline as
// services/members.ts even though this table has no citizen_id-style
// restricted column today.

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
    role: toRole(data.role),
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

/**
 * §14 read-back. The column is outside 0005's SELECT allow-list, so this goes
 * through get_citizen_id() — the SECURITY DEFINER accessor, which 0075 extended
 * to admit the subject alongside an admin. It enforces its own authorization
 * and raises for anyone else, so there is no role check to duplicate here.
 *
 * A raise reads as "nothing on file" rather than propagating: the caller only
 * needs to know whether to render the input or the stored value.
 */
export async function getOwnCitizenId(userId: string): Promise<string | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_citizen_id", { member_id: userId });
  if (error) return null;
  return data ?? null;
}

/**
 * §14 read-back for an ADMIN looking at someone else's row.
 *
 * Same accessor, different branch: get_citizen_id() admits the subject OR an
 * admin, and until now nothing ever passed an id other than the caller's own,
 * so the admin half has been dead code protecting a capability nothing could
 * reach. There is still no role check here to duplicate — the function raises
 * for anyone who is neither, and 0076 made that refusal NULL-safe for a caller
 * with no session at all.
 */
export async function getMemberCitizenId(memberId: string): Promise<string | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_citizen_id", { member_id: memberId });
  if (error) return null;
  return data ?? null;
}

/**
 * §14's other half: "cannot be changed without Administrator permission" —
 * which means an administrator CAN. prevent_citizen_id_change (0003) has always
 * carried the carve-out (`current_role() <> 'admin'` is what raises), and
 * 0005 revoked only SELECT on this column, never UPDATE, so no migration is
 * needed to reach it. What was missing was a caller.
 *
 * Deliberately a separate narrow function rather than a field on updateMember,
 * the same call revokeProfileApproval made: updateMember writes six columns at
 * once, so folding a citizen-ID correction in would let it silently rewrite the
 * member's department or class alongside.
 *
 * The error mapping differs from setOwnCitizenId's on purpose. There, P0001
 * means "you already set this once" and is the expected end of the road. Here
 * the caller is supposed to be exempt from that rule, so a P0001 means the
 * database did not see them as an admin — a different thing entirely, and
 * saying "already set" would send them looking in the wrong place.
 */
export async function setMemberCitizenId(
  memberId: string,
  citizenId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ citizen_id: citizenId })
    .eq("id", memberId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "P0001") return { ok: false, error: "notAdmin" };
    if (error.code === "23514") return { ok: false, error: "citizenIdInvalid" };
    return { ok: false, error: "unknown" };
  }
  // Zero rows means RLS filtered the update rather than raising — the asymmetry
  // this codebase keeps re-learning: a failing USING clause filters, a failing
  // WITH CHECK raises. Treat it as a refusal, never a silent success.
  if (!data) return { ok: false, error: "unknown" };
  return { ok: true };
}

/**
 * §14 write. Set-once is enforced by prevent_citizen_id_change (0003), not
 * here: a second attempt raises at the database, which is what makes the rule
 * true for every client rather than only for this form.
 *
 * `.select("id").maybeSingle()` so an RLS-filtered update reads as a refusal
 * rather than a false success — the discipline updateMember/updateBook use.
 */
export async function setOwnCitizenId(
  userId: string,
  citizenId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ citizen_id: citizenId })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    // P0001 is prevent_citizen_id_change; 23514 is profiles_citizen_id_format.
    if (error.code === "P0001") return { ok: false, error: "alreadySet" };
    if (error.code === "23514") return { ok: false, error: "citizenIdInvalid" };
    return { ok: false, error: "unknown" };
  }
  if (!data) return { ok: false, error: "unknown" };
  return { ok: true };
}
