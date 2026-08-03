import { z } from "zod";

const PER_PAGE = 10;

const sortColumns = ["updatedAt", "title", "status"] as const;
const statuses = ["draft", "teacher_review", "admin_approval", "official"] as const;

export const PROJECTS_PER_PAGE_SIZE = PER_PAGE;

export const projectIdSchema = z.uuid();

/** A malformed id can never reach a real row, same reasoning as parseDocumentId. */
export function parseProjectId(id: string): string | null {
  const result = projectIdSchema.safeParse(id);
  return result.success ? result.data : null;
}

/**
 * §11 project list filters, parsed from URL search params — same
 * construction as schemas/activities.ts: sort column is whitelisted, never
 * interpolated raw into order(), everything else `.catch()`s to a safe
 * default.
 */
export const projectFiltersSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(statuses).nullable().catch(null),
  sort: z.enum(sortColumns).catch("updatedAt"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().positive().catch(1),
});

export function parseProjectsSearchParams(
  searchParams: Record<string, string | string[] | undefined>
) {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return projectFiltersSchema.parse({
    search: single(searchParams.search) ?? "",
    status: single(searchParams.status) ?? null,
    sort: single(searchParams.sort) ?? "updatedAt",
    direction: single(searchParams.dir) ?? "desc",
    page: single(searchParams.page) ?? "1",
  });
}

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
  description: z.string().trim().max(5000).nullable().catch(null),
  departmentId: z.uuid().nullable().catch(null),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectDraftSchema = createProjectSchema.extend({ id: z.uuid() });
export type UpdateProjectDraftInput = z.infer<typeof updateProjectDraftSchema>;

export const rejectProjectSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(1, { message: "reasonRequired" }).max(1000),
});
export type RejectProjectInput = z.infer<typeof rejectProjectSchema>;
