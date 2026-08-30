-- 0036's notification fan-outs were never updated for the 0046-0049 role
-- rework, and one of the three is a live gap.
--
-- notify_roles() selects `where p.role = any (p_roles)`, so a role that cannot
-- be stored matches nobody. `aft_teacher` has been UNSTORABLE since 0046
-- (profiles_role_allowed), which makes each array smaller than it reads:
--
--   projectSubmitted        ['teacher','aft_teacher','admin']  ->  {teacher, admin}
--   projectAwaitingApproval ['aft_teacher','admin']            ->  {admin}
--   documentAwaitingApproval['aft_teacher','admin']            ->  {admin}
--
-- Only the FIRST is wrong. Per §6 an `aft` (นักศึกษา อวท.) holds
-- project:draft:review / project:recommend and sits in the very
-- teacher-review queue this notification announces -- so an อวท. student
-- reviewer has never been told there is work waiting. The other two are
-- correct as they stand, because approval is admin-only now; they are cleaned
-- up anyway, since an array that names a role the table cannot hold reads as
-- intent and will mislead whoever next changes the role model.
--
-- This is the same asymmetry already fixed one layer down:
-- projects_update_teacher_recommend tested `= 'teacher'` exactly, so an อวท.
-- member could submit a draft and then be unable to move it forward. The
-- POLICY was corrected then; the notifier naming the same set was not.
--
-- notify_member_role_change() is dropped rather than repaired. Its only
-- condition is `old.role = 'pending' and new.role <> 'pending'`, and `pending`
-- went unstorable in the same 0046 -- so it has fired on every profiles UPDATE
-- since, and can never act. There is nothing to notify about either: 0046
-- removed the waiting room, so any @udontech.ac.th account is in immediately
-- and no approval event exists. Its dictionary key (accountApproved) is left
-- in place; the notifications table may still hold historical rows that render
-- through it.

-- 1. Project fan-out ---------------------------------------------------------

create or replace function public.notify_project_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_params jsonb := jsonb_build_object('title', new.title);
  v_link text := '/projects/' || new.id::text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'teacher_review' then
    -- Entering the review queue: the owner did this themselves, so only the
    -- people who now have work to do hear about it. `aft` belongs here --
    -- adding it is the whole point of this migration.
    perform public.notify_roles(
      array['aft', 'teacher', 'admin']::public.user_role[],
      'approval', new.title, 'projectSubmitted', v_params, v_link);

  elsif new.status = 'admin_approval' then
    -- Admin only, and that is not an oversight: approval to `official` is
    -- gated on project:approve, which only `admin` holds (§6).
    perform public.notify_roles(
      array['admin']::public.user_role[],
      'approval', new.title, 'projectAwaitingApproval', v_params, v_link);

    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    select new.owner_id, 'approval', new.title, 'projectRecommended', v_params, v_link
    where new.owner_id is not null and new.owner_id is distinct from (select auth.uid());

  elsif new.status = 'official' then
    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    select new.owner_id, 'approval', new.title, 'projectApproved', v_params, v_link
    where new.owner_id is not null and new.owner_id is distinct from (select auth.uid());

  elsif new.status = 'draft' and new.rejected_reason is not null then
    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    select new.owner_id, 'approval', new.title, 'projectRejected',
           v_params || jsonb_build_object('reason', new.rejected_reason), v_link
    where new.owner_id is not null and new.owner_id is distinct from (select auth.uid());
  end if;

  return new;
end;
$$;

-- 2. Document fan-out --------------------------------------------------------

create or replace function public.notify_document_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_params jsonb := jsonb_build_object('title', new.title);
  v_link text := '/documents/manage/' || new.id::text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- 'signed' is deliberately silent: it is the owner signing their own
  -- document (§17), which they just did on screen.
  if new.status = 'pending_approval' then
    -- Admin only, same reasoning as projectAwaitingApproval above:
    -- document:approve is admin-only.
    perform public.notify_roles(
      array['admin']::public.user_role[],
      'approval', new.title, 'documentAwaitingApproval', v_params, v_link);

  elsif new.status = 'official' then
    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    select new.owner_id, 'approval', new.title, 'documentApproved', v_params, v_link
    where new.owner_id is not null and new.owner_id is distinct from (select auth.uid());

  elsif new.status = 'draft' and new.rejected_reason is not null then
    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    select new.owner_id, 'approval', new.title, 'documentRejected',
           v_params || jsonb_build_object('reason', new.rejected_reason), v_link
    where new.owner_id is not null and new.owner_id is distinct from (select auth.uid());
  end if;

  return new;
end;
$$;

-- 3. The dead notifier -------------------------------------------------------

drop trigger if exists profiles_notify_role_change on public.profiles;
drop function if exists public.notify_member_role_change();

-- 4. Re-revoke ---------------------------------------------------------------
--
-- `create or replace` resets a function's grants to the PostgreSQL default
-- (PUBLIC EXECUTE), silently undoing 0036's revoke. This project has been
-- bitten by exactly that twice -- 0011 -> 0012 on handle_new_user(), and 0018
-- had to do the same clean-up for the transition triggers -- so the revoke is
-- restated here rather than assumed to have survived. These are trigger-only
-- functions: nobody should be able to reach them over /rest/v1/rpc.

revoke execute on function public.notify_project_status_change() from anon, authenticated, public;
revoke execute on function public.notify_document_status_change() from anon, authenticated, public;
