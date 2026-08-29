import { z } from "zod";

const PER_PAGE = 25;

/**
 * §19 audit log filters from URL search params. Same construction as
 * schemas/members.ts: everything `.catch()`es to a safe default so a
 * hand-edited URL narrows or widens the view but can never error the page.
 *
 * No sort parameter, deliberately. An audit trail reads newest-first and
 * nothing else; offering "oldest first" or sort-by-actor would be the first
 * step toward a view where a damaging entry is easy to bury.
 */
export const auditFiltersSchema = z.object({
  action: z.string().trim().max(64).nullable().catch(null),
  entityTable: z.string().trim().max(64).nullable().catch(null),
  page: z.coerce.number().int().positive().catch(1),
});

export const AUDIT_PER_PAGE_SIZE = PER_PAGE;

export function parseAuditSearchParams(
  searchParams: Record<string, string | string[] | undefined>
) {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return auditFiltersSchema.parse({
    action: single(searchParams.action) ?? null,
    entityTable: single(searchParams.entity) ?? null,
    page: single(searchParams.page) ?? "1",
  });
}

export type AuditFilters = z.infer<typeof auditFiltersSchema>;
