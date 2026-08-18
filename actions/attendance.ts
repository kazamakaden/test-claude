"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { recordAttendanceSchema, createQrSessionSchema } from "@/schemas/attendance";
import { manualAttendanceSchema } from "@/schemas/activities";
import { recordAttendance, createQrSession, revokeQrSession, recordManualAttendance, removeManualAttendance } from "@/services/attendance";
import { readLang, type Locale } from "@/lib/i18n/config";
import type { AttendanceOutcome } from "@/types/attendance";

export type RecordAttendanceResult =
  | { ok: true; outcome: AttendanceOutcome }
  | { ok: false; messageKey: "invalidToken" | "confirmTextMismatch" | AttendanceOutcome };

/**
 * §13 submit. Gated on `attendance:submit` — which a plain `student` now holds
 * (0062), since checking in to an event you are standing at is not authoring.
 * Re-checked server-side here and AGAIN inside record_attendance() (0056).
 *
 * The duplication is deliberate rather than redundant: this guard gives a
 * signed-out or unauthorised viewer a clean redirect, while the one inside the
 * RPC is the boundary that actually holds — the RPC is SECURITY DEFINER and
 * reachable directly at /rest/v1/rpc/record_attendance, so it cannot rely on
 * this action having run.
 */
export async function recordAttendanceAction(
  _prevState: RecordAttendanceResult | null,
  formData: FormData
): Promise<RecordAttendanceResult> {
  const lang = readLang(formData);
  await requirePermission("attendance:submit", lang);

  const parsed = recordAttendanceSchema.safeParse({
    token: formData.get("token"),
    gpsLat: formData.get("gpsLat") || null,
    gpsLng: formData.get("gpsLng") || null,
    fingerprint: formData.get("fingerprint") || null,
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message;
    return {
      ok: false,
      messageKey: key === "confirmTextMismatch" ? "confirmTextMismatch" : "invalidToken",
    };
  }

  const outcome = await recordAttendance(parsed.data);

  // Only a real check-in refreshes anything. Every other outcome left the
  // database untouched, so revalidating would be a wasted render.
  if (outcome === "recorded") {
    revalidatePath(`/${lang}/dashboard`);
    revalidatePath(`/${lang}/activities`);
  }

  // `recorded` and `already_recorded` are both successful ends to the flow
  // from the student's point of view — they are checked in either way. The
  // page shows different copy, hence returning the outcome rather than a bare
  // boolean.
  return outcome === "recorded" || outcome === "already_recorded"
    ? { ok: true, outcome }
    : { ok: false, messageKey: outcome };
}

export type CreateQrSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; messageKey: "invalidActivity" | "invalidExpiry" | "invalidRotation" | "invalidRadius" | "incompleteFence" | "forbidden" | "unknown" };

/** Staff: open a QR session. `activity:manage` — the same boundary 0056's own role check enforces. */
export async function createQrSessionAction(
  _prevState: CreateQrSessionResult | null,
  formData: FormData
): Promise<CreateQrSessionResult> {
  const lang = readLang(formData);
  await requirePermission("activity:manage", lang);

  const parsed = createQrSessionSchema.safeParse({
    activityId: formData.get("activityId"),
    expiresInMinutes: formData.get("expiresInMinutes"),
    rotationSeconds: formData.get("rotationSeconds"),
    gpsLat: formData.get("gpsLat") || null,
    gpsLng: formData.get("gpsLng") || null,
    radiusMetres: formData.get("radiusMetres") || null,
  });

  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message;
    const known = ["invalidActivity", "invalidExpiry", "invalidRotation", "invalidRadius"] as const;
    return {
      ok: false,
      messageKey: (known as readonly string[]).includes(key ?? "")
        ? (key as (typeof known)[number])
        : "unknown",
    };
  }

  // Caught here rather than left to the database: qr_sessions_gps_all_or_nothing
  // (0056) would reject this as a 23514 the UI could only report as "unknown".
  // A half-set fence is a realistic form mistake and deserves its own message.
  const fenceParts = [parsed.data.gpsLat, parsed.data.gpsLng, parsed.data.radiusMetres];
  const setCount = fenceParts.filter((v) => v !== null).length;
  if (setCount !== 0 && setCount !== 3) {
    return { ok: false, messageKey: "incompleteFence" };
  }

  const result = await createQrSession(parsed.data);
  if (!result.ok) {
    return { ok: false, messageKey: result.error === "forbidden" ? "forbidden" : "unknown" };
  }

  revalidatePath(`/${lang}/activities/${parsed.data.activityId}/qr`);
  return { ok: true, sessionId: result.session.id };
}

export type RevokeQrSessionResult = { ok: true } | { ok: false; messageKey: "notAllowed" | "unknown" };

/** Staff: close a session early, so its QR stops working before its expiry. */
export async function revokeQrSessionAction(
  lang: Locale,
  sessionId: string,
  activityId: string
): Promise<RevokeQrSessionResult> {
  await requirePermission("activity:manage", lang);

  const result = await revokeQrSession(sessionId);
  if (!result.ok) {
    return { ok: false, messageKey: result.error === "notAllowed" ? "notAllowed" : "unknown" };
  }

  revalidatePath(`/${lang}/activities/${activityId}/qr`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Manual entry (0062)

export type ManualAttendanceResult = { ok: true; outcome: string } | { ok: false; messageKey: string };

/**
 * Staff records a student who attended without scanning.
 *
 * Guarded on `activity:manage` here for a clean redirect, but that permission is
 * role-wide and does NOT say the caller may touch THIS activity. The real
 * authority is can_edit_activity() (0061) inside record_attendance_manual(),
 * which is SECURITY DEFINER and reachable directly over REST — so it cannot
 * rely on anything this file does.
 */
export async function manualAttendanceAction(
  lang: Locale,
  activityId: string,
  studentId: string,
  status: "present" | "late" | "absent"
): Promise<ManualAttendanceResult> {
  await requirePermission("activity:manage", lang);

  const parsed = manualAttendanceSchema.safeParse({ activityId, studentId, status });
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const result = await recordManualAttendance(parsed.data);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}/activities/${activityId}`);
  return { ok: true, outcome: result.outcome };
}

/**
 * Undo. Reaches `manual` rows only — a QR check-in is evidence the student was
 * physically present, and remove_manual_attendance() refuses to erase one.
 */
export async function removeAttendanceAction(
  lang: Locale,
  activityId: string,
  studentId: string
): Promise<ManualAttendanceResult> {
  await requirePermission("activity:manage", lang);

  const result = await removeManualAttendance(activityId, studentId);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}/activities/${activityId}`);
  return { ok: true, outcome: result.outcome };
}
