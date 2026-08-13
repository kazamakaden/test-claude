/**
 * §14 student ID format, shared by the client form and the server action.
 *
 * A student's college email local part IS their student ID, built from three
 * concatenated parts:
 *
 *   69        3190100      15
 *   └ year    └ รหัสวิชา   └ running number
 *   2 digits  exactly 7    2+ digits
 *
 *   69 + 3190100 + 15  = 69319010015   (11 digits)
 *   69 + 3190100 + 100 = 693190100100  (12 digits)
 *
 * The split is only unambiguous because รหัสวิชา is ALWAYS exactly 7 digits
 * (confirmed with the user, and enforced by departments_code_format in 0042).
 * Take 2, then 7, then whatever remains is the number — which is why the
 * database constraint is `^[0-9]{11,}$` (11 or MORE) rather than a fixed
 * length.
 *
 * Isomorphic on purpose — no `server-only`. The autoinput form parses as the
 * admin types and the server re-validates what it submits; both must agree, so
 * there is exactly one implementation.
 */

/** Year is 2 digits, รหัสวิชา is 7, so anything valid is at least 11. */
const STUDENT_ID_RE = /^[0-9]{11,}$/;

export const PROGRAM_CODE_LENGTH = 7;
export const YEAR_LENGTH = 2;

export interface ParsedStudentId {
  /**
   * Thai BE year, last two digits, as a STRING — never a number.
   *
   * BE 2600 is "00", and `Number("00")` is `0`, so any downstream `if (!year)`
   * or `year || fallback` would silently discard that entire cohort. Keeping it
   * a string makes that bug unrepresentable rather than merely unlikely.
   */
  year: string;
  /** รหัสวิชา — matches `departments.code`. */
  programCode: string;
  /** Running number, as written in the ID ("05", "15", "100"). */
  studentNumber: string;
  /** The full ID, i.e. the email's local part. */
  studentId: string;
}

/**
 * Parses a student ID or a full college email.
 *
 * Returns null for anything that is not a student ID — including a perfectly
 * valid named staff address like `somchai@udontech.ac.th`. Staff accounts exist
 * and are legitimate; they simply have no ID to decompose, so the caller shows
 * "not a student email" rather than being handed a coerced value.
 */
export function parseStudentId(input: string): ParsedStudentId | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Accept either the bare ID or the whole address.
  const atIndex = trimmed.indexOf("@");
  const localPart = atIndex === -1 ? trimmed : trimmed.slice(0, atIndex);

  if (!STUDENT_ID_RE.test(localPart)) return null;

  return {
    year: localPart.slice(0, YEAR_LENGTH),
    programCode: localPart.slice(YEAR_LENGTH, YEAR_LENGTH + PROGRAM_CODE_LENGTH),
    studentNumber: localPart.slice(YEAR_LENGTH + PROGRAM_CODE_LENGTH),
    studentId: localPart,
  };
}

/**
 * The inverse. `studentNumber` is padded to 2 digits so number 5 becomes "05"
 * and the ID stays 11 digits — an unpadded "5" would be 10 and fail both the
 * regex above and the database's own CHECK. Numbers of 100+ keep their natural
 * length.
 */
export function buildStudentId(
  year: string,
  programCode: string,
  studentNumber: string | number
): string | null {
  const paddedNumber = String(studentNumber).padStart(2, "0");
  const candidate = `${year}${programCode}${paddedNumber}`;
  return STUDENT_ID_RE.test(candidate) &&
    year.length === YEAR_LENGTH &&
    programCode.length === PROGRAM_CODE_LENGTH
    ? candidate
    : null;
}

/** Shape a รหัสวิชา must have to be a real `departments.code` (0042). */
export function isProgramCode(value: string): boolean {
  return /^[0-9]{7}$/.test(value.trim());
}
