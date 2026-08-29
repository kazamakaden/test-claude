-- §19 audit-log integrity and capture. Re-runnable and non-destructive:
-- everything runs in one transaction that is rolled back.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0057_audit_logs_test.sql
--
-- Two things are asserted, and the first matters more:
--
--   INTEGRITY -- nobody can write, alter or erase the trail through the API.
--   Admin is tested explicitly rather than assumed trustworthy: admin is
--   precisely who would want to erase the record of an admin action, and
--   "the admin is trusted" is how an audit trail becomes decorative.
--
--   CAPTURE -- the events that previously left no trace now leave one, with
--   the actor attributed.

begin;

create temporary table _r (case_name text, outcome text);

create temporary table _fx as
select (select id from public.profiles where role='admin'   order by id limit 1) as admin_id,
       (select id from public.profiles where role='student' order by id limit 1) as student_id;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
end $$;

-- exec(), not a scalar `select (...)`: an INSERT/UPDATE/DELETE cannot appear as
-- a subquery expression, so wrapping one raises a SYNTAX error -- which an
-- "expect refused" helper records as a pass. That false green was caught while
-- writing this file; the statements now run as statements.
create or replace function pg_temp.exec(case_name text, uid uuid, sql text, expect text)
returns void language plpgsql as $$
begin
  begin
    perform pg_temp.as_user(uid);
    execute sql;
    reset role;
    insert into _r values (case_name,
      case when expect='refused' then 'FAIL - ALLOWED' else 'PASS - allowed' end);
  exception when others then
    reset role;
    insert into _r values (case_name,
      case when expect='refused' then 'PASS - refused (' || sqlstate || ': ' || sqlerrm || ')'
           else 'FAIL - refused (' || sqlstate || ': ' || sqlerrm || ')' end);
  end;
end $$;

do $$
declare fx record; v_before bigint; v_proj uuid; v_written bigint;
begin
  select * into fx from _fx;

  -- Integrity ------------------------------------------------------------
  perform pg_temp.exec('A1 admin INSERT audit row', fx.admin_id,
    $q$insert into public.audit_logs (action, entity_table) values ('forged.entry','x')$q$, 'refused');
  perform pg_temp.exec('A2 admin UPDATE audit row', fx.admin_id,
    $q$update public.audit_logs set action = 'tampered.entry'$q$, 'refused');
  perform pg_temp.exec('A3 admin DELETE audit row', fx.admin_id,
    $q$delete from public.audit_logs$q$, 'refused');
  -- The writer itself must be unreachable, or the table grants above are moot.
  perform pg_temp.exec('A4 admin calls write_audit_log', fx.admin_id,
    $q$select public.write_audit_log('forged.entry','x','1',null,null)$q$, 'refused');
  -- SELECT is granted to `authenticated` at table level; the POLICY limits
  -- rows to admin. A student therefore gets zero rows rather than an error --
  -- correct RLS behaviour, and not a leak.
  perform pg_temp.exec('A5 student SELECT audit_logs', fx.student_id,
    $q$select 1 from public.audit_logs$q$, 'allowed');
  perform pg_temp.exec('A6 admin SELECT audit_logs', fx.admin_id,
    $q$select 1 from public.audit_logs$q$, 'allowed');

  -- Capture --------------------------------------------------------------
  select count(*) into v_before from public.audit_logs;

  perform pg_temp.as_user(fx.admin_id);
  update public.profiles set role = 'aft' where id = fx.student_id;
  reset role;

  -- A legal transition only: enforce_project_status_transition (0016) blocks a
  -- jump straight to 'official', so this drives one legal step instead.
  select id into v_proj from public.projects where status = 'draft' limit 1;
  if v_proj is not null then
    perform pg_temp.as_user(fx.admin_id);
    update public.projects set status = 'teacher_review' where id = v_proj;
    reset role;
  end if;

  select count(*) - v_before into v_written from public.audit_logs;
  insert into _r values ('B1 role + status change captured',
    case when v_written >= 2 then 'PASS - ' || v_written || ' rows'
         else 'FAIL - only ' || v_written || ' rows' end);

  insert into _r values ('B2 actor attributed',
    case when exists (select 1 from public.audit_logs
                       where action = 'member.role_changed' and actor_id = fx.admin_id
                         and actor_email is not null and actor_role = 'admin')
         then 'PASS' else 'FAIL' end);
end $$;

-- C. Tamper detection. This DELETE runs as the table OWNER with the JWT claim
--    cleared -- exactly what a service-role script or psql session does,
--    bypassing RLS entirely. That is the case application-level logging cannot
--    catch and a trigger can, and it is the whole reason the writer is a
--    trigger rather than app code.
--
--    Clearing request.jwt.claims is load-bearing: the GUC persists for the
--    whole transaction, so `reset role` alone leaves auth.uid() populated and
--    the row would be misattributed to the last user impersonated. That
--    artifact was observed while writing this test.
do $$
declare v_before bigint;
begin
  select count(*) into v_before from public.audit_logs;
  set local request.jwt.claims = '';

  insert into public.attendance (activity_id, student_id)
    select (select id from public.activities limit 1),
           (select id from public.profiles where role='admin' order by id limit 1);
  delete from public.attendance;

  insert into _r values ('C1 out-of-band attendance DELETE captured',
    case when (select count(*) from public.audit_logs) > v_before then 'PASS' else 'FAIL' end);

  -- With no session the actor is genuinely unknown, and the row must say so
  -- rather than invent an attribution.
  insert into _r values ('C2 no-session actor recorded as null',
    case when exists (select 1 from public.audit_logs
                       where action = 'attendance.deleted' and actor_id is null)
         then 'PASS' else 'FAIL' end);
end $$;

select case_name, outcome from _r order by case_name;

rollback;
