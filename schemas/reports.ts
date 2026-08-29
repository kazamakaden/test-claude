import { z } from "zod";

/**
 * §18 report filters from URL search params.
 *
 * Same construction as schemas/members.ts — every field `.catch()`es to a safe
 * default, so a hand-edited URL narrows the report or falls back, but never
 * errors the page. The department id is a uuid because that is what
 * departments.id is; a non-uuid silently becomes "no filter" rather than
 * reaching the RPC, which is the `.catch(null)` trap CLAUDE.md records from
 * the Members filters and is deliberate here.
 */
export const reportFiltersSchema = z.object({
  from: z.iso.date().nullable().catch(null),
  to: z.iso.date().nullable().catch(null),
  departmentId: z.uuid().nullable().catch(null),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export function parseReportSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): ReportFilters {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return reportFiltersSchema.parse({
    from: single(searchParams.from) ?? null,
    to: single(searchParams.to) ?? null,
    departmentId: single(searchParams.dept) ?? null,
  });
}
