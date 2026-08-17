/** §19 audit trail. Read-only in the app — nothing here has a write shape. */
export interface AuditLogEntry {
  id: number;
  /**
   * Null for anything done without a signed-in session: a migration, a
   * service-role script, a cascade. Meaningful ("no session"), not missing.
   */
  actorId: string | null;
  /** Captured at write time, so deleting the actor cannot blank the record. */
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityTable: string;
  entityId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogsResult {
  rows: AuditLogEntry[];
  total: number;
}
