import type { MemberPosition, Role } from "@/types/auth";
import type { StudentLevel } from "@/lib/student-id";

export interface Department {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
}

/**
 * A สาขา plus how much is attached to it. The counts exist to answer "can this
 * be deleted, and if not why" — every FK into departments is NO ACTION, so the
 * database refuses the delete regardless; these turn that refusal into a
 * sentence the admin can act on.
 */
export interface DepartmentUsage extends Department {
  memberCount: number;
  activityCount: number;
  projectCount: number;
}

export interface Club {
  id: string;
  nameTh: string;
  nameEn: string;
}

/**
 * Deliberately has NO citizen_id field — omitting it from the shape makes
 * leaking that column a type error, not just a query-discipline convention.
 *
 * `email` is nullable, not omitted like citizen_id: it IS selectable by a
 * signed-in viewer (§9), just not by a guest (§5) — getMembers's
 * `includeEmail` option controls which query runs. `null` here means "this
 * viewer isn't allowed to see it", not "no data exists".
 */
export interface Member {
  id: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  role: Role;
  /** อวท. office, or null. Grants nothing by itself (0049); what it does is
   *  SET the role — an admin assigning one promotes student -> aft. Read
   *  `role` for authorization, never this. */
  position: MemberPosition | null;
  studentId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  className: string | null;
  /**
   * ระดับชั้น (ปวช./ปวส./ทล.บ.), generated from student_id (0069). This is what
   * the directory shows as the member's class: `className` is a free-text
   * admin override that nothing populates automatically, so it is null for
   * every real account.
   */
  studentLevel: StudentLevel;
  clubId: string | null;
  clubName: string | null;
  academicYear: number | null;
}

export type MemberSortColumn = "fullName" | "studentId" | "academicYear" | "studentLevel";
export type SortDirection = "asc" | "desc";

export interface MemberFilters {
  search: string;
  departmentId: string | null;
  academicYear: number | null;
  /** ระดับชั้น. Replaces the old free-text `className` filter, which could never
   *  match anything — see 0069. */
  studentLevel: StudentLevel;
  clubId: string | null;
  sort: MemberSortColumn;
  direction: SortDirection;
  page: number;
}

export interface MembersResult {
  rows: Member[];
  total: number;
}
