import type { NotificationType } from "@/types/dashboard";

export type { NotificationType };

/**
 * A notification as the app renders it, not as the row is stored.
 *
 * `read` is derived, not a column — 0037 dropped `notifications.read` and
 * moved read state into `notification_reads`, one row per (notification,
 * user), because a broadcast row is shared by everyone and a single boolean
 * on it could never be per-user.
 *
 * `messageKey`/`messageParams` come from the 0036 trigger writes and render
 * through the reader's own dictionary; `title` is the fallback for
 * free-text/announcement rows, which carry no key.
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  messageKey: string | null;
  messageParams: Record<string, string>;
  link: string | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationsResult {
  rows: AppNotification[];
  total: number;
}

export type NotificationFilter = "all" | "unread";

export interface NotificationFilters {
  filter: NotificationFilter;
  page: number;
}
