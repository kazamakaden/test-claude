import { z } from "zod";

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
