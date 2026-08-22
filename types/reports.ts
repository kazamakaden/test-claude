/**
 * §18 reports. Every shape here comes from a SECURITY DEFINER RPC with an
 * explicit staff check (0058), so unlike the dashboard's activity chart these
 * figures mean the same thing for every reader.
 */

export interface AttendanceReportRow {
  activityId: string;
  title: string;
  startsAt: string;
  departmentName: string | null;
  presentCount: number;
  lateCount: number;
  totalCount: number;
}

export interface MemberReportRow {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  studentCount: number;
  aftCount: number;
  teacherCount: number;
  totalCount: number;
}

export interface WorkflowReportRow {
  entity: string;
  status: string;
  count: number;
}
