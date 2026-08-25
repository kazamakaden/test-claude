-- Stop get_activity_stats() and search_all() counting/returning drafts.
--
-- These are the last two places 0068's draft lifecycle leaked through. The
-- app-layer half was fixed by the commit before this one -- listActivities,
-- getActivityCounts, getUpcomingMeetings and getRecentActivities all filter
-- publish_status now -- but that fix was found by grepping TypeScript, which
-- cannot see either of these:
--
--   get_activity_stats()  aggregates public.activities directly in SQL
--   search_all()          selects from public.activities directly in SQL
--
-- Both are SECURITY INVOKER, so RLS scopes them per caller. For a student that
-- is already correct: activities_select_public/member hide drafts, so a
-- student's numbers never included them. For STAFF, activities_select_staff
-- (0068) returns drafts too, and permissive policies OR together -- so both
-- functions silently counted/returned unpublished drafts for aft/teacher/admin.
--
-- Measured live before writing this, as a teacher, by inserting one draft:
--   get_activity_stats() pending:  2 -> 3
--   search_all('...') hits:        0 -> 1
-- and as a student, both unchanged. So the leak is real and staff-only.
--
-- Why this matters beyond tidiness: getActivityCounts already excludes drafts
-- as of the previous commit, so the dashboard's Pending tile and the Activity
-- Statistics chart directly beside it were reporting different numbers for the
-- same thing.
--
-- RLS is NOT the thing to change. It is correct -- staff are entitled to READ
-- their drafts, which is what the calendar relies on. What was wrong is that
-- these two functions asked a narrower question than they stated. Same
-- reasoning, and same one-predicate fix, as listPublishedBanners() (0065).
--
-- Both stay SECURITY INVOKER. For get_activity_stats() that is load-bearing:
-- its `attendance` series is deliberately per-caller (a student sees only
-- their own check-ins), which services/dashboard.ts surfaces as
-- AttendanceScope so the chart can label it. Making this DEFINER to "simplify"
-- would leak the whole college's attendance to every student.
--
-- GRANTS: `create or replace` resets a function's grants to the PUBLIC EXECUTE
-- default -- the 0011->0012 trap this project has hit before. Here that default
-- is ALSO the intended state, because both functions are meant to be callable
-- by anon and authenticated (guests can search, and the stats card renders for
-- everyone). So nothing is restated; instead the grants are re-checked after
-- applying, rather than assumed. Do not copy this reasoning to a trigger-only
-- function, where the default is exactly what must be revoked.

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
      count(*) filter (where a.status = 'completed') as completed_count,
      count(*) filter (where a.status = 'pending') as pending_count
    from public.activities a
    -- The fix. An unpublished draft is not a completed or pending activity.
    where a.publish_status = 'published'
    group by 1
  ) act on act.month = months.month
  order by months.month;
$function$;

-- search_all: the `acts` branch only. The other four branches are deliberately
-- untouched -- projects/documents/books have their own workflow statuses whose
-- visibility is already the caller's own RLS, and members are not a workflow.
--
-- Edited without touching any select list, on purpose. This function's failure
-- mode is TOTAL, not partial: an earlier version selected profiles.created_at,
-- outside the column allow-list 0026 grants anon, and the WHOLE function
-- 42501'd for guests rather than merely hiding the member section. Adding a
-- predicate on an already-selected table cannot do that, but the guest case is
-- re-tested anyway.
create or replace function public.search_all(p_query text, p_limit integer default 5)
returns table(entity text, id text, title text, subtitle text, sort_key timestamptz)
language sql
stable
set search_path to ''
as $function$
  with q as (
    select
      '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as term,
      least(greatest(coalesce(p_limit, 5), 1), 20) as lim
  ),
  members as (
    select 'member'::text, p.id::text, coalesce(p.full_name, ''), p.student_id,
           null::timestamptz
    from public.profiles p, q
    where p.full_name ilike q.term or p.student_id ilike q.term
    order by p.full_name
    limit (select lim from q)
  ),
  acts as (
    select 'activity'::text, a.id::text, a.title, a.location, a.starts_at
    from public.activities a, q
    where a.title ilike q.term
      -- The fix. Staff manage drafts on the calendar, not by searching for
      -- them; a draft here would render identically to a live activity.
      and a.publish_status = 'published'
    order by a.starts_at desc
    limit (select lim from q)
  ),
  projs as (
    select 'project'::text, pr.id::text, pr.title, pr.status::text, pr.updated_at
    from public.projects pr, q
    where pr.title ilike q.term
    order by pr.updated_at desc
    limit (select lim from q)
  ),
  docs as (
    select 'document'::text, d.id::text, d.title, d.status::text, d.updated_at
    from public.documents d, q
    where d.title ilike q.term
    order by d.updated_at desc
    limit (select lim from q)
  ),
  bks as (
    select 'book'::text, b.id::text, b.title, b.status::text, b.updated_at
    from public.books b, q
    where b.title ilike q.term
    order by b.updated_at desc
    limit (select lim from q)
  )
  select * from members
  union all select * from acts
  union all select * from projs
  union all select * from docs
  union all select * from bks;
$function$;
