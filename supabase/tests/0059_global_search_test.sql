-- §18 global search leakage matrix (SEC-4). Re-runnable and non-destructive:
-- one transaction, rolled back, including the two decoy rows it inserts.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0059_global_search_test.sql
--
-- Search is the easiest place in an app to leak data: one query fans out over
-- tables whose access rules differ, and the convenient implementation -- one
-- privileged query filtered afterwards -- is exactly the wrong one. What is
-- asserted here is that search shows nobody anything they could not already
-- reach by browsing.

begin;

create temporary table _r (case_name text, outcome text);
create temporary table _fx as
select (select id from public.profiles where role='admin'   order by id limit 1) as admin_id,
       (select id from public.profiles where role='student' order by id limit 1) as student_id;

-- Decoys: drafts owned by SOMEONE ELSE, distinctively titled so a match is
-- unambiguous. If search leaks, these are what it leaks.
insert into public.projects (title, status, owner_id)
select 'ZZSECRETDRAFT other-owner', 'draft', (select admin_id from _fx);
insert into public.documents (title, status, owner_id)
select 'ZZSECRETDRAFT doc', 'draft', (select admin_id from _fx);

create or replace function pg_temp.count_as(uid uuid, term text, lim int default 20)
returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
  execute format('select count(*) from public.search_all(%L, %s)', term, lim) into n;
  reset role;
  return n;
end $$;

do $$
declare fx record; n bigint;
begin
  select * into fx from _fx;

  n := pg_temp.count_as(fx.student_id, 'ZZSECRETDRAFT');
  insert into _r values ('1 student sees another owner''s drafts',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows leaked' end);

  -- The mirror case. Without it, a search that returns nothing to anyone would
  -- also "pass", and a broken search is not a secure one.
  n := pg_temp.count_as(fx.admin_id, 'ZZSECRETDRAFT');
  insert into _r values ('2 reviewer DOES see drafts (control)',
    case when n >= 2 then 'PASS - ' || n || ' rows' else 'FAIL - ' || n || ' rows' end);

  -- Wildcard injection: an unescaped % turns the member directory into a bulk
  -- export of every name and student ID.
  n := pg_temp.count_as(fx.student_id, '%');
  insert into _r values ('3 wildcard "%" escaped',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows leaked' end);
  n := pg_temp.count_as(fx.student_id, '_');
  insert into _r values ('4 wildcard "_" escaped',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows' end);

  -- A caller-supplied limit must be clamped, not honoured.
  n := pg_temp.count_as(fx.admin_id, 'a', 100000);
  insert into _r values ('5 p_limit clamped',
    case when n <= 100 then 'PASS - ' || n || ' rows' else 'FAIL - ' || n || ' rows' end);

  -- Thai is the primary language; ILIKE over trigram indexes must handle it.
  n := pg_temp.count_as(fx.student_id, 'โครงการ');
  insert into _r values ('6 Thai term matches',
    case when n >= 1 then 'PASS - ' || n || ' rows' else 'FAIL - 0 rows' end);
end $$;

-- reset role BEFORE writing _r. The temp table is owned by the session role;
-- `set local role anon` makes the DO block run as anon, which has no INSERT on
-- it, so recording a result while still anon raises 42501 and aborts the whole
-- file at case 7. Capture every count as anon first, restore the role, then
-- record. (The authenticated cases above avoid this because count_as() resets
-- the role before returning.)
do $$
declare n7 bigint; n8 bigint; n9 bigint;
begin
  set local role anon;
  select count(*) into n7 from public.search_all('ZZSECRETDRAFT', 20);
  -- profiles.email is not searched at all. It is column-granted to
  -- `authenticated` but not `anon` (0026), so including it would ALSO break
  -- search outright for guests -- see case 9.
  select count(*) into n8 from public.search_all('udontech', 20);
  -- Regression guard for a real bug: the first version selected
  -- profiles.created_at, which is outside anon's column allow-list, so the
  -- WHOLE function failed for guests with 42501 -- not just the member
  -- section. Found by running as anon, not by reading the code.
  select count(*) into n9 from public.search_all('า', 20);
  reset role;

  insert into _r values ('7 anon sees drafts',
    case when n7 = 0 then 'PASS - 0 rows' else 'FAIL - ' || n7 || ' rows leaked' end);
  insert into _r values ('8 anon can search by email domain',
    case when n8 = 0 then 'PASS - 0 rows (email not searched)' else 'FAIL - ' || n8 || ' rows' end);
  insert into _r values ('9 anon search returns public content',
    case when n9 > 0 then 'PASS - ' || n9 || ' rows' else 'FAIL - 0 rows or error' end);
end $$;

select case_name, outcome from _r order by case_name;

rollback;
