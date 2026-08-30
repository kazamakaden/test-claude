-- Matrix for 0078: who actually receives a §16 review notification.
--
-- Self-rolling-back and re-runnable. Case 00 asserts zero residue before the
-- rollback, so it is visible in the output rather than merely implied.
--
-- Asserts BOTH directions on purpose. A file that only proved a `student` gets
-- nothing would pass just as well against a fan-out that notifies NOBODY --
-- which is this very bug in a worse form, since `aft_teacher` matching no row
-- is exactly how the live gap arose. Cases 01-03 are the load-bearing
-- "notified" guards.
--
-- RLS is deliberately NOT engaged for the status updates: the trigger's
-- fan-out is what is under test, and projects' own policies already have their
-- own coverage. What IS set is request.jwt.claims, because the trigger reads
-- auth.uid() to exclude the actor -- running with no claim at all would make
-- every exclusion vacuously pass.
--
-- The harness trap 0065 hit applies here too: `set local request.jwt.claims`
-- outlives a helper's `reset role`, and prevent_role_self_escalation refuses a
-- role flip performed by a non-admin actor. Every flip below clears the claim
-- first, because the carve-out that path relies on is `auth.uid() is null`.

begin;

create temp table zz_results(id text, ok boolean, detail text) on commit drop;

do $$
declare
  actor      uuid;   -- submits the project; must NOT be notified
  aft_id     uuid;   -- the regression: an อวท. reviewer
  teacher_id uuid;
  admin_id   uuid;
  student_id uuid;
  proj       uuid;
  n          int;
  ids        uuid[];
begin
  select array_agg(id order by id) into ids from public.profiles;
  if coalesce(array_length(ids, 1), 0) < 5 then
    insert into zz_results values ('00a fixtures: need 5 profiles (guard)', false,
      format('found=%s', coalesce(array_length(ids, 1), 0)));
    return;
  end if;
  actor := ids[1]; aft_id := ids[2]; teacher_id := ids[3];
  admin_id := ids[4]; student_id := ids[5];
  insert into zz_results values ('00a fixtures: 5 distinct profiles (guard)', true, '');

  perform set_config('request.jwt.claims', null, true);
  update public.profiles set role = 'teacher' where id = actor;
  update public.profiles set role = 'aft'     where id = aft_id;
  update public.profiles set role = 'teacher' where id = teacher_id;
  update public.profiles set role = 'admin'   where id = admin_id;
  update public.profiles set role = 'student' where id = student_id;

  insert into public.projects (title, owner_id, status)
  values ('ZZ0078 project', actor, 'draft')
  returning id into proj;

  -- Act as the owner, so the actor-exclusion branch is genuinely exercised.
  perform set_config('request.jwt.claims',
    json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  ------------------------------------------------------- draft -> teacher_review
  update public.projects set status = 'teacher_review' where id = proj;

  -- 01: THE REGRESSION. Before 0078 the array said 'aft_teacher', unstorable
  -- since 0046, so an อวท. reviewer matched nothing and was never told.
  select count(*) into n from public.notifications
   where recipient_id = aft_id and message_key = 'projectSubmitted';
  insert into zz_results values ('01 aft IS notified on submit (guard)', n = 1, format('rows=%s', n));

  -- 02/03: and the two roles that already worked must still work -- otherwise
  -- 01 could pass against a fan-out that simply swapped one omission for another.
  select count(*) into n from public.notifications
   where recipient_id = teacher_id and message_key = 'projectSubmitted';
  insert into zz_results values ('02 teacher IS notified on submit (guard)', n = 1, format('rows=%s', n));

  select count(*) into n from public.notifications
   where recipient_id = admin_id and message_key = 'projectSubmitted';
  insert into zz_results values ('03 admin IS notified on submit (guard)', n = 1, format('rows=%s', n));

  -- 04: a plain student is read-only (§6) and reviews nothing.
  select count(*) into n from public.notifications
   where recipient_id = student_id and message_key = 'projectSubmitted';
  insert into zz_results values ('04 student is NOT notified', n = 0, format('rows=%s', n));

  -- 05: notifying the person who just performed the action is noise, not news.
  select count(*) into n from public.notifications
   where recipient_id = actor and message_key = 'projectSubmitted';
  insert into zz_results values ('05 the submitting actor is excluded', n = 0, format('rows=%s', n));

  ------------------------------------------- teacher_review -> admin_approval
  update public.projects set status = 'admin_approval' where id = proj;

  -- 06/07: approval is admin-only (project:approve), so this fan-out is
  -- correctly narrower than the submit one. Asserted rather than assumed,
  -- because 0078 rewrote this array too.
  select count(*) into n from public.notifications
   where recipient_id = admin_id and message_key = 'projectAwaitingApproval';
  insert into zz_results values ('06 admin IS notified on recommend (guard)', n = 1, format('rows=%s', n));

  select count(*) into n from public.notifications
   where recipient_id in (aft_id, teacher_id) and message_key = 'projectAwaitingApproval';
  insert into zz_results values ('07 aft/teacher are NOT notified on recommend', n = 0, format('rows=%s', n));

  -- 08: the owner still hears that their project moved forward.
  select count(*) into n from public.notifications
   where recipient_id = actor and message_key = 'projectRecommended';
  insert into zz_results values ('08 owner IS told it was recommended (guard)', n = 1, format('rows=%s', n));

  perform set_config('request.jwt.claims', null, true);
end $$;

-- 09: the dead notifier is gone. Its only condition needed old.role='pending',
-- unstorable since 0046, so it fired on every profiles UPDATE and could never act.
insert into zz_results
select '09 notify_member_role_change dropped', count(*) = 0, format('functions=%s', count(*))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'notify_member_role_change';

insert into zz_results
select '09b its trigger dropped too', count(*) = 0, format('triggers=%s', count(*))
from pg_trigger where tgname = 'profiles_notify_role_change' and not tgisinternal;

-- 10: `create or replace` resets grants to PUBLIC EXECUTE, silently undoing
-- 0036's revoke -- the 0011 -> 0012 trap. These are trigger-only functions and
-- must be reachable by nobody over /rest/v1/rpc.
insert into zz_results
select '10 replaced notifiers callable by nobody', count(*) = 0,
       format('grants=%s', coalesce(string_agg(routine_name || ':' || grantee, ', '), 'none'))
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name in ('notify_project_status_change', 'notify_document_status_change')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
  and privilege_type = 'EXECUTE';

-- 11: no array anywhere still names a role the table cannot hold.
insert into zz_results
select '11 no notifier still names aft_teacher/pending', count(*) = 0,
       format('stale=%s', coalesce(string_agg(proname, ', '), 'none'))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'notify%'
  and p.prosrc ~ 'aft_teacher|''pending''';

-- 00: residue, before the rollback that follows.
insert into zz_results
select '00 residue: this run''s rows only, rolled back next', true,
       format('projects=%s notifications=%s',
              (select count(*) from public.projects where title = 'ZZ0078 project'),
              (select count(*) from public.notifications where title = 'ZZ0078 project'));

select id, case when ok then 'PASS' else 'FAIL' end as status, detail
from zz_results order by id;

rollback;
