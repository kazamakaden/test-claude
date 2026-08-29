import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AttendeeRowActions } from "@/components/activities/attendee-row-actions";
import type { AttendanceRow } from "@/types/attendance";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDate } from "@/lib/datetime";

const STATUS_VARIANT = {
  present: "default",
  late: "secondary",
  absent: "destructive",
} as const;

/**
 * The attendee list.
 *
 * Search is a plain GET <form> writing ?q= into the URL, not a debounced
 * client input: it works with JavaScript disabled (§30.9 item 3), the result is
 * shareable, and the filtering happens in SQL with the wildcards escaped
 * (services/attendance.ts).
 *
 * `method` is a column rather than a detail, because a QR scan and a staff
 * assertion are not equally strong evidence -- and only the latter can be
 * undone, which is why the remove control appears on manual rows alone.
 */
export function AttendeeTable({
  rows,
  activityId,
  search,
  canManage,
  isGuest,
  lang,
  dict,
}: {
  rows: AttendanceRow[];
  activityId: string;
  search: string;
  canManage: boolean;
  isGuest: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.activities.attendees;
  const locale = lang === "th" ? th : enUS;

  return (
    <div className="flex flex-col gap-4">
      <form method="GET" className="flex flex-wrap items-center gap-2">
        <label htmlFor="attendee-search" className="sr-only">
          {d.search}
        </label>
        <Input
          id="attendee-search"
          type="search"
          name="q"
          defaultValue={search}
          placeholder={d.search}
          className="max-w-xs"
        />
        <noscript>
          <button type="submit" className="text-sm underline underline-offset-4">
            {d.search}
          </button>
        </noscript>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {isGuest ? d.guestNote : search ? d.emptySearch : d.empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.columnName}</TableHead>
                <TableHead>{d.columnCode}</TableHead>
                <TableHead>{d.columnClass}</TableHead>
                <TableHead>{d.columnDepartment}</TableHead>
                <TableHead>{d.columnStatus}</TableHead>
                <TableHead>{d.columnMethod}</TableHead>
                <TableHead>{d.columnTime}</TableHead>
                {canManage && <TableHead className="sr-only">{d.remove}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.studentName ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.studentCode ?? "—"}</TableCell>
                  <TableCell>{r.className ?? "—"}</TableCell>
                  <TableCell>{r.departmentName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status]}>
                      {dict.activities.dashboard[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dict.activities.method[r.method]}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(bangkokDate(r.recordedAt), "d MMM HH:mm", { locale })}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <AttendeeRowActions
                        activityId={activityId}
                        studentId={r.studentId}
                        studentName={r.studentName}
                        method={r.method}
                        lang={lang}
                        dict={dict}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
