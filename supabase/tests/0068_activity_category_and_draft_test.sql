-- 0068: the category domain, the draft -> published lifecycle, and the two
-- `using (true)` SELECT leaks it closes. Re-runnable and non-destructive: one
-- transaction, rolled back, fixtures included.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0068_activity_category_and_draft_test.sql
--
-- Write-effect cases assert ROW_COUNT rather than catching an exception: RLS
-- FILTERS UPDATE and DELETE instead of raising, so a forbidden statement
-- succeeds affecting zero rows and an exception-based helper reads that as
-- "allowed". INSERT is the asymmetric case -- a WITH CHECK violation raises.
--
-- `set local request.jwt.claims` OUTLIVES a helper's `reset role`, so anything
-- that must run as anon or as a migration clears it first with set_config(...,
-- null, true). That trap cost a false FAIL in 0065.

begin;

create temporary table _r (case_name text, outcome text);
create temporary table _fx as
select (select id from public.profiles where role='admin'   order by id limit 1) as admin_id,
       (select id from public.profiles where role='teacher' order by id limit 1) as teacher_id,
       (select id from public.profiles where role='student' order by id limit 1) as student_id;

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

create or replace function pg_temp.exec_rows(case_name text, uid uuid, sql text, expect bigint)
returns void language plpgsql as $$
declare n bigint;
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
  execute sql;
  get diagnostics n = row_count;
  reset role;
  insert into _r values (case_name,
    case when n = expect then 'PASS - ' || n || ' rows' else 'FAIL - ' || n || ' rows, wanted ' || expect end);
exception when others then
  reset role;
  insert into _r values (case_name, 'FAIL - raised (' || sqlstate || ': ' || sqlerrm || ')');
end $$;

create or replace function pg_temp.count_as(case_name text, uid uuid, expect bigint)
returns void language plpgsql as $$
declare n bigint;
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
  select count(*) into n from public.activities where title like 'ZZACT%';
  reset role;
  insert into _r values (case_name,
    case when n = expect then 'PASS - ' || n || ' rows' else 'FAIL - ' || n || ' rows, wanted ' || expect end);
end $$;

