/**
 * §13 QR attendance.
 *
 * `AttendanceOutcome` mirrors the exact strings `public.record_attendance()`
 * (0056) returns. They are a closed set defined by that function, not by this
 * file — the RPC answers with a status rather than raising for the outcomes a
 * student can legitimately reach (already checked in, too far away, expired
 * QR), because those are answers to show them, not errors to swallow.
 *
 * `unknown` is not one of the RPC's values: it is what the service maps a
 * genuine failure (a raise, a network error, an unrecognised string) to, so a
 * caller never has to distinguish "the RPC said no" from "the call failed".
 */
export const attendanceOutcomes = [
  "recorded",
  "already_recorded",
  "invalid_token",
  "expired_token",
  "session_closed",
  "outside_activity_window",
  "gps_required",
  "out_of_range",
  "rate_limited",
  "unknown",
] as const;

export type AttendanceOutcome = (typeof attendanceOutcomes)[number];

export function isAttendanceOutcome(value: string): value is AttendanceOutcome {
  return (attendanceOutcomes as readonly string[]).includes(value);
}

/** A staff-visible QR session. `secret` is deliberately absent — see 0056. */
export interface QrSession {
  id: string;
  activityId: string;
  slug: string;
  rotationSeconds: number;
  expiresAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  radiusMetres: number | null;
  revokedAt: string | null;
}

/** One rotation of the displayed token, plus how long it has left. */
export interface QrToken {
  token: string;
  expiresInSeconds: number;
}

/** A recorded check-in, as staff see it on the activity's attendance list. */
export type AttendanceMethod = "qr" | "manual";

export interface AttendanceRow {
  id: string;
  studentId: string;
  studentName: string | null;
  studentCode: string | null;
  className: string | null;
  departmentName: string | null;
  status: "present" | "late" | "absent";
  /**
   * How the row was created (0062). `qr` is a verified scan; `manual` is a
   * staff assertion. Shown in the attendee table because the two are not
   * equally strong evidence, and only `manual` rows can be undone.
   */
  method: AttendanceMethod;
  recordedAt: string;
}

/** This event's attendance, for the detail-page dashboard. */
export interface ActivityAttendanceStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  viaQr: number;
  viaManual: number;
  /**
   * Owner-stated headcount (activities.expected_attendees, 0061), or null.
   * There is no enrolment table in this schema, so without it a percentage
   * would be checked-in/checked-in = 100% and mean nothing.
   */
  expected: number | null;
}
