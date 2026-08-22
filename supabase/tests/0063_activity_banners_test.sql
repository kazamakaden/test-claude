-- 0063 banner cap, write authority, and public/private visibility.
-- Re-runnable and non-destructive: one transaction, rolled back.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0063_activity_banners_test.sql
--
-- The cases that matter: the 10-photo cap holds from BOTH directions (a check
-- violation past 9 and a unique violation on a taken slot -- there is no third
-- way to add an 11th row), and a banner on a PRIVATE activity is invisible to
-- anon, since the bucket itself is public and the row is the only thing gating
-- discovery.

begin;

create temporary table _r (case_name text, outcome text);

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
end $$;

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

-- RLS FILTERS on UPDATE/DELETE rather than raising, so an exception-based helper
-- reads a forbidden statement as allowed. Write-effect cases assert ROW_COUNT.
create or replace function pg_temp.exec_rows(case_name text, uid uuid, sql text, expect text)
returns void language plpgsql as $$
declare n bigint;
begin
  begin
    perform pg_temp.as_user(uid); execute sql; get diagnostics n = row_count; reset role;
    if expect = 'refused' then
      insert into _r values (case_name,
        case when n = 0 then 'PASS - filtered by RLS (0 rows)' else 'FAIL - ALLOWED (' || n || ' rows)' end);
    else
      insert into _r values (case_name,
        case when n > 0 then 'PASS - allowed (' || n || ' rows)' else 'FAIL - filtered to 0 rows' end);
    end if;
  exception when others then
    reset role;
    insert into _r values (case_name,
      case when expect='refused' then 'PASS - refused (' || sqlstate || ': ' || sqlerrm || ')'
           else 'FAIL - refused (' || sqlstate || ': ' || sqlerrm || ')' end);
  end;
end $$;

create temporary table _fx as
select gen_random_uuid() as owner_id,
       gen_random_uuid() as outsider_id;

