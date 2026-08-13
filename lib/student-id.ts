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

/**
 * Education level, encoded in the FIRST digit of รหัสวิชา (i.e. the 3rd digit
 * of the whole ID):
 *
 *   69 3190100 15  → รหัสวิชา starts 3 → ปวส.
 *   66 2090100 20  → รหัสวิชา starts 2 → ปวช.
 *
 * `null` means "a digit we don't have a name for". That is deliberately NOT a
 * parse failure: a รหัสวิชา starting with some future digit must never block
 * admitting a real student, so the rest of the ID stays valid and usable and
 * the UI simply says the level is unknown.
 */
export type StudentLevel = "vocational" | "diploma" | null;

export function studentLevelFromProgramCode(programCode: string): StudentLevel {
  switch (programCode.charAt(0)) {
    case "2":
      return "vocational"; // ปวช.
    case "3":
      return "diploma"; // ปวส.
    default:
      return null;
  }
}

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
  /** ปวช. / ปวส., derived from programCode's first digit; null if unrecognised. */
  level: StudentLevel;
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

  const programCode = localPart.slice(YEAR_LENGTH, YEAR_LENGTH + PROGRAM_CODE_LENGTH);

  return {
    year: localPart.slice(0, YEAR_LENGTH),
    programCode,
    studentNumber: localPart.slice(YEAR_LENGTH + PROGRAM_CODE_LENGTH),
    studentId: localPart,
    level: studentLevelFromProgramCode(programCode),
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
