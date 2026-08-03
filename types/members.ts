import type { Role } from "@/types/auth";

export interface Department {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
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
  studentId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  className: string | null;
  clubId: string | null;
  clubName: string | null;
  academicYear: number | null;
}

export type MemberSortColumn = "fullName" | "studentId" | "academicYear" | "className";
export type SortDirection = "asc" | "desc";

export interface MemberFilters {
  search: string;
  departmentId: string | null;
  academicYear: number | null;
  className: string | null;
  clubId: string | null;
  sort: MemberSortColumn;
  direction: SortDirection;
  page: number;
}

export interface MembersResult {
  rows: Member[];
  total: number;
}
