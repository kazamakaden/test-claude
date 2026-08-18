-- 0061 ownership / co-editor matrix. Re-runnable and non-destructive: one
-- transaction, rolled back, including the three staff accounts it mints.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0061_activity_ownership_test.sql
--
-- The project has only admins and students, and an admin bypasses everything via
-- activities_all_admin -- so a matrix run as admin would prove nothing. These
-- cases need real NON-admin staff, minted here by inserting auth.users rows with
-- named college emails: handle_new_user (0023) turns a non-numeric local part
-- into role='teacher'.
--
-- The case that matters most is B1. Everything else is policy work; B1 is the
-- COLUMN GRANT, and without it the whole co-editor design is a self-service
-- ownership transfer -- RLS cannot express "created_by must not change" because
-- WITH CHECK never sees the OLD row.

begin;

create temporary table _r (case_name text, outcome text);

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
end $$;

-- Statements run as STATEMENTS. `select (insert into ...)` is not valid syntax,
-- so an expect-refused helper would log the syntax error as a refusal -- a false
-- green this project has already been bitten by (0057).
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

-- exec() above is correct for INSERT only. For UPDATE and DELETE, RLS does NOT
-- raise -- the USING clause FILTERS, so a statement the policy forbids succeeds
-- while affecting zero rows. An exception-based helper reads that as "allowed"
-- and reports a policy hole that does not exist (observed on this file's first
-- run: A1 and B5 both false-FAILed exactly this way). Write-effect cases must
-- assert ROW_COUNT.
create or replace function pg_temp.exec_rows(case_name text, uid uuid, sql text, expect text)
returns void language plpgsql as $$
declare n bigint;
begin
  begin
    perform pg_temp.as_user(uid);
    execute sql;
    get diagnostics n = row_count;
    reset role;
    if expect = 'refused' then
      insert into _r values (case_name,
        case when n = 0 then 'PASS - filtered by RLS (0 rows)'
             else 'FAIL - ALLOWED (' || n || ' rows)' end);
    else
      insert into _r values (case_name,
        case when n > 0 then 'PASS - allowed (' || n || ' rows)'
             else 'FAIL - filtered to 0 rows' end);
    end if;
  exception when others then
    reset role;
    insert into _r values (case_name,
      case when expect='refused' then 'PASS - refused (' || sqlstate || ': ' || sqlerrm || ')'
           else 'FAIL - refused (' || sqlstate || ': ' || sqlerrm || ')' end);
  end;
end $$;

-- Fixtures ------------------------------------------------------------
create temporary table _fx as
select gen_random_uuid() as owner_id,
       gen_random_uuid() as editor_id,
       gen_random_uuid() as outsider_id,
       (select id from public.profiles where role='admin'   order by id limit 1) as admin_id,
       (select id from public.profiles where role='student' order by id limit 1) as student_id;

