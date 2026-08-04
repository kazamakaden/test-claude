import { z } from "zod";

const PER_PAGE = 10;

const sortColumns = ["startsAt", "title", "status"] as const;
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
  sort: z.enum(sortColumns).catch("startsAt"),
  direction: z.enum(["asc", "desc"]).catch("asc"),
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
    sort: single(searchParams.sort) ?? "startsAt",
    direction: single(searchParams.dir) ?? "asc",
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
