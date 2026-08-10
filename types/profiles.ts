import type { Role } from "@/types/auth";

export interface PendingProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  studentId: string | null;
  createdAt: string;
}

/**
 * Task 3: the /profile page's own read. Deliberately has NO citizen_id
 * field — same discipline as types/members.ts's Member: omitting it from
 * the shape makes leaking that column a type error, not just a
 * query-discipline convention. Only `fullName` is actually editable by the
 * viewer themselves — student_id/departmentName/className/clubName are
 * locked to admin/aft_teacher by prevent_member_identity_change (0025), and
 * academicYear is a GENERATED column nobody can write directly — the
 * /profile page renders those read-only rather than offering an edit the
 * database would reject.
 */
export interface OwnProfile {
  id: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: Role;
  studentId: string | null;
  departmentName: string | null;
  className: string | null;
  clubName: string | null;
  academicYear: number | null;
  passwordSet: boolean;
}
