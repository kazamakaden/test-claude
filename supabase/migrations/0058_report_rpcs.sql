-- §18 Reports.
--
-- B-2 first, because Reports would otherwise inherit it. get_activity_stats()
-- (0009) is SECURITY INVOKER, so its `attendance` column is scoped to whatever
-- the CALLER can see: a student's own rows (attendance_select_own), an
-- org-wide count for staff (attendance_select_reviewer). Its `completed` and
-- `pending` columns, meanwhile, are org-wide for everyone, because activities
-- are readable by all. So one chart has been mixing two scopes with nothing
-- saying which is which — harmless while attendance had 0 rows, wrong the
-- moment §13 starts writing to it.
--
-- That function is deliberately LEFT ALONE here. Per-caller attendance is
-- genuinely the right answer for a student looking at their own dashboard
-- ("activities I attended"); the defect is that the UI never said so, which is
-- fixed in services/dashboard.ts by labelling the series from the same
-- predicate that governs attendance RLS. Changing the RPC to always return
-- org-wide figures would instead leak the whole college's attendance to every
-- student.
--
-- The report functions below take the opposite approach on purpose: they are
-- SECURITY DEFINER with an explicit staff check, so a report always means the
-- same thing regardless of who runs it. A report whose totals silently change
-- with the reader is worse than no report.
--
-- Every one of them spells out its own scope in SQL rather than leaning on
-- RLS. That is the lesson 0038 already recorded for list_notifications:
-- notifications_all_admin is permissive and matches every row for an admin, so
-- RLS is the security floor, never the definition of what a query means.

-- Shared guard. Fails closed on a NULL role -- `not (x = any ...)` would not,
-- because NULL propagates through `= any` and plpgsql's IF treats NULL as
-- false, skipping the raise entirely. Same trap as 0056.
create function public.assert_report_viewer()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(
       (select public.current_role()) = any (array['aft','teacher','admin']::public.user_role[]),
       false) then
    raise exception 'insufficient privilege to read reports' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_report_viewer() from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Attendance per activity (§10 statistics, §15 data)
-- ---------------------------------------------------------------------
-- Returns counts only -- never a row per student, and never the §15 sensitive
-- columns. A report answers "how many attended", not "where was each person
-- standing"; GPS, IP and device fingerprint have no business leaving the
-- column allow-list 0008 put them behind, least of all through an aggregate
-- nobody would think to audit.
create function public.get_attendance_report(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_department_id uuid default null
)
returns table (
  activity_id uuid,
  title text,
  starts_at timestamptz,
  department_name text,
  present_count bigint,
  late_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_report_viewer();

  return query
  select
    a.id,
    a.title,
    a.starts_at,
    d.name_th,
    count(*) filter (where at.status = 'present')::bigint,
    count(*) filter (where at.status = 'late')::bigint,
    count(at.id)::bigint
  from public.activities a
  left join public.attendance at on at.activity_id = a.id
  left join public.departments d on d.id = a.department_id
  where (p_from is null or a.starts_at >= p_from)
    and (p_to   is null or a.starts_at <  p_to)
    and (p_department_id is null or a.department_id = p_department_id)
  group by a.id, a.title, a.starts_at, d.name_th
  order by a.starts_at desc;
end;
$$;

revoke execute on function public.get_attendance_report(timestamptz, timestamptz, uuid) from anon, public;
grant execute on function public.get_attendance_report(timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Membership by department (§9)
-- ---------------------------------------------------------------------
-- get_member_stats() (0009) already returns member counts per department and
-- is left in place for the dashboard card. This adds the role split, which the
-- dashboard has no room for and a report needs.
create function public.get_member_report()
returns table (
  department_id uuid,
  department_code text,
  department_name text,
  student_count bigint,
  aft_count bigint,
  teacher_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_report_viewer();

  return query
  select
    d.id, d.code, d.name_th,
    count(*) filter (where p.role = 'student')::bigint,
    count(*) filter (where p.role = 'aft')::bigint,
    count(*) filter (where p.role = 'teacher')::bigint,
    count(p.id)::bigint
  from public.departments d
  left join public.profiles p on p.department_id = d.id
  group by d.id, d.code, d.name_th
  order by d.code;
end;
$$;

revoke execute on function public.get_member_report() from anon, public;
grant execute on function public.get_member_report() to authenticated;

-- ---------------------------------------------------------------------
-- Workflow throughput (§11/§12)
-- ---------------------------------------------------------------------
-- How many projects and documents sit at each stage. `entity` is a plain text
-- discriminator rather than two functions, so the page renders one table.
create function public.get_workflow_report()
returns table (entity text, status text, count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_report_viewer();

  return query
    select 'projects'::text, p.status::text, count(*)::bigint
    from public.projects p group by p.status
  union all
    select 'documents'::text, d.status::text, count(*)::bigint
    from public.documents d group by d.status
  union all
    select 'books'::text, b.status::text, count(*)::bigint
    from public.books b group by b.status
  order by 1, 2;
end;
$$;

revoke execute on function public.get_workflow_report() from anon, public;
grant execute on function public.get_workflow_report() to authenticated;
