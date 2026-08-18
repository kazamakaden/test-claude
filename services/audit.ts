import "server-only";
import { tryCreateClient } from "@/lib/supabase/server";
import { AUDIT_PER_PAGE_SIZE, type AuditFilters } from "@/schemas/audit";
import type { AuditLogEntry, AuditLogsResult } from "@/types/audit";

/**
 * §19 audit trail — read only. There is deliberately no write function here
 * and there never should be: rows are produced exclusively by the 0057
 * triggers, which is what makes the trail unforgeable by application code
 * (including this file).
 *
 * RLS admits only `admin` to SELECT (audit_logs_select_admin, 0057), so this
 * needs no role filter of its own — but the page still calls
 * requirePermission("system:manage") so a non-admin gets a redirect rather
 * than a confusing empty table.
 */
export async function listAuditLogs(filters: AuditFilters): Promise<AuditLogsResult> {
  const supabase = await tryCreateClient();
  if (!supabase) return { rows: [], total: 0 };

  const start = (filters.page - 1) * AUDIT_PER_PAGE_SIZE;

  let query = supabase
    .from("audit_logs")
    .select(
      "id, actor_id, actor_email, actor_role, action, entity_table, entity_id, before_data, after_data, created_at",
      { count: "exact" }
    );

  if (filters.action) {
    // Escaped before ilike, same as services/members.ts:65 -- an unescaped %
    // or _ in a filter silently widens the match.
    const q = filters.action.replace(/[%_]/g, "\\$&");
    query = query.ilike("action", `%${q}%`);
  }
  if (filters.entityTable) {
    query = query.eq("entity_table", filters.entityTable);
  }

  const { data, error, count } = await query
    // Newest first, always. See schemas/audit.ts for why this is not a
    // caller-selectable sort.
    .order("id", { ascending: false })
    .range(start, start + AUDIT_PER_PAGE_SIZE - 1);

  if (error || !data) return { rows: [], total: 0 };

  const rows: AuditLogEntry[] = data.map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorEmail: r.actor_email,
    actorRole: r.actor_role,
    action: r.action,
    entityTable: r.entity_table,
    entityId: r.entity_id,
    beforeData: (r.before_data ?? null) as Record<string, unknown> | null,
    afterData: (r.after_data ?? null) as Record<string, unknown> | null,
    createdAt: r.created_at,
  }));

  return { rows, total: count ?? 0 };
}

/** The distinct action names present, for the filter dropdown. */
export async function getAuditActions(): Promise<string[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("audit_logs").select("action");
  if (error || !data) return [];

  return [...new Set(data.map((r) => r.action))].sort();
}
