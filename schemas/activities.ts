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
