-- 0062: attendance provenance, manual entry, and student QR check-in.
-- Re-runnable and non-destructive: one transaction, rolled back.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0062_attendance_provenance_test.sql
--
-- Case 01 is an INVERSION of 0056's case 01, which asserted a plain `student` was
-- REFUSED by record_attendance with 42501. That was correct then and is wrong now:
-- an attendance list of ordinary students is the point of the feature. 0056's case
-- was updated in the same commit rather than left to fail.
--
-- Cases marked (†) read qr_sessions.secret as the table OWNER to mint a valid
-- token. No client can do that (0056 case 03 proves it); it is done here to attack
-- from a stronger position than any real caller holds.

begin;

create temporary table _r (case_name text, outcome text);

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
end $$;

-- Records the RETURN VALUE, not merely pass/fail: these RPCs answer with a status
-- string for every outcome a caller can legitimately reach, and the distinction
-- between them ('recorded' vs 'qr_verified_not_removable') IS the assertion.
create or replace function pg_temp.try(case_name text, uid uuid, sql text)
returns void language plpgsql as $$
declare res text;
begin
  begin
    perform pg_temp.as_user(uid);
    execute sql into res;
    reset role;
    insert into _r values (case_name, 'returned: ' || coalesce(res, '<null>'));
  exception when others then
    reset role;
    insert into _r values (case_name, 'raised: ' || sqlstate || ' ' || sqlerrm);
  end;
end $$;

-- Fixtures: real non-admin staff (an admin would bypass everything), plus a real
-- student. handle_new_user (0023) makes a named college email a `teacher`.
create temporary table _fx as
select gen_random_uuid() as owner_id,
       gen_random_uuid() as editor_id,
       gen_random_uuid() as outsider_id,
       (select id from public.profiles where role='student' order by id limit 1) as student_id,
       (select id from public.profiles where role='student' order by id desc  limit 1) as student2_id;

