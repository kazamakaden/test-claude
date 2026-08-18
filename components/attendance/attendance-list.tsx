import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { AttendanceRow } from "@/types/attendance";

/**
 * Who has checked in. Server Component — no interactivity, so nothing crosses
 * the client boundary (§21/§23).
 *
 * The §15 sensitive columns (GPS, device fingerprint, browser, IP) are absent
 * by design, not omitted for brevity: they are outside the `authenticated`
 * column allow-list (0008), so the query never asks for them. Reviewing
 * attendance does not require seeing where someone was standing.
 */
export function AttendanceList({
  rows,
  dict,
  lang,
}: {
  rows: AttendanceRow[];
  dict: Dictionary;
  lang: Locale;
}) {
  const d = dict.attendance.qr;

  const statusLabel: Record<AttendanceRow["status"], string> = {
    present: d.statusPresent,
    late: d.statusLate,
    absent: d.statusAbsent,
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-semibold text-foreground">
        {d.attendeesTitle}{" "}
        <span className="text-sm font-normal tabular-nums text-muted-foreground">
          ({rows.length})
        </span>
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {d.attendeesEmpty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.members.columnName}</TableHead>
                <TableHead>{dict.members.columnStudentId}</TableHead>
                <TableHead>{dict.members.columnClass}</TableHead>
                <TableHead>{dict.members.columnDepartment}</TableHead>
                <TableHead>{d.title}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.studentName ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{row.studentCode ?? "—"}</TableCell>
                  <TableCell>{row.className ?? "—"}</TableCell>
                  <TableCell>{row.departmentName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.status === "late" ? "outline" : "default"}>
                        {statusLabel[row.status]}
                      </Badge>
                      <time
                        dateTime={row.recordedAt}
                        className="text-xs tabular-nums text-muted-foreground"
                      >
                        {new Date(row.recordedAt).toLocaleTimeString(
                          lang === "th" ? "th-TH" : "en-GB",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </time>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
