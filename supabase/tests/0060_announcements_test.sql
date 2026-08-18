-- §5/§16 announcements access + publish side effects. Re-runnable and
-- non-destructive: one transaction, rolled back, including its own fixtures.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0060_announcements_test.sql

begin;

create temporary table _r (case_name text, outcome text);
create temporary table _fx as
select (select id from public.profiles where role='admin'   order by id limit 1) as admin_id,
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

do $$
declare fx record; v_id uuid; n bigint;
begin
  select * into fx from _fx;

  -- Authoring is staff-only (content:manage).
  perform pg_temp.exec('1 student creates announcement', fx.student_id,
    format($q$insert into public.announcements (title_th, body_th, author_id)
              values ('x','y',%L)$q$, fx.student_id), 'refused');
  perform pg_temp.exec('2 staff creates draft', fx.admin_id,
    format($q$insert into public.announcements (title_th, body_th, author_id)
              values ('ZZANN draft','body',%L)$q$, fx.admin_id), 'allowed');

  -- Authorship cannot be forged onto someone else: announcements_insert_staff
  -- requires author_id = auth.uid().
  perform pg_temp.exec('3 staff forges another author', fx.admin_id,
    format($q$insert into public.announcements (title_th, body_th, author_id)
              values ('ZZANN forged','body',%L)$q$, fx.student_id), 'refused');

  -- published => has a body, as a database invariant rather than a UI check.
  perform pg_temp.exec('4 publish with blank body', fx.admin_id,
    format($q$insert into public.announcements (title_th, body_th, status, author_id)
              values ('ZZANN empty','   ','published',%L)$q$, fx.admin_id), 'refused');

  -- published_at is trigger-set; a client that could write it could reorder
  -- the whole feed.
  perform pg_temp.exec('5 staff writes published_at directly', fx.admin_id,
    $q$update public.announcements set published_at = now() - interval '10 years'
       where title_th = 'ZZANN draft'$q$, 'refused');

  -- A draft must not be visible to a non-staff reader.
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', fx.student_id, 'role','authenticated')::text);
  select count(*) into n from public.announcements where title_th like 'ZZANN%';
  reset role;
  insert into _r values ('6 student sees staff draft',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows' end);

  -- §16: publishing fans out exactly one broadcast (recipient_id null).
  select id into v_id from public.announcements where title_th = 'ZZANN draft';
  select count(*) into n from public.notifications
   where type = 'announcement' and link like '%' || v_id::text;

  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', fx.admin_id, 'role','authenticated')::text);
  update public.announcements set status = 'published' where id = v_id;
  reset role;

  insert into _r values ('7 publish creates 1 broadcast',
    case when (select count(*) from public.notifications
                where type='announcement' and link like '%' || v_id::text
                  and recipient_id is null) = n + 1
         then 'PASS' else 'FAIL' end);
  insert into _r values ('7b published_at set by trigger',
    case when (select published_at is not null from public.announcements where id = v_id)
         then 'PASS' else 'FAIL' end);

  -- The notified_at guard: unpublish/republish must not re-notify everyone
  -- about a post they have already seen.
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', fx.admin_id, 'role','authenticated')::text);
  update public.announcements set status = 'draft' where id = v_id;
  update public.announcements set status = 'published' where id = v_id;
  reset role;
  insert into _r values ('8 republish does not re-notify',
    case when (select count(*) from public.notifications
                where type='announcement' and link like '%' || v_id::text) = n + 1
         then 'PASS - still 1' else 'FAIL - duplicated' end);

  perform pg_temp.exec('9 admin deletes', fx.admin_id,
    format($q$delete from public.announcements where id = %L$q$, v_id), 'allowed');
end $$;

do $$
declare n bigint;
begin
  set local role anon;
  select count(*) into n from public.announcements where title_th like 'ZZANN%';
  reset role;
  insert into _r values ('10 anon sees drafts',
    case when n = 0 then 'PASS - 0 rows' else 'FAIL - ' || n || ' rows' end);
end $$;

select case_name, outcome from _r order by case_name;

rollback;