do $$
declare fx record; v_draft uuid; v_pub uuid; v_int uuid;
begin
  select * into fx from _fx;

  -- ---- creation and the category domain -------------------------------
  perform pg_temp.exec('01 student inserts', fx.student_id,
    format($q$insert into public.activities (title, starts_at, category, created_by)
              values ('ZZACT student', now(), 'org', %L)$q$, fx.student_id), 'refused');

  perform pg_temp.exec('02 teacher inserts with category', fx.teacher_id,
    format($q$insert into public.activities (title, starts_at, category, created_by)
              values ('ZZACT draft', now() + interval '1 day', 'org', %L)$q$, fx.teacher_id), 'allowed');

  perform pg_temp.exec('03 teacher forges created_by', fx.teacher_id,
    format($q$insert into public.activities (title, starts_at, category, created_by)
              values ('ZZACT forged', now(), 'org', %L)$q$, fx.student_id), 'refused');

  -- "chosen at creation" as a database fact, not a form rule.
  perform pg_temp.exec('04 insert omitting category', fx.teacher_id,
    format($q$insert into public.activities (title, starts_at, created_by)
              values ('ZZACT nocat', now(), %L)$q$, fx.teacher_id), 'refused');

  perform pg_temp.exec('05 invalid category value', fx.teacher_id,
    format($q$insert into public.activities (title, starts_at, category, created_by)
              values ('ZZACT badcat', now(), 'other', %L)$q$, fx.teacher_id), 'refused');

  -- No publishing at creation: neither column is in the INSERT grant.
  perform pg_temp.exec('06 insert as published', fx.teacher_id,
    format($q$insert into public.activities (title, starts_at, category, publish_status, created_by)
              values ('ZZACT pubatcreate', now(), 'org', 'published', %L)$q$, fx.teacher_id), 'refused');

  perform pg_temp.exec('07 insert as is_public', fx.teacher_id,
    format($q$insert into public.activities (title, starts_at, category, is_public, created_by)
              values ('ZZACT pubflag', now(), 'org', true, %L)$q$, fx.teacher_id), 'refused');

  select id into v_draft from public.activities where title = 'ZZACT draft';

  insert into _r values ('08 new activity lands as draft',
    case when (select publish_status = 'draft' and published_at is null and is_public = false
                 from public.activities where id = v_draft)
         then 'PASS' else 'FAIL' end);

  -- ---- the invariant and the trigger ----------------------------------
  -- 23514 from activities_public_needs_published. Before 0070 the trigger
  -- silently forced is_public back to false and this reported success, which is
  -- what the case was written to catch.
  perform pg_temp.exec('09 is_public on a draft', fx.teacher_id,
    format($q$update public.activities set is_public = true where id = %L$q$, v_draft), 'refused');

  perform pg_temp.exec('10 client writes published_at', fx.teacher_id,
    format($q$update public.activities set published_at = now() - interval '10 years'
              where id = %L$q$, v_draft), 'refused');

  perform pg_temp.exec('11 client writes created_by', fx.teacher_id,
    format($q$update public.activities set created_by = %L where id = %L$q$, fx.student_id, v_draft), 'refused');

  perform pg_temp.exec('12 owner publishes', fx.teacher_id,
    format($q$update public.activities set publish_status = 'published' where id = %L$q$, v_draft), 'allowed');

  insert into _r values ('13 published_at set by trigger',
    case when (select published_at is not null from public.activities where id = v_draft)
         then 'PASS' else 'FAIL' end);

  perform pg_temp.exec('14 owner makes it public', fx.teacher_id,
    format($q$update public.activities set is_public = true where id = %L$q$, v_draft), 'allowed');

  -- Withdrawing must force is_public false, or the row would violate the CHECK.
  perform pg_temp.exec('15 owner unpublishes', fx.teacher_id,
    format($q$update public.activities set publish_status = 'draft' where id = %L$q$, v_draft), 'allowed');

  insert into _r values ('16 unpublish clears is_public and published_at',
    case when (select is_public = false and published_at is null
                 from public.activities where id = v_draft)
         then 'PASS' else 'FAIL' end);

  -- ---- visibility fixtures --------------------------------------------
  perform set_config('request.jwt.claims', null, true);
  insert into public.activities (title, starts_at, category, created_by, publish_status, is_public)
  values ('ZZACT published public', now() + interval '2 days', 'org', fx.teacher_id, 'published', true)
  returning id into v_pub;
  insert into public.activities (title, starts_at, category, created_by, publish_status, is_public)
  values ('ZZACT published internal', now() + interval '3 days', 'club', fx.teacher_id, 'published', false)
  returning id into v_int;

  -- A banner on the still-draft activity, for the B6 case.
  insert into public.activity_banners (activity_id, storage_path, sort_order, uploaded_by)
  values (v_draft, v_draft::text || '/zzact.jpg', 0, fx.teacher_id);

  -- ---- who sees what ---------------------------------------------------
  -- The bug: before 0068 a student saw all three, drafts included.
  perform pg_temp.count_as('17 student sees published only (not the draft)', fx.student_id, 2::bigint);
  perform pg_temp.count_as('18 teacher sees the draft too', fx.teacher_id, 3::bigint);
  perform pg_temp.count_as('19 admin sees all', fx.admin_id, 3::bigint);

  -- Proves the fix removed DRAFTS and nothing else: an internal published
  -- activity (is_public = false) must still reach a student.
  declare n bigint;
  begin
    execute 'set local role authenticated';
    execute format('set local request.jwt.claims = %L',
                   json_build_object('sub', fx.student_id, 'role','authenticated')::text);
    select count(*) into n from public.activities where id = v_int;
    reset role;
    insert into _r values ('20 student still sees internal published',
      case when n = 1 then 'PASS - 1 row' else 'FAIL - ' || n || ' rows' end);
  end;

  -- ---- writes RLS FILTERS ---------------------------------------------
  perform pg_temp.exec_rows('21 student updates a published activity', fx.student_id,
    format($q$update public.activities set title = 'ZZACT hacked' where id = %L$q$, v_pub), 0::bigint);

  perform pg_temp.exec_rows('22 student deletes', fx.student_id,
    format($q$delete from public.activities where id = %L$q$, v_pub), 0::bigint);

  perform pg_temp.exec_rows('23 owner deletes', fx.teacher_id,
    format($q$delete from public.activities where id = %L$q$, v_pub), 1::bigint);
