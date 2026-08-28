import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import {
  effectiveActivityStatus,
  finishedOrFilter,
  upcomingOrFilter,
} from "@/lib/activity-status";
import type {
  Activity,
  ActivityBanner,
  ActivityCounts,
  ActivityDetail,
  ActivityEditor,
  ActivityFilters,
  ActivitiesResult,
  MonthActivity,
} from "@/types/activities";
import { ACTIVITIES_PER_PAGE_SIZE } from "@/schemas/activities";
import type { CreateActivityInput, UpdateActivityInput, PublishActivityInput } from "@/schemas/activities";

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
  // One instant for the filter and the mapping below, so a row cannot be
  // selected as pending and then rendered as completed.
  const now = new Date();
  const nowIso = now.toISOString();

  // Published only. RLS is NOT the filter here: staff hold activities_select_staff
  // as well as the public policy, and permissive policies OR together, so leaning
  // on RLS alone would list a staff member's own unpublished drafts on this page
  // — mixed in with real entries, unbadged, and counted in the pagination total.
  // Same reason listPublishedBanners() filters status explicitly (0065). The one
  // surface that SHOULD show drafts is the calendar (getMonthActivities), which
  // selects publish_status and badges them.
  let query = supabase
    .from("activities")
    .select(ACTIVITY_COLUMNS, { count: "exact" })
    .eq("publish_status", "published");

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
  // Status is DERIVED from the clock (lib/activity-status.ts), so the filter has
  // to ask the same question the rendered badge answers -- filtering on the
  // stored column would return rows that then render as something else.
  if (filters.status === "cancelled") {
    query = query.eq("status", "cancelled");
  } else if (filters.status === "completed") {
    query = query.neq("status", "cancelled").or(finishedOrFilter(nowIso));
  } else if (filters.status === "pending") {
    query = query.neq("status", "cancelled").or(upcomingOrFilter(nowIso));
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
    status: effectiveActivityStatus(a.status, a.starts_at, a.ends_at, now),
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
  const nowIso = new Date().toISOString();

  const [attendanceResult, completedResult, pendingResult] = await Promise.all([
    supabase.from("attendance").select("id", { count: "exact", head: true }),
    // publish_status filter for the same reason as listActivities above: an
    // unpublished draft is not a pending activity, and counting one here makes
    // the stat tile disagree with the table it sits above.
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("publish_status", "published")
      .neq("status", "cancelled")
      .or(finishedOrFilter(nowIso)),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("publish_status", "published")
      .neq("status", "cancelled")
      .or(upcomingOrFilter(nowIso)),
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
    .select("id, title, description, starts_at, ends_at, location, category, publish_status")
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
    category: a.category,
    publishStatus: a.publish_status,
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
 * activities_write_staff, 0061, not just this function). `status` stays at its
 * `'pending'` column default.
 *
 * NEITHER `is_public` NOR `publish_status` IS PASSED, and that is the feature.
 * 0068 removed is_public from the INSERT grant and defaults publish_status to
 * 'draft', so every entry created here is a draft by construction — the
 * database decides it, not this function. It used to hardcode `is_public: true`,
 * which is why there was no draft step at all.
 *
 * Publishing is publishActivity() below, behind an explicit confirmation.
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
      category: input.category,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, id: data.id };
}

/**
 * The confirmation step: draft -> published, and optionally public.
 *
 * `.select().maybeSingle()` is load-bearing, not decoration. RLS FILTERS an
 * UPDATE rather than raising, so a refused statement returns success affecting
 * zero rows — reading the row back is the only way to tell "published" from
 * "silently did nothing". Same shape as services/site-banners.ts#publishBanner.
 *
 * Both columns move in ONE statement because 0068's
 * activities_public_needs_published CHECK refuses a public draft, so setting
 * them separately would fail on whichever went first.
 *
 * The staff-only rule is NOT enforced here: activities_publish_guard (0068)
 * raises 42501 for a non-staff caller, including an owner who has since been
 * demoted — a case RLS cannot express, because a WITH CHECK clause never sees
 * the OLD row.
 */
