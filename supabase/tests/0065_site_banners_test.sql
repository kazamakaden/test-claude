-- 0065 site_banners: who may write, and the two invariants that carry the draft
-- model. Re-runnable and non-destructive: one transaction, rolled back, fixtures
-- included.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0065_site_banners_test.sql
--
-- Write-effect cases assert ROW_COUNT rather than catching an exception. RLS
-- FILTERS on UPDATE/DELETE instead of raising, so a forbidden statement succeeds
-- affecting zero rows -- an exception-based helper reads that as "allowed".
-- INSERT is the asymmetric case: a WITH CHECK violation does raise.

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
      case when expect='refused' then 'PASS - refused (' || sqlstate || ': ' || sqlerrm || ')'
           else 'FAIL - refused (' || sqlstate || ': ' || sqlerrm || ')' end);
  end;
end $$;

-- Same, but for statements RLS filters instead of refusing: records how many rows
-- the statement actually touched.
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

do $$
declare fx record; v_id uuid; n bigint; v_pub timestamptz;
begin
  select * into fx from _fx;

  -- ---- who may create ------------------------------------------------
  perform pg_temp.exec('01 student inserts', fx.student_id,
    format($q$insert into public.site_banners (storage_path, created_by)
              values ('ZZSB/student.jpg', %L)$q$, fx.student_id), 'refused');

  perform pg_temp.exec('02 staff inserts draft', fx.teacher_id,
    format($q$insert into public.site_banners (storage_path, created_by)
              values ('ZZSB/draft.jpg', %L)$q$, fx.teacher_id), 'allowed');

  -- created_by = auth.uid() in the insert policy: authorship cannot be forged.
  perform pg_temp.exec('03 staff forges created_by', fx.teacher_id,
    format($q$insert into public.site_banners (storage_path, created_by)
              values ('ZZSB/forged.jpg', %L)$q$, fx.student_id), 'refused');

  -- ---- the CHECK constraints ------------------------------------------
  perform pg_temp.exec('04 term = 3', fx.teacher_id,
    format($q$insert into public.site_banners (storage_path, created_by, term)
              values ('ZZSB/term3.jpg', %L, 3)$q$, fx.teacher_id), 'refused');

  perform pg_temp.exec('05 academic_year out of range', fx.teacher_id,
    format($q$insert into public.site_banners (storage_path, created_by, academic_year)
              values ('ZZSB/year.jpg', %L, 1999)$q$, fx.teacher_id), 'refused');

  -- published => fully described. This is the invariant that stops a Facebook
  -- import reaching the homepage before anyone has described it.
  perform pg_temp.exec('06 publish with no year/term', fx.teacher_id,
    format($q$insert into public.site_banners (storage_path, created_by, status)
              values ('ZZSB/bare.jpg', %L, 'published')$q$, fx.teacher_id), 'refused');

  select id into v_id from public.site_banners where storage_path = 'ZZSB/draft.jpg';

  perform pg_temp.exec('07 publish existing draft with no year/term', fx.teacher_id,
    format($q$update public.site_banners set status = 'published' where id = %L$q$, v_id), 'refused');

  -- ---- columns a client must not move ---------------------------------
  perform pg_temp.exec('08 staff writes published_at', fx.teacher_id,
    format($q$update public.site_banners set published_at = now() - interval '10 years'
              where id = %L$q$, v_id), 'refused');

  perform pg_temp.exec('09 staff writes source', fx.teacher_id,
    format($q$update public.site_banners set source = 'facebook' where id = %L$q$, v_id), 'refused');

  perform pg_temp.exec('10 staff re-points storage_path', fx.teacher_id,
    format($q$update public.site_banners set storage_path = 'ZZSB/other.jpg' where id = %L$q$, v_id), 'refused');

  perform pg_temp.exec('11 staff writes facebook_post_id', fx.teacher_id,
    format($q$update public.site_banners set facebook_post_id = 'x' where id = %L$q$, v_id), 'refused');

  -- ---- the happy path --------------------------------------------------
  perform pg_temp.exec('12 staff describes and publishes', fx.teacher_id,
    format($q$update public.site_banners
                 set academic_year = 2569, term = 1, status = 'published'
               where id = %L$q$, v_id), 'allowed');

  select published_at into v_pub from public.site_banners where id = v_id;
  insert into _r values ('13 published_at set by trigger',
    case when v_pub is not null then 'PASS' else 'FAIL - null' end);

  -- ---- visibility -------------------------------------------------------
  perform pg_temp.exec('14 staff adds a second draft', fx.admin_id,
    format($q$insert into public.site_banners (storage_path, created_by)
              values ('ZZSB/draft2.jpg', %L)$q$, fx.admin_id), 'allowed');

  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', fx.student_id, 'role','authenticated')::text);
  select count(*) into n from public.site_banners where storage_path like 'ZZSB/%';
  reset role;
  insert into _r values ('15 student sees only the published one',
    case when n = 1 then 'PASS - 1 row' else 'FAIL - ' || n || ' rows' end);

  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', fx.teacher_id, 'role','authenticated')::text);
  select count(*) into n from public.site_banners where storage_path like 'ZZSB/%';
  reset role;
  insert into _r values ('16 staff sees drafts too',
    case when n = 2 then 'PASS - 2 rows' else 'FAIL - ' || n || ' rows' end);

  -- ---- deletion ---------------------------------------------------------
  -- RLS FILTERS a DELETE rather than raising, so this asserts the row count.
  perform pg_temp.exec_rows('17 student deletes published banner', fx.student_id,
    format($q$delete from public.site_banners where id = %L$q$, v_id), 0::bigint);

  perform pg_temp.exec_rows('18 staff deletes published banner', fx.teacher_id,
    format($q$delete from public.site_banners where id = %L$q$, v_id), 1::bigint);
