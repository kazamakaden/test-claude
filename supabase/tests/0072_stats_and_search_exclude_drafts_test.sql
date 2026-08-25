-- Matrix for 0072: get_activity_stats() and search_all() must exclude drafts.
--
-- Self-rolling-back and re-runnable. Asserts BOTH directions on purpose: a
-- test that only checks the draft is hidden would also pass against a function
-- that returns nothing at all, which is the failure mode 0064's and 0065's
-- matrices were each written to rule out.
--
-- Case 07/08 are the ones that matter most and are NOT about drafts: search_all
-- fails TOTALLY, not partially, when it touches a column outside a caller's
-- grants -- an earlier version selected profiles.created_at and 42501'd the
-- whole function for guests rather than hiding one section. Any edit to this
-- function has to re-prove the guest path still returns its other groups.

begin;

create temp table zz_results(id text, ok boolean, detail text) on commit drop;
-- The role switches below apply to this table too, so without this grant every
-- insert 42501s as `authenticated`/`anon` and the run dies on case 01. A
-- harness requirement, not part of what is under test.
grant insert on zz_results to authenticated, anon;

do $$
declare
  teacher uuid;
  student uuid;
  draft_id uuid;
  base_pending int; with_draft int; after_publish int;
  s_draft int; s_pub int;
  guest_groups int; guest_acts int;
begin
  select id into teacher from public.profiles where role in ('teacher','aft') limit 1;
  select id into student from public.profiles where role = 'student' limit 1;

  ------------------------------------------------------------------ as staff
  perform set_config('request.jwt.claims',
    json_build_object('sub', teacher, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select coalesce(sum(pending),0) into base_pending from public.get_activity_stats();

  insert into public.activities (title, starts_at, category, status, academic_year, created_by)
  values ('ZZ0072 draft', date_trunc('month', now()) + interval '6 days',
          'org', 'pending', 2569, teacher)
  returning id into draft_id;

  -- 01: staff RLS really does return the draft. If this ever fails the rest of
  -- the file proves nothing, because the filter would be hiding a row that was
  -- never visible in the first place.
  insert into zz_results values ('01 staff RLS sees the draft (guard)',
    (select count(*) from public.activities where id = draft_id) = 1,
    'expected 1');

  select coalesce(sum(pending),0) into with_draft from public.get_activity_stats();
  insert into zz_results values ('02 stats: draft does NOT raise pending',
    with_draft = base_pending,
    format('base=%s withDraft=%s', base_pending, with_draft));

  select count(*) into s_draft from public.search_all('ZZ0072', 20);
  insert into zz_results values ('03 search: draft NOT returned to staff',
    s_draft = 0, format('hits=%s', s_draft));

  -- publish, then the same two must flip -- the other direction
  update public.activities
     set publish_status = 'published', is_public = true
   where id = draft_id;

  select coalesce(sum(pending),0) into after_publish from public.get_activity_stats();
  insert into zz_results values ('04 stats: published DOES raise pending',
    after_publish = base_pending + 1,
    format('base=%s afterPublish=%s', base_pending, after_publish));

  select count(*) into s_pub from public.search_all('ZZ0072', 20);
  insert into zz_results values ('05 search: published IS returned to staff',
    s_pub = 1, format('hits=%s', s_pub));

  -- back to draft for the student/guest cases
  update public.activities set is_public = false, publish_status = 'draft'
   where id = draft_id;

  ---------------------------------------------------------------- as student
  perform set_config('request.jwt.claims',
    json_build_object('sub', student, 'role', 'authenticated')::text, true);

  insert into zz_results values ('06 student sees 0 rows for the draft',
    (select count(*) from public.activities where id = draft_id) = 0,
    'RLS, not the new predicate');

  ------------------------------------------------------------------ as guest
  perform set_config('request.jwt.claims', null, true);
  reset role;
  set local role anon;

  -- 07/08: the total-failure guard. A guest must still get a working function
  -- returning MORE THAN ONE section, which is what rules out the 42501 mode.
  --
  -- The search term matters and the first draft of this test got it wrong: it
  -- used 'a', which reads like a harmless match-anything probe but matches
  -- NOTHING here -- every guest-visible title is Thai. That produced a FAIL
  -- that looked exactly like the regression this case exists to catch. 'อาสา'
  -- is used instead because it genuinely spans two entity types (an activity
  -- and a project) among rows a signed-out visitor can read.
  select count(distinct entity) into guest_groups from public.search_all('อาสา', 20);
  insert into zz_results values ('07 guest: search_all still returns >1 section',
    guest_groups >= 2, format('entity groups=%s (expected >=2)', guest_groups));

  select count(*) into guest_acts from public.search_all('ZZ0072', 20);
  insert into zz_results values ('08 guest: draft not returned',
    guest_acts = 0, format('hits=%s', guest_acts));

  ------------------------------------------------------------------- cleanup
  perform set_config('request.jwt.claims', null, true);
  reset role;
  delete from public.activities where id = draft_id;

  insert into zz_results values ('09 cleanup: no ZZ0072 rows left',
    (select count(*) from public.activities where title like 'ZZ0072%') = 0, '');
end $$;

-- 10: grants unchanged after `create or replace`. Here PUBLIC EXECUTE is the
-- INTENDED state (guests search, guests see the stats card), unlike a
-- trigger-only function where the same default is exactly what must be
-- revoked. Checked rather than assumed -- this is the 0011->0012 trap.
insert into zz_results
select '10 grants: anon+authenticated can execute both',
       count(*) = 4,
       format('grants found=%s', count(*))
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name in ('search_all','get_activity_stats')
  and grantee in ('anon','authenticated')
  and privilege_type = 'EXECUTE';

select id, case when ok then 'PASS' else 'FAIL' end as status, detail
from zz_results order by id;

rollback;