do $$
declare fx record;
begin
  select * into fx from _fx;
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (fx.owner_id,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated','a.owner.zz@udontech.ac.th',   now(), now()),
         (fx.editor_id,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','a.editor.zz@udontech.ac.th',  now(), now()),
         (fx.outsider_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a.outsider.zz@udontech.ac.th',now(), now());
end $$;

-- An activity inside its own attendance window, owned by owner_id.
create temporary table _act as select gen_random_uuid() as id;

do $$
declare fx record; a uuid;
begin
  select * into fx from _fx; select id into a from _act;
  insert into public.activities (id, title, starts_at, ends_at, is_public, created_by)
  values (a, 'ZZATTEND', now() - interval '5 minutes', now() + interval '2 hours', true, fx.owner_id);
  insert into public.activity_editors (activity_id, user_id, granted_by)
  values (a, fx.editor_id, fx.owner_id);
end $$;

-- A live QR session on it, opened by the owner.
create temporary table _s as select ''::text as slug;
do $$
declare fx record; a uuid; r record;
begin
  select * into fx from _fx; select id into a from _act;
  perform pg_temp.as_user(fx.owner_id);
  select * into r from public.create_qr_session(a, now() + interval '1 hour', 30, null, null, null);
  reset role;
  delete from _s; insert into _s values (r.slug);
end $$;

do $$
declare fx record; a uuid; sl text; sec bytea; bkt bigint; tok text;
begin
  select * into fx from _fx; select id into a from _act; select slug into sl from _s;
  select secret into sec from public.qr_sessions where slug = sl;          -- (†)
  bkt := floor(extract(epoch from now())/30)::bigint;
  tok := public.qr_token_for_bucket(sl, sec, bkt);

  -- 01 THE INVERSION: a plain student may now check in by QR.
  perform pg_temp.try('01 student scans (inverts 0056 case 01)', fx.student_id,
    format('select public.record_attendance(%L, null, null, ''fp'')', tok));

  -- 02 A qr row must say so, and must NOT name a recorder.
  insert into _r
  select '02 student row is method=qr, recorded_by null',
         case when at.method = 'qr' and at.recorded_by is null
              then 'PASS' else 'FAIL - method=' || at.method || ' recorded_by=' || coalesce(at.recorded_by::text,'null') end
  from public.attendance at where at.activity_id = a and at.student_id = fx.student_id;

  -- 03 Manual entry is gated on can_edit_activity, not on a role.
  perform pg_temp.try('03 outsider staff manual-adds', fx.outsider_id,
    format('select public.record_attendance_manual(%L, %L)', a, fx.student2_id));
  perform pg_temp.try('04 co-editor manual-adds', fx.editor_id,
    format('select public.record_attendance_manual(%L, %L)', a, fx.student2_id));

  -- 05 A manual row is marked and attributed.
  insert into _r
  select '05 manual row is method=manual, recorded_by set',
         case when at.method = 'manual' and at.recorded_by = fx.editor_id
              then 'PASS' else 'FAIL - method=' || at.method || ' recorded_by=' || coalesce(at.recorded_by::text,'null') end
  from public.attendance at where at.activity_id = a and at.student_id = fx.student2_id;

  -- 06 A manual INSERT leaves an audit row (audit_attendance_tamper is
  --    UPDATE/DELETE-only, so this would otherwise be untraced).
  insert into _r
  select '06 manual entry is audit-logged',
         case when count(*) = 1 then 'PASS' else 'FAIL - ' || count(*) || ' rows' end
  from public.audit_logs where action = 'attendance.manual_entry';

  perform pg_temp.try('07 duplicate manual add', fx.editor_id,
    format('select public.record_attendance_manual(%L, %L)', a, fx.student2_id));
  perform pg_temp.try('08 manual add of an unknown person', fx.editor_id,
    format('select public.record_attendance_manual(%L, %L)', a, gen_random_uuid()));

  -- 09/10 Undo reaches manual rows only. A QR scan is evidence of physical
  --       presence and staff must not be able to erase it.
  perform pg_temp.try('09 undo a QR row (must refuse)', fx.editor_id,
    format('select public.remove_manual_attendance(%L, %L)', a, fx.student_id));
  perform pg_temp.try('10 undo a manual row', fx.editor_id,
    format('select public.remove_manual_attendance(%L, %L)', a, fx.student2_id));
  perform pg_temp.try('11 outsider undo', fx.outsider_id,
    format('select public.remove_manual_attendance(%L, %L)', a, fx.student_id));
end $$;

-- 12 The QR row survived case 09.
do $$
declare fx record; a uuid; n int;
begin
  select * into fx from _fx; select id into a from _act;
  select count(*) into n from public.attendance where activity_id = a and student_id = fx.student_id;
  insert into _r values ('12 QR row still present after refused undo',
    case when n = 1 then 'PASS' else 'FAIL - ' || n || ' rows' end);
end $$;

-- 13 `method` has NO default: a writer that forgets must fail rather than
--    silently claim verification. Asserted against the catalog, since no client
--    can insert at all.
do $$
declare d text;
begin
  select column_default into d from information_schema.columns
   where table_schema='public' and table_name='attendance' and column_name='method';
  insert into _r values ('13 method has no default',
    case when d is null then 'PASS - no default' else 'FAIL - default ' || d end);
end $$;

-- 14 attendance_insert_own is deliberately NOT relaxed to `student`: with no
--    INSERT grant it is unreachable, so keeping it narrow costs nothing and still
--    holds if a future migration re-grants INSERT.
do $$
declare wc text;
begin
  select with_check into wc from pg_policies
   where schemaname='public' and tablename='attendance' and policyname='attendance_insert_own';
  -- Match the ROLE LITERAL, not the bare word: the predicate also contains the
  -- COLUMN name student_id, so `like '%student%'` matches a correct policy and
  -- reports a hole that is not there (observed on this file's first run).
  insert into _r values ('14 attendance_insert_own still excludes student',
    case when wc not like '%''student''::user_role%' then 'PASS' else 'FAIL - ' || wc end);
end $$;

-- 15 The 0011->0012 trap: `create or replace` above reset EXECUTE to PUBLIC.
do $$
declare bad int;
begin
  select count(*) into bad from (
    select 1 where has_function_privilege('anon','public.record_attendance(text,numeric,numeric,text)','execute')
    union all
    select 1 where has_function_privilege('anon','public.record_attendance_manual(uuid,uuid,public.attendance_status)','execute')
    union all
    select 1 where has_function_privilege('anon','public.remove_manual_attendance(uuid,uuid)','execute')
  ) t;
  insert into _r values ('15 anon cannot execute any attendance RPC',
    case when bad = 0 then 'PASS - 0 of 3' else 'FAIL - ' || bad || ' of 3' end);
end $$;

-- 16 A caller with no profile row hits the NULL branch of the fail-closed guard.
do $$
declare res text;
begin
  begin
    perform pg_temp.as_user(gen_random_uuid());
    execute 'select public.record_attendance(''aaaaaaaaaa.deadbeef'')' into res;
    reset role;
    insert into _r values ('16 profile-less caller refused', 'FAIL - returned ' || coalesce(res,'<null>'));
  exception when others then
    reset role;
    insert into _r values ('16 profile-less caller refused', 'PASS - raised ' || sqlstate || ' ' || sqlerrm);
  end;
end $$;

select case_name, outcome from _r order by case_name;

rollback;
