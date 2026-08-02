import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Activity,
  ActivityCounts,
  ActivityFilters,
  ActivitiesResult,
  MonthActivity,
} from "@/types/activities";
import { ACTIVITIES_PER_PAGE_SIZE } from "@/schemas/activities";

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
  const supabase = await createClient();
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
  const supabase = await createClient();

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

/** Feeds both /calendar and the dashboard's calendar card. */
export async function getMonthActivities(month: Date): Promise<MonthActivity[]> {
  const supabase = await createClient();
  const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();

  const { data, error } = await supabase
    .from("activities")
    .select("id, title, starts_at, location")
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at", { ascending: true });

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    title: a.title,
    startsAt: a.starts_at,
    location: a.location,
  }));
}