do $$
declare fx record;
begin
  select * into fx from _fx;
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (fx.owner_id,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated','b.owner.zz@udontech.ac.th',   now(), now()),
         (fx.outsider_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','b.outsider.zz@udontech.ac.th',now(), now());
end $$;

-- Two activities: one public, one private, same owner.
create temporary table _act as
select gen_random_uuid() as pub_id, gen_random_uuid() as priv_id;

do $$
declare fx record; t record;
begin
  select * into fx from _fx; select * into t from _act;
  insert into public.activities (id, title, starts_at, is_public, created_by)
  values (t.pub_id,  'ZZBANNER public',  now() + interval '1 day', true,  fx.owner_id),
         (t.priv_id, 'ZZBANNER private', now() + interval '1 day', false, fx.owner_id);
end $$;

do $$
declare fx record; t record; i int;
begin
  select * into fx from _fx; select * into t from _act;

  -- Write authority is the 0061 co-editor axis, not a role.
  perform pg_temp.exec('01 outsider staff adds a banner', fx.outsider_id,
    format('insert into public.activity_banners (activity_id, storage_path, sort_order, uploaded_by)
            values (%L, %L, 0, %L)', t.pub_id, t.pub_id || '/out.jpg', fx.outsider_id), 'refused');

  perform pg_temp.exec('02 owner adds a banner', fx.owner_id,
    format('insert into public.activity_banners (activity_id, storage_path, sort_order, uploaded_by)
            values (%L, %L, 0, %L)', t.pub_id, t.pub_id || '/b0.jpg', fx.owner_id), 'allowed');

  -- uploaded_by is pinned to the caller, so the trail cannot be forged.
  perform pg_temp.exec('03 owner forges uploaded_by', fx.owner_id,
    format('insert into public.activity_banners (activity_id, storage_path, sort_order, uploaded_by)
            values (%L, %L, 1, %L)', t.pub_id, t.pub_id || '/forge.jpg', fx.outsider_id), 'refused');

  -- Fill slots 1..9 so the activity holds the full 10.
  perform pg_temp.as_user(fx.owner_id);
  for i in 1..9 loop
    insert into public.activity_banners (activity_id, storage_path, sort_order, uploaded_by)
    values (t.pub_id, t.pub_id || '/b' || i || '.jpg', i, fx.owner_id);
  end loop;
  reset role;

  insert into _r
  select '04 ten banners accepted', case when count(*) = 10 then 'PASS - 10' else 'FAIL - ' || count(*) end
  from public.activity_banners where activity_id = t.pub_id;

  -- THE CAP, from both directions. There is no third way to add an 11th row.
  perform pg_temp.exec('05 eleventh banner, slot 10 (check)', fx.owner_id,
    format('insert into public.activity_banners (activity_id, storage_path, sort_order, uploaded_by)
            values (%L, %L, 10, %L)', t.pub_id, t.pub_id || '/b10.jpg', fx.owner_id), 'refused');

  perform pg_temp.exec('06 eleventh banner, taken slot (unique)', fx.owner_id,
    format('insert into public.activity_banners (activity_id, storage_path, sort_order, uploaded_by)
            values (%L, %L, 5, %L)', t.pub_id, t.pub_id || '/dup.jpg', fx.owner_id), 'refused');

  -- Reordering is allowed; re-pointing a banner at another activity is not
  -- (activity_id and storage_path carry no UPDATE grant).
  perform pg_temp.exec_rows('07 owner reorders a banner', fx.owner_id,
    format('update public.activity_banners set sort_order = 9 where activity_id = %L and sort_order = 0',
           t.pub_id), 'refused');   -- collides with the row already at 9

  perform pg_temp.exec('08 owner re-points a banner to another activity', fx.owner_id,
    format('update public.activity_banners set activity_id = %L where activity_id = %L and sort_order = 0',
           t.priv_id, t.pub_id), 'refused');

  perform pg_temp.exec_rows('09 outsider deletes a banner', fx.outsider_id,
    format('delete from public.activity_banners where activity_id = %L', t.pub_id), 'refused');

  -- A banner on the PRIVATE activity, for the anon visibility cases below.
  perform pg_temp.exec('10 owner adds a banner to the private activity', fx.owner_id,
    format('insert into public.activity_banners (activity_id, storage_path, sort_order, uploaded_by)
            values (%L, %L, 0, %L)', t.priv_id, t.priv_id || '/p0.jpg', fx.owner_id), 'allowed');
end $$;

-- anon sees the public activity's banners and NOT the private one's. Capture the
-- counts as anon first, then reset role before writing _r -- the temp table is
-- owned by the session role and anon cannot insert into it (0059's trap).
do $$
declare t record; n_pub int; n_priv int;
begin
  select * into t from _act;
  set local role anon;
  select count(*) into n_pub  from public.activity_banners where activity_id = t.pub_id;
  select count(*) into n_priv from public.activity_banners where activity_id = t.priv_id;
  reset role;
  insert into _r values ('11 anon sees public activity banners',
    case when n_pub = 10 then 'PASS - 10' else 'FAIL - ' || n_pub end);
  insert into _r values ('12 anon sees private activity banners',
    case when n_priv = 0 then 'PASS - 0 rows' else 'FAIL - ' || n_priv || ' leaked' end);
end $$;

-- safe_uuid must return NULL, never raise: a storage policy casts a path segment,
-- and AND operand order is not guaranteed, so a regex guard cannot protect a cast.
do $$
declare v uuid;
begin
  select public.safe_uuid('not-a-uuid') into v;
  insert into _r values ('13 safe_uuid swallows a bad cast',
    case when v is null then 'PASS - null' else 'FAIL - ' || v::text end);
exception when others then
  insert into _r values ('13 safe_uuid swallows a bad cast', 'FAIL - raised ' || sqlstate);
end $$;

-- The bucket is public but bounded; an unbounded public bucket is an open file host.
do $$
declare b record;
begin
  select public, file_size_limit, allowed_mime_types into b
  from storage.buckets where id = 'activity-banners';
  insert into _r values ('14 bucket public with size+mime limits',
    case when b.public and b.file_size_limit = 5242880 and array_length(b.allowed_mime_types,1) = 3
         then 'PASS' else 'FAIL - ' || coalesce(b.public::text,'?') || '/' ||
              coalesce(b.file_size_limit::text,'?') end);
end $$;

-- No anon SELECT policy on storage.objects for this bucket: object serving
-- bypasses RLS by design, but LISTING must stay closed.
do $$
declare n int;
begin
  select count(*) into n from pg_policies
  where schemaname='storage' and tablename='objects'
    and policyname like 'activity_banners_storage%'
    and 'anon' = any (roles);
  insert into _r values ('15 no anon policy on the banner bucket',
    case when n = 0 then 'PASS - 0' else 'FAIL - ' || n end);
end $$;

select case_name, outcome from _r order by case_name;

rollback;
