import { z } from "zod";

const PER_PAGE = 10;

/**
 * `createdAt` is sortable but has no clickable column header — it is the
 * DEFAULT order (newest first), not something the table offers to toggle. A
 * header for it would need a column nobody asked to see.
 */
const sortColumns = ["createdAt", "startsAt", "title", "status"] as const;
const statuses = ["pending", "completed", "cancelled"] as const;

/**
 * §10 activities filters, parsed from URL search params — same construction
 * as schemas/members.ts: sort column is whitelisted (never interpolated raw
 * into order()), everything else `.catch()`s to a safe default.
 */
export const activitiesFiltersSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  departmentId: z.uuid().nullable().catch(null),
  clubId: z.uuid().nullable().catch(null),
  academicYear: z.coerce.number().int().positive().nullable().catch(null),
  status: z.enum(statuses).nullable().catch(null),
  sort: z.enum(sortColumns).catch("createdAt"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().positive().catch(1),
});

export const ACTIVITIES_PER_PAGE_SIZE = PER_PAGE;

export function parseActivitiesSearchParams(
  searchParams: Record<string, string | string[] | undefined>
) {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return activitiesFiltersSchema.parse({
    search: single(searchParams.search) ?? "",
    departmentId: single(searchParams.dept) ?? null,
    clubId: single(searchParams.club) ?? null,
    academicYear: single(searchParams.year) ?? null,
    status: single(searchParams.status) ?? null,
    sort: single(searchParams.sort) ?? "createdAt",
    direction: single(searchParams.dir) ?? "desc",
    page: single(searchParams.page) ?? "1",
  });
}

/**
 * Dashboard calendar day-sheet write path (activity:manage — aft_teacher/
 * admin, 0011). Deliberately minimal compared to the full `activities`
 * table: department/club/academic_year stay unset from this quick-add
 * form (nullable columns, same as the full workflow leaves them for an
 * org-wide event) — a richer creation flow can add them later without a
 * schema change. `date` + `startTime` arrive as separate form fields (the
 * grid cell picks the date, a <input type="time"> picks the time) and are
 * combined into `starts_at` server-side in services/activities.ts, never
 * trusting a client-composed timestamp string.
 */
const activityDateField = z.iso.date({ message: "invalidDate" });
const activityTimeField = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "invalidTime" });

export const createActivitySchema = z.object({
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
  /**
   * อวท. or ชมรม, chosen at creation. NO .catch() and no default: 0068 makes
   * the column NOT NULL with no default precisely so a missing category is a
   * refusal rather than a silent bucket somebody has to notice later, and this
   * schema must not paper over that.
   */
  category: z.enum(["org", "club"], { message: "categoryRequired" }),
  date: activityDateField,
  startTime: activityTimeField,
  endTime: activityTimeField.nullable().catch(null),
  location: z.string().trim().max(200).nullable().catch(null),
  // No .catch() — an over-length description must surface descriptionTooLong
  // to the caller, not be silently discarded (the same class of bug already
  // fixed once for schemas/members.ts's studentId field).
  description: z.string().trim().max(2000, { message: "descriptionTooLong" }).nullable(),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const updateActivitySchema = createActivitySchema.extend({
  id: z.uuid(),
});
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

export const deleteActivitySchema = z.object({ id: z.uuid() });

/**
 * The confirmation step. `isPublic` is what actually puts the activity in front
 * of guests; 0068's activities_public_needs_published CHECK refuses a public
 * draft, so the two move together in one statement.
 */
export const publishActivitySchema = z.object({
  id: z.uuid(),
  isPublic: z.boolean().catch(true),
});
export type PublishActivityInput = z.infer<typeof publishActivitySchema>;

/**
 * Detail-page inputs (0061–0063).
 *
 * Every one of these is re-validated by the database — can_edit_activity() for
 * the write authority, the sort_order constraint for the banner cap, the
 * staff-role trigger for co-editors. These schemas exist to reject malformed
 * input early and give the UI a specific message, not to be the boundary.
 */
export const addBannerSchema = z.object({
  activityId: z.uuid(),
  // The object path the browser uploaded to, not the file itself: uploads go
  // straight to Storage (components/books/file-uploader.tsx), so the Server
  // Action only ever carries this string.
  storagePath: z.string().trim().min(1).max(500),
});

export const removeBannerSchema = z.object({
  activityId: z.uuid(),
  bannerId: z.uuid(),
});

export const activityEditorSchema = z.object({
  activityId: z.uuid(),
  userId: z.uuid(),
});

export const manualAttendanceSchema = z.object({
  activityId: z.uuid(),
  studentId: z.uuid(),
  status: z.enum(["present", "late", "absent"]).catch("present"),
});

/**
 * The owner-stated headcount that gives the attendance % a denominator.
 * Nullable: an event with no expectation simply shows counts and no percentage,
 * which is better than a number that means nothing.
 */
export const expectedAttendeesSchema = z.object({
  activityId: z.uuid(),
  expectedAttendees: z
    .union([z.coerce.number().int().min(1).max(100000), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export type AddBannerInput = z.infer<typeof addBannerSchema>;
export type ActivityEditorInput = z.infer<typeof activityEditorSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
