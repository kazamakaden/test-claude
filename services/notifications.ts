import "server-only";

import { tryCreateClient } from "@/lib/supabase/server";
import { NOTIFICATIONS_PER_PAGE } from "@/schemas/notifications";
import type {
  AppNotification,
  NotificationFilters,
  NotificationsResult,
  NotificationType,
} from "@/types/notifications";

/**
 * All reads go through the 0037/0038 RPCs rather than `.from("notifications")`.
 *
 * Two reasons, both load-bearing:
 *   * Read state lives in notification_reads, so `read` is a left-join result,
 *     not a column — there is nothing to select.
 *   * notifications_all_admin (0008) makes RLS match *every* row for an admin,
 *     so "my notifications" has to be scoped in the query itself. The RPCs do
 *     that; a plain select would quietly show an admin everyone else's mail.
 *
 * `tryCreateClient()` (not `createClient()`) for the same reason every other
 * read path in this codebase uses it: an unconfigured environment should reach
 * the empty state, not throw synchronously above its own error boundary.
 */

interface RpcRow {
  id: string;
  type: NotificationType;
  title: string;
  message_key: string | null;
  message_params: unknown;
  link: string | null;
  created_at: string;
  read: boolean;
  total_count: number;
}

/** jsonb is `unknown` at the type boundary; keep only string-valued entries. */
function toParams(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
    }
  }
  return out;
}

function toNotification(row: RpcRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    messageKey: row.message_key,
    messageParams: toParams(row.message_params),
    link: row.link,
    createdAt: row.created_at,
    read: row.read,
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await tryCreateClient();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc("get_unread_notification_count");
  if (error || typeof data !== "number") return 0;

  return data;
}

export async function listNotifications(
  filters: NotificationFilters
): Promise<NotificationsResult> {
  const supabase = await tryCreateClient();
  if (!supabase) return { rows: [], total: 0 };

  const { data, error } = await supabase.rpc("list_notifications", {
    p_unread_only: filters.filter === "unread",
    p_limit: NOTIFICATIONS_PER_PAGE,
    p_offset: (filters.page - 1) * NOTIFICATIONS_PER_PAGE,
  });

  if (error || !data) return { rows: [], total: 0 };

  const rows = data as RpcRow[];

  // total_count is repeated on every row by the RPC; an empty page carries no
  // row to read it from, which correctly means zero results for this filter.
  return {
    rows: rows.map(toNotification),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

/** The dashboard card's short preview list. */
export async function getRecentNotifications(
  limit = 5
): Promise<AppNotification[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("list_notifications", {
    p_unread_only: false,
    p_limit: limit,
    p_offset: 0,
  });

  if (error || !data) return [];

  return (data as RpcRow[]).map(toNotification);
}
