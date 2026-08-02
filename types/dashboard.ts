import type { Permission } from "@/lib/auth/permissions";

export type NotificationType =
  | "meeting"
  | "activity"
  | "deadline"
  | "approval"
  | "announcement";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  createdAt: string;
  read: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  startsAt: string;
  location: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
}

/** §10 activity statistics categories. */
export interface ActivityStat {
  month: string;
  attendance: number;
  completed: number;
  pending: number;
}

/** §12 document workflow states. */
export type DocumentStatus = "draft" | "signed" | "pending_approval" | "official";

export interface DraftDocument {
  id: string;
  title: string;
  status: DocumentStatus;
  ownerName: string;
  updatedAt: string;
}

/** §11 project workflow states. */
export type ProjectStatus = "draft" | "teacher_review" | "admin_approval" | "official";

export interface RecentProject {
  id: string;
  title: string;
  status: ProjectStatus;
  updatedAt: string;
}

export interface RecentActivity {
  id: string;
  title: string;
  department: string;
  occurredAt: string;
}

export interface DepartmentStat {
  department: string;
  memberCount: number;
}

export interface QuickAction {
  key: string;
  href: string;
  permission?: Permission;
}
