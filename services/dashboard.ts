import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/permissions";
import { getRole } from "@/lib/auth/get-role";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";
import type {
  ActivityStat,
  DepartmentStat,
  DraftDocument,
  Meeting,
  QuickAction,
  RecentActivity,
  RecentProject,
} from "@/types/dashboard";

// No dedicated meetings table (§20) — derived from activities.
export async function getUpcomingMeetings(): Promise<Meeting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("id, title, starts_at, location")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(5);

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    title: a.title,
    startsAt: a.starts_at,
    location: a.location ?? "",
  }));
}

// §10 activity statistics, aggregated in SQL — see get_activity_stats() (0009).
export async function getActivityStats(): Promise<ActivityStat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_activity_stats");

  if (error || !data) return [];

  return data.map((row) => ({
    month: row.month,
    attendance: row.attendance,
    completed: row.completed,
    pending: row.pending,
  }));
}

// §12 document workflow. Explicit column list — never select("*").
export async function getDraftDocuments(role: Role): Promise<DraftDocument[]> {
  const supabase = await createClient();
  // document:approve, not project:draft:review — that permission gates
  // *project* drafts, an unrelated table; this card is about documents.
  const isReviewer = can(role, "document:approve");

  let query = supabase
    .from("documents")
    .select("id, title, status, updated_at, profiles(full_name)")
    .order("updated_at", { ascending: false })
    .limit(5);

  query = isReviewer ? query.eq("status", "pending_approval") : query;

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    ownerName: d.profiles?.full_name ?? "—",
    updatedAt: d.updated_at,
  }));
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    updatedAt: p.updated_at,
  }));
}

export async function getRecentActivities(): Promise<RecentActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("id, title, starts_at, departments(name_th)")
    .order("starts_at", { ascending: false })
    .limit(5);

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    title: a.title,
    department: a.departments?.name_th ?? "—",
    occurredAt: a.starts_at,
  }));
}

// §9 member counts per department, aggregated in SQL — see get_member_stats()
// (0009). Reviewer-only (teacher/aft_teacher/admin) — enforced here, not just
// in the page (§19). "project:draft:review" is the existing reviewer
// predicate (every role above student holds it), reused rather than a direct
// role comparison so a future role tier doesn't have to touch this file.
// redirect() throws a Next.js control-flow signal that must propagate
// uncaught.
export async function getMemberStats(lang: Locale): Promise<DepartmentStat[]> {
  const role = await getRole();
  if (!can(role, "project:draft:review")) {
    redirect(`/${lang}/login`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_member_stats");

  if (error || !data) return [];

  return data.map((row) => ({
    department: row.department,
    memberCount: row.member_count,
  }));
}

const allQuickActions: QuickAction[] = [
  { key: "submitDraft", href: "/projects", permission: "project:draft:submit" },
  // "Scan attendance QR" deliberately absent: §13 QR attendance is unbuilt
  // (no qr_sessions table, no scanner, and nothing anywhere writes to
  // `attendance`). It previously linked to /activities, promising a
  // scanner and delivering a plain table. Re-add it with that phase.
  { key: "signDocument", href: "/documents/manage", permission: "document:sign" },
  { key: "reviewDrafts", href: "/projects/review", permission: "project:draft:review" },
  // Quick Actions is a workspace-only card (dashboard is behind (app)), so
  // this doesn't need to consider guests — but the /members directory
  // itself is now public. member:approve is the right gate here since it's
  // aft_teacher + admin who can actually act on a member from that page;
  // member:manage would wrongly hide this for aft_teacher.
  { key: "manageMembers", href: "/members", permission: "member:approve" },
];

export function getQuickActions(role: Role): QuickAction[] {
  return allQuickActions.filter(
    (action) => action.permission === undefined || can(role, action.permission)
  );
}
