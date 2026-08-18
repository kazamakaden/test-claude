import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { AuditLogEntry } from "@/types/audit";

/**
 * Renders a before -> after change as plain text.
 *
 * The trigger stores only the columns that actually changed (0057), so this is
 * short by construction rather than by truncation here — deliberately, since
 * whole-row snapshots would have copied citizen_id, GPS and device
 * fingerprints into a table with a completely different access story from the
 * one they were revoked out of.
 */
function describeChange(entry: AuditLogEntry): string {
  const pick = (o: Record<string, unknown> | null, k: string) =>
    o && k in o ? String(o[k] ?? "—") : null;

  // Prefer the field the action is actually about; fall back to a compact dump.
  for (const key of ["role", "position", "status"]) {
    const from = pick(entry.beforeData, key);
    const to = pick(entry.afterData, key);
    if (from !== null || to !== null) return `${from ?? "—"} → ${to ?? "—"}`;
  }

  const source = entry.afterData ?? entry.beforeData;
  if (!source) return "—";
  return Object.entries(source)
    .map(([k, v]) => `${k}: ${String(v ?? "—")}`)
    .join(", ");
}

/**
 * Server Component — an audit log is read-only by definition, so nothing here
 * crosses the client boundary (§21/§23).
 */
export function AuditTable({
  rows,
  dict,
  lang,
}: {
  rows: AuditLogEntry[];
  dict: Dictionary;
  lang: Locale;
}) {
  const d = dict.audit;

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {d.empty}
      </p>
    );
  }

  const actionLabels = d.actions as Record<string, string | undefined>;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{d.columnTime}</TableHead>
            <TableHead>{d.columnActor}</TableHead>
            <TableHead>{d.columnAction}</TableHead>
            <TableHead>{d.columnEntity}</TableHead>
            <TableHead>{d.columnChange}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                <time dateTime={row.createdAt}>
                  {new Date(row.createdAt).toLocaleString(lang === "th" ? "th-TH" : "en-GB", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
              </TableCell>
              <TableCell className="text-sm">
                {/* actorEmail is the copy captured at write time, not a join:
                    deleting the actor must not blank the record naming them. */}
                {row.actorEmail ?? (
                  <span className="text-muted-foreground">{d.noSession}</span>
                )}
                {row.actorRole ? (
                  <span className="ml-2 text-xs text-muted-foreground">{row.actorRole}</span>
                ) : null}
              </TableCell>
              <TableCell>
                {/* Falls back to the raw action name rather than rendering
                    nothing: a new trigger added without a dictionary key must
                    still be legible here, since this is the page you read when
                    something has gone wrong. */}
                <Badge variant="outline">{actionLabels[row.action] ?? row.action}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.entityTable}
                {row.entityId ? (
                  <span className="ml-1 font-mono">{row.entityId.slice(0, 8)}</span>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">{describeChange(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
