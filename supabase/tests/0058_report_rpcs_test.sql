-- §18 report access (SEC-5). Re-runnable and non-destructive: one transaction,
-- rolled back. Reports are read-only, so this is purely an access matrix.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0058_report_rpcs_test.sql
--
-- The point being asserted: org-wide attendance, membership and workflow
-- figures are staff-only. `/reports` was previously nav-gated on
-- workspace:access, which a read-only `student` holds -- so the boundary now
-- has to exist in the database too, not only in the nav filter.

begin;

create temporary table _r (case_name text, outcome text);
create temporary table _fx as
select (select id from public.profiles where role='admin'   order by id limit 1) as admin_id,
       (select id from public.profiles where role='student' order by id limit 1) as student_id;

-- exec(), not `execute ... into`: a query whose only reference to the function
-- is an UNUSED output column lets the planner prune the call entirely, so the
-- statement succeeds without ever invoking it and reads as "allowed". That
-- produced a false FAIL on the guard case while this file was being written --
-- the boundary was fine and the test was wrong. Run statements as statements.
create or replace function pg_temp.exec(case_name text, uid uuid, sql text, expect text)
returns void language plpgsql as $$
begin
  begin
    execute 'set local role authenticated';
    execute format('set local request.jwt.claims = %L',
                   json_build_object('sub', uid, 'role','authenticated')::text);
    execute sql;
    reset role;
    insert into _r values (case_name,
      case when expect='refused' then 'FAIL - ALLOWED' else 'PASS - allowed' end);
  exception when others then
    reset role;
    insert into _r values (case_name,
      case when expect='refused' then 'PASS - refused (' || sqlstate || ')'
           else 'FAIL - refused (' || sqlstate || ': ' || sqlerrm || ')' end);
  end;
end $$;

do $$
declare fx record;
begin
  select * into fx from _fx;

  perform pg_temp.exec('01 student get_attendance_report', fx.student_id,
    'select * from public.get_attendance_report()', 'refused');
  perform pg_temp.exec('02 student get_member_report', fx.student_id,
    'select * from public.get_member_report()', 'refused');
  perform pg_temp.exec('03 student get_workflow_report', fx.student_id,
    'select * from public.get_workflow_report()', 'refused');
  -- The shared guard must be unreachable on its own, or a caller could probe
  -- their own report eligibility without going through a report.
  perform pg_temp.exec('04 student calls assert_report_viewer', fx.student_id,
    'select public.assert_report_viewer()', 'refused');

  perform pg_temp.exec('05 admin get_attendance_report', fx.admin_id,
    'select * from public.get_attendance_report()', 'allowed');
  perform pg_temp.exec('06 admin get_member_report', fx.admin_id,
    'select * from public.get_member_report()', 'allowed');
  perform pg_temp.exec('07 admin get_workflow_report', fx.admin_id,
    'select * from public.get_workflow_report()', 'allowed');
  perform pg_temp.exec('08 admin date-filtered report', fx.admin_id,
    $q$select * from public.get_attendance_report(now() - interval '30 days', now())$q$, 'allowed');

  -- §15: the sensitive columns must not be reachable through an aggregate.
  -- The report returns counts only, so there is no such column to select.
  perform pg_temp.exec('09 gps not exposed via report', fx.admin_id,
    'select gps_lat from public.get_attendance_report()', 'refused');
end $$;

do $$
begin
  begin
    set local role anon;
    execute 'select * from public.get_member_report()';
    reset role;
    insert into _r values ('10 anon get_member_report', 'FAIL - ALLOWED');
  exception when others then
    reset role;
    insert into _r values ('10 anon get_member_report', 'PASS - refused (' || sqlstate || ')');
  end;
end $$;

select case_name, outcome from _r order by case_name;

rollback;
