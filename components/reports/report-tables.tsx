import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { AttendanceReportRow, MemberReportRow, WorkflowReportRow } from "@/types/reports";
import { departmentOptionLabel } from "@/lib/student-id";

/**
 * All three tables are Server Components — a report is read-only, so nothing
 * crosses the client boundary (§21/§23).
 */

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

export function AttendanceReportTable({
  rows,
  dict,
  lang,
}: {
  rows: AttendanceReportRow[];
  dict: Dictionary;
  lang: Locale;
}) {
  const d = dict.reports;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.attendanceTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.columnActivity}</TableHead>
                <TableHead>{d.columnDate}</TableHead>
                <TableHead>{d.columnDepartment}</TableHead>
                <TableHead className="text-right">{d.columnPresent}</TableHead>
                <TableHead className="text-right">{d.columnLate}</TableHead>
                <TableHead className="text-right">{d.columnTotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={6} message={d.attendanceEmpty} />
              ) : (
                rows.map((row) => (
                  <TableRow key={row.activityId}>
                    <TableCell>{row.title}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      <time dateTime={row.startsAt}>
                        {new Date(row.startsAt).toLocaleDateString(
                          lang === "th" ? "th-TH" : "en-GB",
                          { dateStyle: "medium" }
                        )}
                      </time>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.departmentName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.presentCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.lateCount}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.totalCount}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function MemberReportTable({
  rows,
  dict,
}: {
  rows: MemberReportRow[];
  dict: Dictionary;
}) {
  const d = dict.reports;
  // Departments with nobody in them are the majority (30 registered สาขา, 5
  // real accounts), and 25 rows of zeroes bury the 5 that say something.
  const populated = rows.filter((r) => r.totalCount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.memberTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.columnDepartment}</TableHead>
                <TableHead className="text-right">{d.columnStudents}</TableHead>
                <TableHead className="text-right">{d.columnAft}</TableHead>
                <TableHead className="text-right">{d.columnTeachers}</TableHead>
                <TableHead className="text-right">{d.columnTotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {populated.length === 0 ? (
                <EmptyRow colSpan={5} message={d.memberEmpty} />
              ) : (
                populated.map((row) => (
                  <TableRow key={row.departmentId}>
                    <TableCell>
                      {departmentOptionLabel(
                        row.departmentCode,
                        row.departmentName,
                        dict.common.levels
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.studentCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.aftCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.teacherCount}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.totalCount}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkflowReportTable({
  rows,
  dict,
}: {
  rows: WorkflowReportRow[];
  dict: Dictionary;
}) {
  const d = dict.reports;
  const entityLabels = d.entities as Record<string, string | undefined>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.workflowTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.columnEntity}</TableHead>
                <TableHead>{d.columnStatus}</TableHead>
                <TableHead className="text-right">{d.columnCount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={3} message={d.workflowEmpty} />
              ) : (
                rows.map((row) => (
                  <TableRow key={`${row.entity}-${row.status}`}>
                    {/* Falls back to the raw name: a status added by a future
                        migration must stay legible rather than render blank. */}
                    <TableCell>{entityLabels[row.entity] ?? row.entity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.status}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.count}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
