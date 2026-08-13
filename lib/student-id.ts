/**
 * §14 student ID format, shared by the client form and the server action.
 *
 * A student's college email local part IS their student ID. It is built from
 * FOUR concatenated parts, not three:
 *
 *   69     31901        00      15
 *   └ year └ department └ group └ running number
 *   2      5 digits     2       2+ digits
 *
 *   69 + 31901 + 00 + 15  = 69319010015   (11 digits)
 *   69 + 31901 + 00 + 100 = 693190100100  (12 digits)
 *   66 + 20901 + 00 + 20  = 66209010020   (ปวช.)
 *
 * The middle 7 digits together are the รหัสวิชา as it is usually written
 * (`programCode` below), but only its first FIVE identify the department —
 * the last two are the student's group/classroom index. Treating all 7 as the
 * department is the bug 0043 fixes: it made every student outside group `00`
 * look like they belonged to a department that did not exist yet.
 *
 * The split is unambiguous because both middle fields are fixed-width
 * (department enforced by departments_code_format in 0043). Take 2, then 5,
 * then 2, and whatever remains is the running number — which is why the
 * regex below is `^[0-9]{11,}$` (11 or MORE) rather than a fixed length.
 *
 * Isomorphic on purpose — no `server-only`. The autoinput form parses as the
 * admin types and the server re-validates what it submits; both must agree, so
 * there is exactly one implementation.
 */

/** 2 year + 5 department + 2 group + at least 2 running = at least 11. */
const STUDENT_ID_RE = /^[0-9]{11,}$/;

export const YEAR_LENGTH = 2;
export const DEPARTMENT_CODE_LENGTH = 5;
export const GROUP_CODE_LENGTH = 2;
/** The รหัสวิชา as normally written: department + group. */
export const PROGRAM_CODE_LENGTH = DEPARTMENT_CODE_LENGTH + GROUP_CODE_LENGTH;

/**
 * Education level, encoded in the FIRST digit of the department code (i.e.
 * the 3rd digit of the whole ID):
 *
 *   66 20901 00 20  → department starts 2 → ปวช.
 *   69 30901 00 15  → department starts 3 → ปวส.
 *   69 40101 00 07  → department starts 4 → ทล.บ.
 *
 * `null` means "a digit we don't have a name for". That is deliberately NOT a
 * parse failure: a department code starting with some future digit must never
 * block admitting a real student, so the rest of the ID stays valid and usable
 * and the UI simply says the level is unknown.
 */
export type StudentLevel = "vocational" | "diploma" | "bachelor" | null;

export function studentLevelFromProgramCode(programCode: string): StudentLevel {
  switch (programCode.charAt(0)) {
    case "2":
      return "vocational"; // ปวช.
    case "3":
      return "diploma"; // ปวส.
    case "4":
      return "bachelor"; // ทล.บ. — เทคโนโลยีบัณฑิต (40101, 40104)
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
  /** Department code — the 5 digits that match `departments.code`. */
  departmentCode: string;
  /** Group/classroom index within the department ("00", "02", ...). */
  groupCode: string;
  /**
   * รหัสวิชา as normally written — departmentCode + groupCode, 7 digits.
   * Display only: it is NOT the department key. Match on `departmentCode`.
   */
  programCode: string;
  /** Running number, as written in the ID ("05", "15", "100"). */
  studentNumber: string;
  /** The full ID, i.e. the email's local part. */
  studentId: string;
  /** ปวช. / ปวส., derived from the department code's first digit. */
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

  const departmentCode = localPart.slice(YEAR_LENGTH, YEAR_LENGTH + DEPARTMENT_CODE_LENGTH);
  const groupCode = localPart.slice(
    YEAR_LENGTH + DEPARTMENT_CODE_LENGTH,
    YEAR_LENGTH + PROGRAM_CODE_LENGTH
  );

  return {
    year: localPart.slice(0, YEAR_LENGTH),
    departmentCode,
    groupCode,
    programCode: `${departmentCode}${groupCode}`,
    studentNumber: localPart.slice(YEAR_LENGTH + PROGRAM_CODE_LENGTH),
    studentId: localPart,
    level: studentLevelFromProgramCode(departmentCode),
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
  departmentCode: string,
  groupCode: string,
  studentNumber: string | number
): string | null {
  const paddedNumber = String(studentNumber).padStart(2, "0");
  const candidate = `${year}${departmentCode}${groupCode}${paddedNumber}`;
  return STUDENT_ID_RE.test(candidate) &&
    year.length === YEAR_LENGTH &&
    departmentCode.length === DEPARTMENT_CODE_LENGTH &&
    groupCode.length === GROUP_CODE_LENGTH
    ? candidate
    : null;
}

/** Shape a code must have to be a real `departments.code` (0043). */
export function isDepartmentCode(value: string): boolean {
  return /^[0-9]{5}$/.test(value.trim());
}
