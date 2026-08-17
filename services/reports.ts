import "server-only";
import { tryCreateClient } from "@/lib/supabase/server";
import type { ReportFilters } from "@/schemas/reports";
import type {
  AttendanceReportRow,
  MemberReportRow,
  WorkflowReportRow,
} from "@/types/reports";

/**
 * §18 reports — read-only, staff-only.
 *
 * Each function is a thin wrapper over an RPC that performs its OWN staff
 * check (assert_report_viewer, 0058). That duplication with the page's
 * requirePermission is deliberate: the RPCs are reachable directly over REST,
 * so they cannot assume the page ran, and the page's guard exists to give an
 * unauthorised viewer a redirect instead of an empty table.
 *
 * tryCreateClient() throughout — these are read-only list fetchers and should
 * fail soft to empty rather than throw above the page's own boundary, the same
 * convention listBooks/getMembers/getMonthActivities already follow.
 */

/**
 * Dates arrive as YYYY-MM-DD from <input type="date">. They are anchored to
 * +07:00 (Asia/Bangkok) rather than parsed in the server's timezone, which on
 * Vercel is UTC — without this, "activities on 1 August" would silently mean
 * 07:00 on the 1st to 07:00 on the 2nd for a Thai reader. Same reasoning as
 * services/activities.ts#toBangkokInstant.
 */
function bangkokDayStart(date: string): string {
  return `${date}T00:00:00+07:00`;
}

export async function getAttendanceReport(
  filters: ReportFilters
): Promise<AttendanceReportRow[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_attendance_report", {
    p_from: filters.from ? bangkokDayStart(filters.from) : undefined,
    // Exclusive upper bound in SQL (`starts_at < p_to`), so "to 31 August"
    // must mean the start of 1 September or the last day drops out of every
    // report — an off-by-one a reader would never see, only under-count.
    p_to: filters.to ? bangkokDayStart(nextDay(filters.to)) : undefined,
    p_department_id: filters.departmentId ?? undefined,
  });

  if (error || !data) return [];

  return data.map((r) => ({
    activityId: r.activity_id,
    title: r.title,
    startsAt: r.starts_at,
    departmentName: r.department_name,
    presentCount: Number(r.present_count),
    lateCount: Number(r.late_count),
    totalCount: Number(r.total_count),
  }));
}

/** Date-only arithmetic, kept off Date parsing so no timezone can shift it. */
function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

export async function getMemberReport(): Promise<MemberReportRow[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_member_report");
  if (error || !data) return [];

  return data.map((r) => ({
    departmentId: r.department_id,
    departmentCode: r.department_code,
    departmentName: r.department_name,
    studentCount: Number(r.student_count),
    aftCount: Number(r.aft_count),
    teacherCount: Number(r.teacher_count),
    totalCount: Number(r.total_count),
  }));
}

export async function getWorkflowReport(): Promise<WorkflowReportRow[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_workflow_report");
  if (error || !data) return [];

  return data.map((r) => ({
    entity: r.entity,
    status: r.status,
    count: Number(r.count),
  }));
}
