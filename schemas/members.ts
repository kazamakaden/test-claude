import { z } from "zod";
import { roles } from "@/types/auth";

const PER_PAGE = 10;

const sortColumns = ["fullName", "studentId", "academicYear", "className"] as const;

/**
 * Parses raw searchParams into validated filters. Sort column is whitelisted
 * (not interpolated raw into a query) — an un-whitelisted order() column
 * is an injection vector.
 */
export const membersFiltersSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  departmentId: z.uuid().nullable().catch(null),
  academicYear: z.coerce.number().int().positive().nullable().catch(null),
  className: z.string().trim().max(50).nullable().catch(null),
  clubId: z.uuid().nullable().catch(null),
  sort: z.enum(sortColumns).catch("fullName"),
  direction: z.enum(["asc", "desc"]).catch("asc"),
  page: z.coerce.number().int().positive().catch(1),
});

export const PER_PAGE_SIZE = PER_PAGE;

export function parseMembersSearchParams(
  searchParams: Record<string, string | string[] | undefined>
) {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return membersFiltersSchema.parse({
    search: single(searchParams.search) ?? "",
    departmentId: single(searchParams.dept) ?? null,
    academicYear: single(searchParams.year) ?? null,
    className: single(searchParams.class) ?? null,
    clubId: single(searchParams.club) ?? null,
    sort: single(searchParams.sort) ?? "fullName",
    direction: single(searchParams.dir) ?? "asc",
    page: single(searchParams.page) ?? "1",
  });
}

/**
 * §5: admin/aft_teacher editing an already-approved member. Same
 * assignableRoles construction as schemas/approvals.ts (excludes "guest",
 * "pending" — this form edits members who already hold a real role, not
 * signup queue entries — and "admin", kept out-of-band from every UI).
 * Server-side actor narrowing (aft_teacher may not grant aft_teacher) lives
 * in actions/members.ts, mirroring actions/approvals.ts; the database-level
 * authority is prevent_role_self_escalation (0024).
 */
const assignableRoles = roles.filter(
  (r): r is Exclude<(typeof roles)[number], "guest" | "pending" | "admin"> =>
    r !== "guest" && r !== "pending" && r !== "admin"
);

export const updateMemberSchema = z.object({
  id: z.uuid(),
  role: z.enum(assignableRoles, { message: "invalidRole" }),
  departmentId: z.uuid().nullable().catch(null),
  clubId: z.uuid().nullable().catch(null),
  // §14 format, same pattern as profiles_student_id_check (0003) — a
  // blank input means "not a student", stored as null rather than "".
  // No .catch() here: actions/members.ts already turns a blank field into
  // null before this schema ever sees it, so the only way a non-null string
  // reaches .regex() is a real, malformed value — that must surface
  // "invalidStudentId" to the caller, not be silently swallowed to null
  // (which would silently blank the field and shift academic_year, since
  // it's generated from student_id).
  studentId: z
    .string()
    .trim()
    .regex(/^[0-9]{11,}$/, { message: "invalidStudentId" })
    .nullable(),
  className: z.string().trim().max(50).nullable().catch(null),
  fullName: z.string().trim().max(100).nullable().catch(null),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
