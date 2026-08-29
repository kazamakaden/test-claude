import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityAttendanceStats } from "@/types/attendance";
import type { Dictionary } from "@/types/i18n";

/**
 * This event's attendance figures.
 *
 * The percentage is checked-in / expected_attendees, and renders ONLY when the
 * owner has stated an expectation. There is no enrolment table in this schema,
 * so the obvious denominator -- the number of attendance rows -- would make the
 * figure checked-in/checked-in, i.e. 100%, always. A number that is always 100%
 * is worse than no number.
 *
 * The counts describe what the VIEWER may see: attendance_select_own vs
 * attendance_select_reviewer (0008/0049) already scope the rows, so a student
 * sees their own row and staff see all, with no second rule in TypeScript.
 */
export function AttendanceSummary({
  stats,
  dict,
  children,
}: {
  stats: ActivityAttendanceStats;
  dict: Dictionary;
  /** Slot for the owner-only control that sets `expected` (ExpectedAttendeesForm). */
  children?: React.ReactNode;
}) {
  const d = dict.activities.dashboard;

  const pct =
    stats.expected && stats.expected > 0
      ? Math.min(100, Math.round((stats.total / stats.expected) * 100))
      : null;

  const tiles = [
    { label: d.present, value: stats.present },
    { label: d.late, value: stats.late },
    { label: d.viaQr, value: stats.viaQr },
    { label: d.viaManual, value: stats.viaManual },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-heading text-4xl font-semibold tabular-nums text-foreground">
            {stats.total}
          </span>
          <span className="text-sm text-muted-foreground">{d.checkedIn}</span>
          {pct !== null ? (
            <span className="text-sm text-muted-foreground">
              · {pct}% {d.ofExpected.replace("{expected}", String(stats.expected))}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">· {d.noExpected}</span>
          )}
        </div>

        {pct !== null && (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={d.heading}
          >
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className="mt-1 font-heading text-xl font-semibold tabular-nums text-foreground">
                {t.value}
              </dd>
            </div>
          ))}
        </dl>

        {children}
      </CardContent>
    </Card>
  );
}
