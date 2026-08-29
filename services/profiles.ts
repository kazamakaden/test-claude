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
