const STUDENT_ID_PATTERN = /^[0-9]{11,}$/;

export interface ParsedStudentId {
  year: string;
  departmentCode: string;
  number: string;
}

/** §14 parse: Year (2) + Department (7) + Number (rest). */
export function parseStudentId(id: string): ParsedStudentId | null {
  if (!STUDENT_ID_PATTERN.test(id)) return null;

  return {
    year: id.slice(0, 2),
    departmentCode: id.slice(2, 9),
    number: id.slice(9),
  };
}

export function isValidStudentId(id: string): boolean {
  return STUDENT_ID_PATTERN.test(id);
}
