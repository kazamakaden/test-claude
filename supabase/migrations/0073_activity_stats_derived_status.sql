-- Derive activity status from the clock in get_activity_stats(), matching the
-- app layer (lib/activity-status.ts).
--
-- activities.status is stored but NOTHING has ever written it: no form field,
-- no schema field, no service. createActivity leaves it at the column default
-- 'pending' forever. Measured live before this migration:
--
--   status     total  already_over
--   ---------  -----  ------------
--   pending        3             3   <- every "pending" activity had finished
--   completed      3             3
--   cancelled      1             1
--
-- So §10's Pending figure only ever grew and Completed never moved.
--
-- Deriving rather than adding a "mark completed" button is the same call this
-- project already made for ระดับ and the class label: a stored value that
-- depends on today's date is wrong the day after it is written, on every row,
-- silently.
--
-- 'cancelled' stays STORED and always wins, because it cannot be derived — a
-- cancelled event still has a start time in the past like any other.
--
-- This cannot be a generated column: now() is not IMMUTABLE. Hence the same
-- rule expressed twice, here and in TypeScript, which is a duplication worth
-- naming — if one changes the chart and the tiles beside it start disagreeing,
-- which is exactly the symptom 0072 was written to fix.
--
-- coalesce(ends_at, starts_at): an activity with no end time is over once it
-- has started, otherwise an open-ended entry would stay pending forever.
--
-- SECURITY INVOKER is preserved deliberately — the attendance series is
-- per-caller by design (see services/dashboard.ts AttendanceScope), and the
-- publish_status filter added in 0072 is kept.

create or replace function public.get_activity_stats()
returns table(month text, attendance bigint, completed bigint, pending bigint)
language sql
stable
set search_path to ''
as $function$
  select
    to_char(months.month, 'Mon') as month,
    coalesce(att.attendance_count, 0) as attendance,
    coalesce(act.completed_count, 0) as completed,
    coalesce(act.pending_count, 0) as pending
  from (
    select generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) as month
  ) months
  left join (
    select date_trunc('month', a.recorded_at) as month, count(*) as attendance_count
    from public.attendance a
    group by 1
  ) att on att.month = months.month
  left join (
    select
      date_trunc('month', a.starts_at) as month,
      count(*) filter (
        where a.status <> 'cancelled'
          and coalesce(a.ends_at, a.starts_at) < now()
      ) as completed_count,
      count(*) filter (
        where a.status <> 'cancelled'
          and coalesce(a.ends_at, a.starts_at) >= now()
      ) as pending_count
    from public.activities a
    where a.publish_status = 'published'
    group by 1
  ) act on act.month = months.month
  order by months.month;
$function$;
