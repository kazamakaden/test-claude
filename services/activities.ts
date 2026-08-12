import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import type {
  Activity,
  ActivityCounts,
  ActivityFilters,
  ActivitiesResult,
  MonthActivity,
} from "@/types/activities";
import { ACTIVITIES_PER_PAGE_SIZE } from "@/schemas/activities";
import type { CreateActivityInput, UpdateActivityInput } from "@/schemas/activities";

/**
 * §10 → snake_case column mapping. Whitelisted so an un-mapped column can
 * never be interpolated raw into order() — same pattern as
 * services/members.ts's SORT_COLUMNS.
 */
const SORT_COLUMNS = {
  startsAt: "starts_at",
  title: "title",
  status: "status",
} as const;

const ACTIVITY_COLUMNS =
  "id, title, description, status, starts_at, ends_at, location, is_public, academic_year, department_id, club_id, departments(name_th, name_en), clubs(name_th, name_en)";

export async function listActivities(filters: ActivityFilters): Promise<ActivitiesResult> {
  const supabase = await tryCreateClient();
  if (!supabase) return { rows: [], total: 0 };
  const start = (filters.page - 1) * ACTIVITIES_PER_PAGE_SIZE;

  let query = supabase.from("activities").select(ACTIVITY_COLUMNS, { count: "exact" });

  if (filters.search) {
    const q = filters.search.replace(/[%_]/g, "\\$&");
    query = query.ilike("title", `%${q}%`);
  }
  if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }
  if (filters.clubId) {
    query = query.eq("club_id", filters.clubId);
  }
  if (filters.academicYear !== null) {
    query = query.eq("academic_year", filters.academicYear);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query
    .order(SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc" })
    .range(start, start + ACTIVITIES_PER_PAGE_SIZE - 1);

  const { data, error, count } = await query;

  if (error || !data) return { rows: [], total: 0 };

  const rows: Activity[] = data.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    location: a.location,
    isPublic: a.is_public,
    academicYear: a.academic_year,
    departmentId: a.department_id,
    departmentName: a.departments?.name_th ?? null,
    clubId: a.club_id,
    clubName: a.clubs?.name_th ?? null,
  }));

  return { rows, total: count ?? 0 };
}

/**
 * §10 statistics strip. `attendance` reads 0 for guests/students by design —
 * it is empty until §13 QR attendance is live, and RLS (0008_dashboard_rls.sql)
 * scopes it to own-rows/reviewers regardless. Not a bug; the UI says so.
 */
export async function getActivityCounts(): Promise<ActivityCounts> {
  const supabase = await tryCreateClient();
  if (!supabase) return { attendance: 0, completed: 0, pending: 0 };

  const [attendanceResult, completedResult, pendingResult] = await Promise.all([
    supabase.from("attendance").select("id", { count: "exact", head: true }),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return {
    attendance: attendanceResult.count ?? 0,
    completed: completedResult.count ?? 0,
    pending: pendingResult.count ?? 0,
  };
}

/**
 * Feeds both /calendar and the dashboard's calendar card. tryCreateClient()
 * (not createClient()) — this is a read-only list fetcher meant to fail
 * soft, same convention already applied to listBooks/getBookYears/
 * getMembers in prior passes, so a missing/unreachable Supabase config
 * degrades this card to "no events" instead of the card's CardBoundary
 * having to catch a synchronous client-construction throw.
 */
export async function getMonthActivities(month: Date): Promise<MonthActivity[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];
  const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();

  const { data, error } = await supabase
    .from("activities")
    .select("id, title, description, starts_at, ends_at, location")
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at", { ascending: true });

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    location: a.location,
  }));
}

/**
 * Combines a plain `date` + `HH:mm` into a real instant, anchored to
 * Asia/Bangkok explicitly (+07:00) rather than the server runtime's own
 * timezone (Vercel's Node runtime defaults to UTC) — without this, a staff
 * member typing "09:00" would store a timestamp that renders as 09:00 only
 * by accident of where the server happens to run, and as 16:00 Bangkok
 * time on a UTC runtime.
 */
function toBangkokInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

/**
 * Dashboard calendar day-sheet create (activity:manage — enforced by RLS's
 * activities_insert_aft_teacher/activities_all_admin, 0008/0011, not just
 * this function). `status` stays at its `'pending'` column default;
 * `is_public` defaults true here — an activity created from the dashboard
 * calendar is the org-wide case this quick form targets, matching what a
 * guest browsing /calendar or /activities would expect to find. Nothing in
 * the current UI offers an is_public toggle; a richer creation flow can add
 * one later without a schema change.
 */
export async function createActivity(
  input: CreateActivityInput,
  createdBy: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .insert({
      title: input.title,
      starts_at: toBangkokInstant(input.date, input.startTime),
      ends_at: input.endTime ? toBangkokInstant(input.date, input.endTime) : null,
      location: input.location,
      description: input.description,
      is_public: true,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, id: data.id };
}

export async function updateActivity(
  input: UpdateActivityInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update({
      title: input.title,
      starts_at: toBangkokInstant(input.date, input.startTime),
      ends_at: input.endTime ? toBangkokInstant(input.date, input.endTime) : null,
      location: input.location,
      description: input.description,
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}

export async function deleteActivity(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("activities").delete().eq("id", id).select("id").maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}
