import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  Project,
  ProjectFilters,
  ProjectsResult,
  ProjectStatus,
} from "@/types/projects";
import type { CreateProjectInput, UpdateProjectDraftInput, RejectProjectInput } from "@/schemas/projects";
import { PROJECTS_PER_PAGE_SIZE } from "@/schemas/projects";

/** §11 → snake_case column mapping, whitelisted so it's never interpolated raw into order(). */
const SORT_COLUMNS = {
  updatedAt: "updated_at",
  title: "title",
  status: "status",
} as const;

const PROJECT_COLUMNS =
  "id, title, description, status, owner_id, department_id, rejected_reason, created_at, updated_at, profiles(full_name), departments(name_th)";

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  department_id: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string | null } | null;
  departments: { name_th: string | null } | null;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    ownerId: row.owner_id,
    ownerName: row.profiles?.full_name ?? null,
    departmentId: row.department_id,
    departmentName: row.departments?.name_th ?? null,
    rejectedReason: row.rejected_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * A caller's own projects (any status, via RLS's projects_select_own) plus
 * every official project — deliberately narrower than what reviewers can
 * technically see (projects_select_reviewer is row-unscoped by status), so
 * a viewer's personal "My Projects" list isn't flooded with every other
 * student's private draft. RLS remains the actual security floor either way.
 */
export async function listMyProjects(
  ownerId: string,
  filters: ProjectFilters
): Promise<ProjectsResult> {
  const supabase = await createClient();
  const start = (filters.page - 1) * PROJECTS_PER_PAGE_SIZE;

  let query = supabase
    .from("projects")
    .select(PROJECT_COLUMNS, { count: "exact" })
    .or(`owner_id.eq.${ownerId},status.eq.official`);

  if (filters.search) {
    const q = filters.search.replace(/[%_]/g, "\\$&");
    query = query.ilike("title", `%${q}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query
    .order(SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc" })
    .range(start, start + PROJECTS_PER_PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };

  return { rows: (data as ProjectRow[]).map(toProject), total: count ?? 0 };
}

/** Reviewer queue for one stage — relies on projects_select_reviewer for the actual visibility grant. */
export async function listReviewProjects(
  stage: "teacher_review" | "admin_approval",
  filters: ProjectFilters
): Promise<ProjectsResult> {
  const supabase = await createClient();
  const start = (filters.page - 1) * PROJECTS_PER_PAGE_SIZE;

  let query = supabase
    .from("projects")
    .select(PROJECT_COLUMNS, { count: "exact" })
    .eq("status", stage);

  if (filters.search) {
    const q = filters.search.replace(/[%_]/g, "\\$&");
    query = query.ilike("title", `%${q}%`);
  }

  query = query
    .order(SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc" })
    .range(start, start + PROJECTS_PER_PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };

  return { rows: (data as ProjectRow[]).map(toProject), total: count ?? 0 };
}

/** No status filter (unlike the public documents reader) — RLS scopes visibility. */
export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return toProject(data as ProjectRow);
}

export async function createProjectDraft(
  input: CreateProjectInput,
  ownerId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      title: input.title,
      description: input.description,
      department_id: input.departmentId,
      owner_id: ownerId,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, id: data.id };
}

export async function updateProjectDraft(
  input: UpdateProjectDraftInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      title: input.title,
      description: input.description,
      department_id: input.departmentId,
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  // RLS silently returns zero rows rather than erroring when the caller
  // isn't allowed to touch this row (e.g. it's no longer 'draft') — a null
  // result here means "not found or not allowed", never inferred from
  // `error === null` alone.
  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}

async function transitionProject(
  id: string,
  patch: Database["public"]["Tables"]["projects"]["Update"]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}

export async function submitProjectDraft(id: string) {
  return transitionProject(id, { status: "teacher_review", rejected_reason: null });
}

export async function recommendProject(id: string) {
  return transitionProject(id, { status: "admin_approval" });
}

export async function approveProject(id: string) {
  return transitionProject(id, { status: "official" });
}

/**
 * Works at either review stage — RLS (the teacher policy, or aft_teacher/
 * admin's blanket policy) is what actually scopes which rows the caller
 * can touch; this function is stage-agnostic.
 */
export async function rejectProject(input: RejectProjectInput) {
  return transitionProject(input.id, { status: "draft", rejected_reason: input.reason });
}