do $$
declare fx record;
begin
  select * into fx from _fx;
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (fx.owner_id,    '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t.owner.zz@udontech.ac.th',   now(), now()),
         (fx.editor_id,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t.editor.zz@udontech.ac.th',  now(), now()),
         (fx.outsider_id, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t.outsider.zz@udontech.ac.th',now(), now());
end $$;

-- Confirm the fixtures really are non-admin staff, or every case below is vacuous.
do $$
declare fx record; n int;
begin
  select * into fx from _fx;
  select count(*) into n from public.profiles
   where id in (fx.owner_id, fx.editor_id, fx.outsider_id) and role = 'teacher';
  insert into _r values ('00 fixtures are teacher-role staff',
    case when n = 3 then 'PASS - 3 teachers' else 'FAIL - only ' || n end);
end $$;

-- An activity owned by owner_id, with editor_id granted co-edit rights.
create temporary table _act as
select gen_random_uuid() as id;

do $$
declare fx record; a uuid;
begin
  select * into fx from _fx; select id into a from _act;
  insert into public.activities (id, title, starts_at, ends_at, is_public, created_by)
  values (a, 'ZZOWNTEST', now() + interval '1 hour', now() + interval '3 hours', true, fx.owner_id);
  insert into public.activity_editors (activity_id, user_id, granted_by)
  values (a, fx.editor_id, fx.owner_id);
end $$;

do $$
declare fx record; a uuid;
begin
  select * into fx from _fx; select id into a from _act;

  -- A. The tightening ------------------------------------------------
  perform pg_temp.exec_rows('A1 outsider staff updates another owner''s activity', fx.outsider_id,
    format('update public.activities set title = ''HIJACKED'' where id = %L', a), 'refused');
  perform pg_temp.exec_rows('A2 owner updates own activity', fx.owner_id,
    format('update public.activities set title = ''ZZOWNTEST v2'' where id = %L', a), 'allowed');
  perform pg_temp.exec_rows('A3 co-editor updates the activity', fx.editor_id,
    format('update public.activities set title = ''ZZOWNTEST v3'' where id = %L', a), 'allowed');

  -- B. Escalation ----------------------------------------------------
  -- B1 IS THE ONE. Refused by the column grant, not by any policy.
  perform pg_temp.exec_rows('B1 co-editor seizes ownership via created_by', fx.editor_id,
    format('update public.activities set created_by = %L where id = %L', fx.editor_id, a), 'refused');
  perform pg_temp.exec_rows('B2 owner hands ownership to someone else', fx.owner_id,
    format('update public.activities set created_by = %L where id = %L', fx.outsider_id, a), 'refused');
  perform pg_temp.exec('B3 co-editor delegates to a third party', fx.editor_id,
    format('insert into public.activity_editors (activity_id, user_id, granted_by) values (%L,%L,%L)',
           a, fx.outsider_id, fx.editor_id), 'refused');
  perform pg_temp.exec('B4 owner delegates (control for B3)', fx.owner_id,
    format('insert into public.activity_editors (activity_id, user_id, granted_by) values (%L,%L,%L)',
           a, fx.outsider_id, fx.owner_id), 'allowed');
  perform pg_temp.exec_rows('B5 co-editor deletes the activity (cascade guard)', fx.editor_id,
    format('delete from public.activities where id = %L', a), 'refused');

  -- C. Trigger guards ------------------------------------------------
  perform pg_temp.exec('C1 non-staff student granted co-edit', fx.owner_id,
    format('insert into public.activity_editors (activity_id, user_id, granted_by) values (%L,%L,%L)',
           a, fx.student_id, fx.owner_id), 'refused');
  perform pg_temp.exec('C2 owner added as own co-editor', fx.owner_id,
    format('insert into public.activity_editors (activity_id, user_id, granted_by) values (%L,%L,%L)',
           a, fx.owner_id, fx.owner_id), 'refused');
  perform pg_temp.exec('C3 forged granted_by on a real delegation', fx.owner_id,
    format('insert into public.activity_editors (activity_id, user_id, granted_by) values (%L,%L,%L)',
           a, fx.outsider_id, fx.admin_id), 'refused');

  -- D. Ownership planting on INSERT -----------------------------------
  perform pg_temp.exec('D1 staff creates activity owned by someone else', fx.outsider_id,
    format('insert into public.activities (title, starts_at, is_public, created_by) values (''ZZPLANT'', now(), true, %L)',
           fx.owner_id), 'refused');
  perform pg_temp.exec('D2 staff creates activity owned by self (control)', fx.outsider_id,
    format('insert into public.activities (title, starts_at, is_public, created_by) values (''ZZOWN'', now(), true, %L)',
           fx.outsider_id), 'allowed');

  -- E. Resignation and owner delete ------------------------------------
  perform pg_temp.exec_rows('E1 co-editor resigns their own grant', fx.editor_id,
    format('delete from public.activity_editors where activity_id = %L and user_id = %L', a, fx.editor_id), 'allowed');
  perform pg_temp.exec_rows('E2 owner deletes own activity (the reported bug)', fx.owner_id,
    format('delete from public.activities where id = %L', a), 'allowed');
end $$;

-- F. anon holds no write privilege at all on either table.
do $$
declare n int;
begin
  select count(*) into n
  from information_schema.column_privileges
  where table_schema='public' and table_name in ('activities','activity_editors')
    and grantee = 'anon' and privilege_type in ('INSERT','UPDATE','REFERENCES');
  insert into _r values ('F1 anon has no write grants',
    case when n = 0 then 'PASS - 0 grants' else 'FAIL - ' || n || ' grants' end);
end $$;

-- G. created_by is not UPDATE-grantable to anyone (the B1 mechanism, asserted directly).
do $$
declare n int;
begin
  select count(*) into n
  from information_schema.column_privileges
  where table_schema='public' and table_name='activities'
    and grantee='authenticated' and privilege_type='UPDATE'
    and column_name in ('created_by','id');
  insert into _r values ('G1 created_by/id not UPDATE-grantable',
    case when n = 0 then 'PASS - 0 grants' else 'FAIL - ' || n || ' grants' end);
end $$;

select case_name, outcome from _r order by case_name;

rollback;
