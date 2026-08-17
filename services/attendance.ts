import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import { isAttendanceOutcome, type AttendanceOutcome, type AttendanceRow, type QrSession, type QrToken } from "@/types/attendance";
import type { CreateQrSessionInput, RecordAttendanceInput } from "@/schemas/attendance";

/**
 * §13. Every function here is a thin wrapper over a database routine, and
 * deliberately so: `attendance` has no client write grant at all (0055), and
 * the checks that matter — role, token HMAC, activity window, GPS radius,
 * throttle — all live inside record_attendance() (0056) where they cannot be
 * skipped by calling a different code path. There is nothing to enforce here
 * that is not already enforced there.
 */

/**
 * The §13 write path. Returns a closed set of outcomes rather than throwing,
 * because most of them are things to tell the student ("you're too far away",
 * "already checked in"), not errors.
 *
 * createClient(), not tryCreateClient(): this is a write. An unconfigured
 * Supabase should throw here rather than quietly report a failed check-in as
 * some ordinary "no" — the same split every other service in this codebase
 * draws between its read and write paths.
 */
export async function recordAttendance(
  input: RecordAttendanceInput
): Promise<AttendanceOutcome> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_attendance", {
    p_token: input.token,
    p_gps_lat: input.gpsLat ?? undefined,
    p_gps_lng: input.gpsLng ?? undefined,
    p_fingerprint: input.fingerprint ?? undefined,
  });

  if (error) {
    // 53400 is the throttle raising (0056). It is a legitimate answer to show
    // the caller, so it is mapped rather than swallowed into `unknown`.
    if (error.code === "53400") return "rate_limited";
    return "unknown";
  }

  // The RPC's return type is `text`; narrow it rather than trusting the string
  // to be one of ours, so a future database change surfaces as `unknown`
  // instead of a value the UI has no message for.
  return typeof data === "string" && isAttendanceOutcome(data) ? data : "unknown";
}

/**
 * Staff: open a QR session for an activity. The database generates the slug
 * and the secret — neither is writable by any client (0056) — so this passes
 * only the caller's real choices.
 */
export async function createQrSession(
  input: CreateQrSessionInput
): Promise<{ ok: true; session: Pick<QrSession, "id" | "slug" | "rotationSeconds" | "expiresAt"> } | { ok: false; error: string }> {
  const supabase = await createClient();

  const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString();

  const { data, error } = await supabase.rpc("create_qr_session", {
    p_activity_id: input.activityId,
    p_expires_at: expiresAt,
    p_rotation_seconds: input.rotationSeconds,
    p_gps_lat: input.gpsLat ?? undefined,
    p_gps_lng: input.gpsLng ?? undefined,
    p_radius_metres: input.radiusMetres ?? undefined,
  });

  if (error) return { ok: false, error: error.code === "42501" ? "forbidden" : "unknown" };

  // The RPC `returns table (...)`, so PostgREST hands back an array even
  // though it is always one row. Treat an empty array as failure rather than
  // indexing into it blindly.
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { ok: false, error: "unknown" };

  return {
    ok: true,
    session: {
      id: row.id,
      slug: row.slug,
      rotationSeconds: row.rotation_seconds,
      expiresAt: row.expires_at,
    },
  };
}

/**
 * The token to display right now, plus its remaining life so the client knows
 * when to ask again. Computing it needs `secret`, which not even staff may
 * read, so this necessarily goes through the definer RPC.
 */
export async function getCurrentQrToken(sessionId: string): Promise<QrToken | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("current_qr_token", {
    p_session_id: sessionId,
  });

  if (error) return null;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return { token: row.token, expiresInSeconds: row.expires_in_seconds };
}

/** Staff: the open (unrevoked, unexpired) session for an activity, if any. */
export async function getActiveQrSession(activityId: string): Promise<QrSession | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  // Never select("*") — `secret` is column-revoked (0056) and a "*" would fail
  // outright with 42501, the same trap 0005 set for profiles.citizen_id.
  const { data, error } = await supabase
    .from("qr_sessions")
    .select("id, activity_id, slug, rotation_seconds, expires_at, gps_lat, gps_lng, radius_metres, revoked_at")
    .eq("activity_id", activityId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    activityId: data.activity_id,
    slug: data.slug,
    rotationSeconds: data.rotation_seconds,
    expiresAt: data.expires_at,
    gpsLat: data.gps_lat,
    gpsLng: data.gps_lng,
    radiusMetres: data.radius_metres,
    revokedAt: data.revoked_at,
  };
}

/** Staff: close a session early. Revoking is an UPDATE the column grant allows. */
export async function revokeQrSession(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "unknown" };
  // Zero rows means RLS refused or the id is stale — never a silent success,
  // the same discipline updateMember/updateBook already use.
  if (!data) return { ok: false, error: "notAllowed" };
  return { ok: true };
}

/**
 * Who has checked in. Reviewer-scoped by RLS (attendance_select_reviewer,
 * 0008/0049) — a student calling this sees only their own row, which is
 * correct and is why no extra filter is applied here.
 *
 * The §15 sensitive columns (gps, fingerprint, browser, ip) are deliberately
 * NOT selected: they are not in the `authenticated` allow-list (0008), so
 * asking for them would 42501 the whole query.
 */
export async function listActivityAttendance(activityId: string): Promise<AttendanceRow[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("attendance")
    .select("id, student_id, class_name, status, recorded_at, profiles(full_name, student_id), departments(name_th)")
    .eq("activity_id", activityId)
    .order("recorded_at", { ascending: false });

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.profiles?.full_name ?? null,
    studentCode: r.profiles?.student_id ?? null,
    className: r.class_name,
    departmentName: r.departments?.name_th ?? null,
    status: r.status,
    recordedAt: r.recorded_at,
  }));
}
