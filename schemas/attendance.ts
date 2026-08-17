import { z } from "zod";

/**
 * §13 attendance input validation — the app-side layer of the three §19 asks
 * for. The database is the authority (record_attendance() re-checks the token,
 * the activity window and the GPS radius itself, and derives everything else),
 * so nothing here is load-bearing for security. It exists to reject obvious
 * rubbish before a round trip and to give the UI a message key.
 */

/**
 * `<10-char slug>.<8 hex>` — the exact shape qr_token_for_bucket() emits.
 * Checked here so a mistyped or truncated URL fails locally instead of
 * consuming one of the caller's ten throttled attempts.
 */
export const attendanceTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]{10}\.[0-9a-f]{8}$/, { message: "invalidToken" });

/**
 * §17 uses the same literal for the signature step. Repeated rather than
 * imported from schemas/documents.ts: these are two independent confirmations
 * that happen to share a word, and coupling them would mean changing the
 * wording of one silently changes the other.
 */
const CONFIRM_TEXT_TH = "ยืนยัน";

/**
 * §13: "Confirm Attendance -> Type ยืนยัน -> Submit". The typed word is a
 * deliberate-action check, not authentication — it stops a mis-scan or an
 * accidental tap from recording attendance, nothing more.
 */
export const recordAttendanceSchema = z.object({
  token: attendanceTokenSchema,
  // Nullable: a session with no GPS fence needs no reading, and the database
  // is what decides whether one was required (`gps_required`).
  gpsLat: z.coerce.number().min(-90).max(90).nullable().catch(null),
  gpsLng: z.coerce.number().min(-180).max(180).nullable().catch(null),
  // Best-effort duplicate-detection signal (§15). Never an authorisation
  // input — a device fingerprint is trivially forgeable by whoever owns the
  // device, and the person submitting attendance is exactly that person.
  fingerprint: z.string().trim().max(200).nullable().catch(null),
  confirm: z.literal(CONFIRM_TEXT_TH, { message: "confirmTextMismatch" }),
});

export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;

/**
 * Staff creating a QR session. `expiresInMinutes` rather than a timestamp: a
 * client-composed instant would have to be trusted or re-derived, and the
 * database already refuses anything beyond 24 hours.
 */
export const createQrSessionSchema = z.object({
  activityId: z.uuid({ message: "invalidActivity" }),
  expiresInMinutes: z.coerce
    .number()
    .int()
    .min(5, { message: "invalidExpiry" })
    .max(24 * 60, { message: "invalidExpiry" })
    .catch(120),
  rotationSeconds: z.coerce
    .number()
    .int()
    .min(10, { message: "invalidRotation" })
    .max(300, { message: "invalidRotation" })
    .catch(30),
  // All-or-nothing, matching qr_sessions_gps_all_or_nothing (0056): a radius
  // with no centre is a half-configured fence that silently checks nothing.
  gpsLat: z.coerce.number().min(-90).max(90).nullable().catch(null),
  gpsLng: z.coerce.number().min(-180).max(180).nullable().catch(null),
  radiusMetres: z.coerce
    .number()
    .int()
    .min(10, { message: "invalidRadius" })
    .max(10000, { message: "invalidRadius" })
    .nullable()
    .catch(null),
});

export type CreateQrSessionInput = z.infer<typeof createQrSessionSchema>;
