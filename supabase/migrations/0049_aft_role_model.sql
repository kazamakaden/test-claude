-- นักศึกษา อวท. (`aft`) becomes a real role, and holding a ตำแหน่ง is what
-- confers it. Apply AFTER 0048, which adds the enum label in its own
-- transaction.
--
-- Two things change shape here:
--
--   1. ตำแหน่ง stops being a permission axis. It no longer grants member
--      editing (0045's profiles_update_officer is dropped); instead it SETS
--      the role. That makes prevent_position_change (0044) the load-bearing
--      guard — assigning a ตำแหน่ง is now a privilege grant, admin-only.
--   2. `aft` and `teacher` are deliberately identical for authorization. The
--      split exists so reporting can tell an อวท. student member from actual
--      staff, not to give them different powers.

-- 1. The CHECK has to accept the value before anything can write it ---------
alter table public.profiles drop constraint profiles_role_allowed;
alter table public.profiles
  add constraint profiles_role_allowed
  check (role in ('guest', 'student', 'aft', 'teacher', 'admin'));

-- 2. ตำแหน่ง drives the role ------------------------------------------------
--
-- Only ever moves student <-> aft. `teacher` and `admin` are left alone on
-- purpose: `advisor` (ครู) is one of the eight ตำแหน่ง precisely so a real
-- teacher can hold an office, and promoting/demoting them into a student
-- member because of it would be wrong.
create or replace function public.sync_role_with_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.position is not distinct from old.position then
    return new;
  end if;

  if new.position is not null and new.role = 'student' then
    new.role := 'aft';
  elsif new.position is null and new.role = 'aft' then
    new.role := 'student';
  end if;

  return new;
end;
$function$;

revoke execute on function public.sync_role_with_position() from anon, authenticated, public;

-- Named to sort AFTER every profiles_prevent_* trigger. BEFORE triggers fire
-- in alphabetical order, so the escalation guard evaluates the row the caller
-- actually submitted (role unchanged, position changed) and passes, and only
-- then does this rewrite the role. Sorting it earlier would make the guard
-- see a role change nobody asked for.
drop trigger if exists profiles_sync_role_with_position on public.profiles;
create trigger profiles_sync_role_with_position
  before update on public.profiles
  for each row
  execute function public.sync_role_with_position();

-- 3. `aft` gets everything `teacher` has ----------------------------------

alter policy activities_update_staff on public.activities
  using      ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) )
  with check ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

alter policy activities_write_staff on public.activities
  with check ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

alter policy attendance_select_reviewer on public.attendance
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

alter policy books_delete_own on public.books
  using (
    owner_id = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

alter policy books_insert_own on public.books
  with check (
    owner_id = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
    and status = 'draft'::public.book_status
  );

alter policy books_select_staff on public.books
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

alter policy books_update_own_draft on public.books
  using (
    owner_id = ( select auth.uid() )
    and status = 'draft'::public.book_status
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  )
  with check ( owner_id = ( select auth.uid() ) and status = 'draft'::public.book_status );

alter policy content_blocks_update_staff on public.content_blocks
  using      ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) )
  with check ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

alter policy document_drafts_select_reviewer on public.document_drafts
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

alter policy documents_select_reviewer on public.documents
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

alter policy projects_select_reviewer on public.projects
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

-- The §11 recommend step. This one tested `= 'teacher'` EXACTLY rather than a
-- role array — leaving it would let an อวท. member submit a draft and then be
-- unable to move it to admin_approval, stuck inside their own workflow.
alter policy projects_update_teacher_recommend on public.projects
  using (
    ( select public.current_role() ) = any (array['aft','teacher']::public.user_role[])
    and status = 'teacher_review'::public.project_status
    and owner_id <> ( select auth.uid() )
  )
  with check (
    ( select public.current_role() ) = any (array['aft','teacher']::public.user_role[])
    and status = any (array['admin_approval','draft']::public.project_status[])
    and (status <> 'draft'::public.project_status or rejected_reason is not null)
  );

alter policy signature_records_select_reviewer on public.signature_records
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

-- Row-role tests (which rows are visible / who may subscribe), not caller tests.
alter policy profiles_select_public_directory on public.profiles
  using ( role = any (array['student','aft','teacher','admin']::public.user_role[]) );

alter policy push_subscriptions_insert_own on public.push_subscriptions
  with check (
    user_id = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['student','aft','teacher','admin']::public.user_role[])
  );

-- 4. ตำแหน่ง no longer grants member editing ------------------------------
drop policy if exists profiles_update_officer on public.profiles;

-- 5. Guard triggers lose their ตำแหน่ง branches ---------------------------
--
-- With the officer axis gone, admin is the only actor who may change someone
-- else's role or identity fields. Every other guarantee is unchanged: nobody
-- edits their own role, and admin rows need an admin actor.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if new.id = auth.uid() then
    raise exception 'cannot change your own role';
  end if;

  if public.current_role() <> 'admin' then
    raise exception 'insufficient privilege to change role';
  end if;

  return new;
end;
$function$;

create or replace function public.prevent_member_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.student_id        is not distinct from old.student_id
     and new.department_id is not distinct from old.department_id
     and new.class_name    is not distinct from old.class_name
     and new.club_id       is not distinct from old.club_id
  then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if public.current_role() <> 'admin' then
    raise exception 'insufficient privilege to change member identity fields';
  end if;

  return new;
end;
$function$;

-- MANDATORY after `create or replace`: it resets grants to PUBLIC EXECUTE,
-- silently undoing an earlier REVOKE. 0011 reopened handle_new_user() this
-- way, and 0044 left prevent_position_change() open by omitting `public`.
revoke execute on function public.prevent_role_self_escalation() from anon, authenticated, public;
revoke execute on function public.prevent_member_identity_change() from anon, authenticated, public;

-- 6. current_position() has no callers left -------------------------------
-- An unused SECURITY DEFINER function reachable over /rest/v1/rpc is exactly
-- what the security advisor flags, so it goes rather than lingering.
drop function if exists public.current_position();