export async function publishActivity(
  input: PublishActivityInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update({ publish_status: "published", is_public: input.isPublic })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not found or not allowed" };
  return { ok: true };
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

// ---------------------------------------------------------------------------
// Activity detail page (0061-0063)

const BANNER_BUCKET = "activity-banners";

/**
 * One activity plus its banners, and whether the viewer may edit it.
 *
 * `canEdit` comes from the can_edit_activity() RPC (0061) rather than being
 * recomputed here, so the UI and the RLS policies cannot drift: the same
 * function backs both. It is a UI hint only -- every write is re-checked by the
 * database, which is where the boundary actually lives.
 */
export async function getActivityDetail(id: string): Promise<ActivityDetail | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("activities")
    .select("id, title, description, status, starts_at, ends_at, location, is_public, publish_status, academic_year, department_id, club_id, created_by, expected_attendees, departments(name_th, name_en), clubs(name_th, name_en)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const [{ data: bannerRows }, { data: canEdit }] = await Promise.all([
    supabase
      .from("activity_banners")
      .select("id, storage_path, sort_order")
      .eq("activity_id", id)
      .order("sort_order", { ascending: true }),
    supabase.rpc("can_edit_activity", { p_activity_id: id }),
  ]);

  const banners: ActivityBanner[] = (bannerRows ?? []).map((b) => ({
    id: b.id,
    storagePath: b.storage_path,
    // getPublicUrl is a pure string build, not a network call -- the bucket is
    // public (0063), so there is no signing round trip per image the way
    // services/books.ts needs for its private buckets.
    url: supabase.storage.from(BANNER_BUCKET).getPublicUrl(b.storage_path).data.publicUrl,
    sortOrder: b.sort_order,
  }));

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: effectiveActivityStatus(data.status, data.starts_at, data.ends_at),
    publishStatus: data.publish_status,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    location: data.location,
    isPublic: data.is_public,
    academicYear: data.academic_year,
    departmentId: data.department_id,
    departmentName: data.departments?.name_th ?? null,
    clubId: data.club_id,
    clubName: data.clubs?.name_th ?? null,
    createdBy: data.created_by,
    expectedAttendees: data.expected_attendees,
    banners,
    canEdit: canEdit === true,
  };
}

/**
 * Who else may edit this activity. Returns [] for a viewer who cannot see the
 * grants: activity_editors_select (0061) shows a row to its subject, the
 * owner, and admins -- nobody else -- so this needs no role check of its own.
 */
export async function getActivityEditors(activityId: string): Promise<ActivityEditor[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("activity_editors")
    .select("user_id, created_at, profiles!activity_editors_user_id_fkey(full_name, student_id)")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((r) => ({
    userId: r.user_id,
    fullName: r.profiles?.full_name ?? null,
    studentCode: r.profiles?.student_id ?? null,
    createdAt: r.created_at,
  }));
}

/** Records an uploaded banner. Writes use createClient(): a write with no real client SHOULD throw. */
export async function addActivityBanner(
  activityId: string,
  storagePath: string,
  uploadedBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  // The next free slot. 0063 caps sort_order at 0..9 and makes
  // (activity_id, sort_order) unique, so an 11th photo is refused by the index
  // rather than by a count this code would have to keep in sync.
  const { data: existing } = await supabase
    .from("activity_banners")
    .select("sort_order")
    .eq("activity_id", activityId)
    .order("sort_order", { ascending: true });

  const taken = new Set((existing ?? []).map((r) => r.sort_order));
  let slot = -1;
  for (let i = 0; i < 10; i += 1) {
    if (!taken.has(i)) { slot = i; break; }
  }
  if (slot === -1) return { ok: false, error: "bannerLimit" };

  const { error } = await supabase
    .from("activity_banners")
    .insert({ activity_id: activityId, storage_path: storagePath, sort_order: slot, uploaded_by: uploadedBy });

  if (error) return { ok: false, error: error.code === "23514" || error.code === "23505" ? "bannerLimit" : "unknown" };
  return { ok: true };
}

/** Removes a banner row and its object. */
export async function removeActivityBanner(
  bannerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_banners")
    .delete()
    .eq("id", bannerId)
    .select("storage_path")
    .maybeSingle();

  if (error) return { ok: false, error: "unknown" };
  // Zero rows means RLS filtered it -- a DELETE the policy forbids succeeds
  // affecting nothing rather than raising, so this must be read as a refusal.
  if (!data) return { ok: false, error: "forbidden" };

  // Best-effort, after the row is gone: an orphaned object is recoverable,
  // a row pointing at a deleted object renders as a broken image.
  await supabase.storage.from(BANNER_BUCKET).remove([data.storage_path]);
  return { ok: true };
}

/** Grants edit rights. The database enforces owner-only granting and staff-only grantees (0061). */
export async function addActivityEditor(
  activityId: string,
  userId: string,
  grantedBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("activity_editors")
    .insert({ activity_id: activityId, user_id: userId, granted_by: grantedBy });

  if (!error) return { ok: true };
  // 42501 covers both the RLS refusal (not the owner) and the staff-role
  // trigger; 23514 is the owner-is-already-an-editor guard; 23505 a duplicate.
  if (error.code === "23505") return { ok: false, error: "alreadyEditor" };
  if (error.code === "23514") return { ok: false, error: "ownerAlreadyEdits" };
  if (error.code === "42501") return { ok: false, error: "notStaffOrForbidden" };
  return { ok: false, error: "unknown" };
}

export async function removeActivityEditor(
  activityId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_editors")
    .delete()
    .eq("activity_id", activityId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (error) return { ok: false, error: "unknown" };
  if (!data) return { ok: false, error: "forbidden" };
  return { ok: true };
}

/** The denominator for the event attendance %. Null clears it (show counts only). */
export async function updateExpectedAttendees(
  activityId: string,
  expected: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update({ expected_attendees: expected })
    .eq("id", activityId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "unknown" };
  // RLS filters an UPDATE it forbids rather than raising, so zero rows back is
  // a refusal, not a no-op.
  if (!data) return { ok: false, error: "forbidden" };
  return { ok: true };
}
