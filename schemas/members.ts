import { z } from "zod";
import { memberPositions, roles } from "@/types/auth";
import { emailSchema, newPasswordField } from "@/schemas/auth";

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
 * "admin", kept out-of-band from every UI, and "aft", which is not directly
 * assignable — it is what assigning a ตำแหน่ง produces, via
 * sync_role_with_position() (0049)).
 * Server-side actor narrowing (aft_teacher may not grant aft_teacher) lives
 * in actions/members.ts, mirroring actions/approvals.ts; the database-level
 * authority is prevent_role_self_escalation (0024).
 */
const assignableRoles = roles.filter(
  (r): r is Exclude<(typeof roles)[number], "guest" | "aft" | "admin"> =>
    r !== "guest" && r !== "aft" && r !== "admin"
);

export const updateMemberSchema = z.object({
  id: z.uuid(),
  role: z.enum(assignableRoles, { message: "invalidRole" }),
  /**
   * อวท. office. Nullable = "general member".
   *
   * `.optional()` matters: the ตำแหน่ง select is only RENDERED for an admin,
   * so a non-admin's form submits no `position` field at all. Optional lets
   * that submission validate and leave the stored office untouched, rather
   * than parsing a missing field as null and silently stripping the member's
   * office on every edit a non-admin makes.
   *
   * Who may actually SET it is not decided here — actions/members.ts narrows
   * to admin, and prevent_position_change (0044) is the authority that holds
   * even if both app layers were bypassed.
   */
  position: z.enum(memberPositions, { message: "invalidPosition" }).nullable().optional(),
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
  // No .catch() on either of these either — same reasoning as studentId
  // above. A .catch(null) here would silently blank a member's name or
  // class on save instead of rejecting an over-length edit, discarding the
  // caller's input with no visible error.
  className: z.string().trim().max(50, { message: "classNameTooLong" }).nullable(),
  fullName: z.string().trim().max(100, { message: "fullNameTooLong" }).nullable(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/**
 * Admin-only (actions/members.ts gates this on member:manage, not
 * member:approve) — for a member who can't use Google OAuth. Reuses
 * emailSchema/newPasswordField from schemas/auth.ts rather than
 * redefining the §7 domain/strength rules a second time. aft_teacher is
 * assignable here (unlike updateMemberSchema's server-side actor
 * narrowing) because only an admin ever reaches this schema in the first
 * place.
 */
export const createMemberSchema = z.object({
  email: emailSchema,
  password: newPasswordField,
  role: z.enum(assignableRoles, { message: "invalidRole" }),
  departmentId: z.uuid().nullable().catch(null),
  clubId: z.uuid().nullable().catch(null),
  // Same no-.catch() reasoning as updateMemberSchema above — a malformed
  // value must surface as an error, not be silently discarded to null.
  studentId: z
    .string()
    .trim()
    .regex(/^[0-9]{11,}$/, { message: "invalidStudentId" })
    .nullable(),
  className: z.string().trim().max(50, { message: "classNameTooLong" }).nullable(),
  fullName: z.string().trim().max(100, { message: "fullNameTooLong" }).nullable(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

/**
 * A new department added inline from /members/autoinput.
 *
 * `code` is the app-side layer of the same rule enforced by
 * lib/student-id.ts (parsing) and departments_code_format (0043, the database
 * backstop) — §19's three layers. Exactly 5 digits: a department is the first
 * FIVE digits of a รหัสวิชา, the two after it being the student's group, so a
 * 7-digit value here would create one department per group.
 *
 * Both names are required because `departments.name_th`/`name_en` are NOT NULL
 * and are what the members and activities filters actually display.
 */
export const createDepartmentSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, { message: "invalidDepartmentCode" }),
  nameTh: z
    .string()
    .trim()
    .min(1, { message: "departmentNameRequired" })
    .max(100, { message: "departmentNameTooLong" }),
  nameEn: z
    .string()
    .trim()
    .min(1, { message: "departmentNameRequired" })
    .max(100, { message: "departmentNameTooLong" }),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