end $$;

-- ---- B6: a draft's banners ------------------------------------------------
do $$
declare fx record; n bigint;
begin
  select * into fx from _fx;
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', fx.student_id, 'role','authenticated')::text);
  select count(*) into n from public.activity_banners where storage_path like '%zzact.jpg';
  reset role;
  insert into _r values ('24 student sees a draft banner',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows' end);

  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', fx.teacher_id, 'role','authenticated')::text);
  select count(*) into n from public.activity_banners where storage_path like '%zzact.jpg';
  reset role;
  insert into _r values ('25 staff sees a draft banner',
    case when n = 1 then 'PASS - 1 row' else 'FAIL - ' || n || ' rows' end);
end $$;

-- ---- anon ------------------------------------------------------------------
do $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', null, true);
  set local role anon;
  select count(*) into n from public.activities where title like 'ZZACT%';
  reset role;
  -- Only 'ZZACT published internal' survives case 23, and it is is_public=false.
  insert into _r values ('26 anon sees non-public rows',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows' end);
end $$;

-- 26b is the 0067 regression pin: the anon ROLE holding a STAFF JWT claim must
-- still see nothing. It fails the moment anyone merges activities_select_staff
-- into a `to anon, authenticated` policy, because current_role() answers from
-- the claim rather than the Postgres role. The split makes that clause
-- unreachable for anon BY GRANT.
do $$
declare fx record; n bigint;
begin
  select * into fx from _fx;
  perform set_config('request.jwt.claims',
    json_build_object('sub', fx.teacher_id, 'role','authenticated')::text, true);
  set local role anon;
  select count(*) into n from public.activities where title like 'ZZACT%';
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into _r values ('26b anon role + staff claim',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows' end);
end $$;

-- ---- the demoted owner ------------------------------------------------------
-- The case activities_update_editor alone lets through: it passes on
-- `created_by = auth.uid()` with no role test, and a WITH CHECK clause cannot
-- see the OLD row to notice the draft -> published transition. This is the whole
-- reason activities_publish_guard() exists.
do $$
declare fx record; v_id uuid; v_old public.user_role;
begin
  select * into fx from _fx;
  perform set_config('request.jwt.claims', null, true);

  select role into v_old from public.profiles where id = fx.teacher_id;
  insert into public.activities (title, starts_at, category, created_by)
  values ('ZZACT demoted', now() + interval '4 days', 'org', fx.teacher_id)
  returning id into v_id;

  update public.profiles set role = 'student' where id = fx.teacher_id;

  -- ROW_COUNT, not an exception, and the reason matters. The publish guard
  -- would raise -- but it never runs: a demoted owner can no longer SELECT
  -- their own draft (not published, no longer staff), so `update ... where
  -- id = X` matches nothing. RLS FILTERS an UPDATE rather than raising, this
  -- project's own documented trap, and an exception-based helper reads the
  -- zero-row result as "allowed". Asserting 0 rows is what actually proves the
  -- demoted owner cannot publish.
  perform pg_temp.exec_rows('27 demoted owner publishes own draft', fx.teacher_id,
    format($q$update public.activities set publish_status = 'published' where id = %L$q$, v_id), 0::bigint);

  perform set_config('request.jwt.claims', null, true);
  update public.profiles set role = v_old where id = fx.teacher_id;
end $$;

select count(*) filter (where outcome like 'PASS%') as passed,
       count(*) filter (where outcome like 'FAIL%') as failed,
       coalesce(string_agg(case_name || ' => ' || outcome, ' | ')
                filter (where outcome like 'FAIL%'), 'none') as failures
from _r;

rollback;