end $$;

-- ---- anon --------------------------------------------------------------
do $$
declare n bigint;
begin
  -- Clear the leftover claim first -- see case 21's note. Without this the
  -- previous helper's `set local request.jwt.claims` is still live, and
  -- current_role() reads the CLAIM rather than the Postgres role.
  perform set_config('request.jwt.claims', null, true);
  set local role anon;
  select count(*) into n from public.site_banners where storage_path like 'ZZSB/%';
  reset role;
  -- Only the draft2 row survives case 18, and it is a draft.
  insert into _r values ('19 anon sees drafts',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows' end);
end $$;

-- 19b is a REGRESSION TEST, not a variant of 19. It deliberately holds a staff
-- JWT claim while switching to the anon Postgres role -- role and claim
-- disagreeing -- and asserts anon still sees no drafts.
--
-- This is what a single merged `to anon, authenticated` SELECT policy fails
-- (0066, reverted by 0067): its staff clause evaluates for the anon role, and
-- current_role() answers from the claim. The split policies pass because
-- site_banners_select_staff is `to authenticated`, so it is unreachable for
-- anon BY GRANT rather than by trusting role and claim to agree.
--
-- PostgREST never lets them diverge for a real request. That is precisely why
-- this needs a test: the guarantee is structural, and nothing else would notice
-- it being removed.
do $$
declare fx record; n bigint;
begin
  select * into fx from _fx;
  perform set_config('request.jwt.claims',
    json_build_object('sub', fx.teacher_id, 'role','authenticated')::text, true);
  set local role anon;
  select count(*) into n from public.site_banners where storage_path like 'ZZSB/%';
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into _r values ('19b anon role + staff claim sees drafts',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows' end);
end $$;

do $$
begin
  begin
    set local role anon;
    insert into public.site_banners (storage_path) values ('ZZSB/anon.jpg');
    reset role;
    insert into _r values ('20 anon inserts', 'FAIL - ALLOWED');
  exception when others then
    reset role;
    insert into _r values ('20 anon inserts', 'PASS - refused (' || sqlstate || ': ' || sqlerrm || ')');
  end;
end $$;

-- ---- the aft role -------------------------------------------------------
-- `aft` shares organisationPermissions with `teacher` and is named literally in
-- every policy's role array, so it is exercised rather than assumed. The flip is
-- made as the table owner (no JWT), the same path prevent_role_self_escalation
-- carves out for migrations, and the whole transaction rolls back.
do $$
declare fx record;
begin
  select * into fx from _fx;
  -- Clear the JWT claim first. `set local request.jwt.claims` inside the helpers
  -- above outlives their `reset role`, so auth.uid() would still be the last
  -- actor -- and prevent_role_self_escalation correctly refuses a teacher
  -- changing anyone's role. The migration carve-out this flip relies on is
  -- `auth.uid() is null`.
  perform set_config('request.jwt.claims', null, true);
  update public.profiles set role = 'aft' where id = fx.student_id;
  perform pg_temp.exec('21 aft inserts draft', fx.student_id,
    format($q$insert into public.site_banners (storage_path, created_by)
              values ('ZZSB/aft.jpg', %L)$q$, fx.student_id), 'allowed');
end $$;

-- ---- the dedupe key -----------------------------------------------------
-- Written as the owner: facebook_post_id is not in any client grant, so only the
-- importer's service-role client can set it.
do $$
declare fx record;
begin
  select * into fx from _fx;
  insert into public.site_banners (storage_path, created_by, source, facebook_post_id)
  values ('ZZSB/fb1.jpg', fx.admin_id, 'facebook', 'ZZSB_POST_1');
  begin
    insert into public.site_banners (storage_path, created_by, source, facebook_post_id)
    values ('ZZSB/fb2.jpg', fx.admin_id, 'facebook', 'ZZSB_POST_1');
    insert into _r values ('22 duplicate facebook_post_id', 'FAIL - ALLOWED');
  exception when unique_violation then
    insert into _r values ('22 duplicate facebook_post_id', 'PASS - refused (' || sqlstate || ')');
  end;
end $$;

select case_name, outcome from _r order by case_name;

rollback;
