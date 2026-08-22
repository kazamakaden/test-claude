import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ActivityCounts, ActivityStatus } from "@/types/activities";
import type { Dictionary } from "@/types/i18n";

function statusHref(pathname: string, searchParams: URLSearchParams, status: ActivityStatus) {
  const params = new URLSearchParams(searchParams.toString());
  if (params.get("status") === status) {
    params.delete("status");
  } else {
    params.set("status", status);
  }
  params.delete("page");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * §10 statistics strip. Completed/Pending double as filters (clicking sets
 * ?status=), so no fourth dropdown is needed — plain <Link>s, so this works
 * with JS disabled too. Attendance is not clickable (no matching status
 * value) and reads 0 for guests/students by design — see
 * services/activities.ts's getActivityCounts.
 */
export function ActivitiesStats({
  counts,
  activeStatus,
  pathname,
  searchParams,
  dict,
}: {
  counts: ActivityCounts;
  activeStatus: ActivityStatus | null;
  pathname: string;
  searchParams: URLSearchParams;
  dict: Dictionary;
}) {
  const d = dict.activities.stats;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <p className="text-2xl font-semibold text-foreground">{counts.attendance}</p>
        <p className="text-sm text-muted-foreground">{d.attendance}</p>
        <p className="mt-1 text-xs text-muted-foreground/80">{d.attendanceNote}</p>
      </div>
      <Link
        href={statusHref(pathname, searchParams, "completed")}
        className={cn(
          "rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-colors outline-none hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          activeStatus === "completed" && "border-primary bg-primary/5"
        )}
      >
        <p className="text-2xl font-semibold text-foreground">{counts.completed}</p>
        <p className="text-sm text-muted-foreground">{d.completed}</p>
      </Link>
      <Link
        href={statusHref(pathname, searchParams, "pending")}
        className={cn(
          "rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-colors outline-none hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          activeStatus === "pending" && "border-primary bg-primary/5"
        )}
      >
        <p className="text-2xl font-semibold text-foreground">{counts.pending}</p>
        <p className="text-sm text-muted-foreground">{d.pending}</p>
      </Link>
    </div>
  );
}
