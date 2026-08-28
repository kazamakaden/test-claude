import type { ActivityStatus } from "@/types/activities";

/**
 * An activity's status as shown to people, derived from the clock.
 *
 * `activities.status` is stored, but NOTHING in the app has ever written it:
 * there is no form field, no schema field and no service that sets it, so
 * createActivity leaves it at the column default 'pending' forever. Live, all
 * three published "pending" activities had already finished — so §10's Pending
 * tile only ever grew and Completed never moved.
 *
 * Deriving rather than adding a "mark as completed" button is the same call
 * this project already made for ระดับ and the class label: a stored value that
 * depends on today's date is wrong the day after it is written, on every row,
 * silently. An end time that has passed is not an opinion someone has to
 * remember to record.
 *
 * `cancelled` is the exception and stays STORED, because it cannot be derived —
 * a cancelled event still has a start time in the past like any other. It
 * therefore always wins over the clock.
 *
 * A generated column cannot express this: `now()` is not IMMUTABLE. So the
 * derivation lives here for display and in matching SQL predicates for
 * filtering and counting — see activityTimePredicate below and 0073's
 * get_activity_stats().
 */
export function effectiveActivityStatus(
  stored: ActivityStatus,
  startsAt: string,
  endsAt: string | null,
  now: Date = new Date()
): ActivityStatus {
  if (stored === "cancelled") return "cancelled";
  // Fall back to starts_at when there is no end time: a one-moment event is
  // over once it has started. Without this an open-ended activity would stay
  // pending forever, which is the bug this function exists to remove.
  const finished = new Date(endsAt ?? startsAt).getTime() < now.getTime();
  return finished ? "completed" : "pending";
}

/**
 * The PostgREST `.or()` string matching the "already finished" half above, so a
 * filter and a count agree with what the row will render as.
 *
 * Expressed as an `or` rather than `coalesce(ends_at, starts_at) < now()`
 * because PostgREST cannot filter on an expression, and passing the instant in
 * from the caller keeps "now" identical across the several queries one page
 * makes — otherwise a row could be counted pending and listed completed.
 */
export function finishedOrFilter(nowIso: string): string {
  return `ends_at.lt.${nowIso},and(ends_at.is.null,starts_at.lt.${nowIso})`;
}

/**
 * The exact complement of finishedOrFilter — "has not ended yet".
 *
 * Written as its own positive predicate rather than as a negation of the one
 * above: PostgREST's `.not()` takes (column, operator, value) and cannot wrap
 * an `or` group, and `lt` here against `gte` there partitions the timeline with
 * no gap and no overlap, so no row can be counted in both or neither.
 */
export function upcomingOrFilter(nowIso: string): string {
  return `ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${nowIso})`;
}
