-- Give officers (anyone holding an อวท. position, 0044) the member-management
-- authority aft_teacher already has — approving pending signups and editing an
-- approved member's identity fields — without giving them anything more.
--
-- Two layers, because neither alone is sufficient:
--
--   RLS  decides whether the UPDATE statement may touch the row at all.
--   Triggers decide what the transition itself is allowed to be. Permissive
--        policies OR together and WITH CHECK never sees OLD, so "an officer
--        may not demote an admin" is not expressible in RLS — a caller could
--        otherwise pair one policy's USING with another's WITH CHECK.
--
-- Nothing existing loses access: aft_teacher's own branches are untouched.

-- 1. RLS -----------------------------------------------------------------
--
-- `( select ... )` rather than a bare call: 0041 took auth_rls_initplan from
-- 26 findings to 0, and a policy written the old way would reintroduce one.
create policy "profiles_update_officer"
  on public.profiles for update
  to authenticated
  using      ( ( select public.current_position() ) is not null )
  with check ( ( select public.current_position() ) is not null );

-- 2. Role transitions ----------------------------------------------------
--
-- Unchanged for every existing actor. The only addition is the officer branch
-- at the bottom, which deliberately sits BELOW the admin/aft_teacher guards so
-- an officer inherits none of their exemptions:
--
--   * cannot change their own role          (the auth.uid() check, unchanged)
--   * cannot mint or demote an admin        (the 'admin' branch, unchanged)
--   * cannot grant aft_teacher              (the aft_teacher check, unchanged)
--   * cannot demote an existing aft_teacher (new, officer-specific: staff are
--     not an officer's to reassign, even though aft_teacher may do it)
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.user_role;
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

  actor := public.current_role();

  if new.role = 'admin' or old.role = 'admin' then
    if actor <> 'admin' then
      raise exception 'insufficient privilege to change role';
    end if;
    return new;
  end if;

  if new.role = 'aft_teacher' and actor <> 'admin' then
    raise exception 'insufficient privilege to grant aft_teacher';
  end if;

  if actor in ('admin', 'aft_teacher') then
    return new;
  end if;

  -- 0045: an อวท. officer approves pending signups and assigns ordinary
  -- roles. Staff rows stay out of reach.
  if public.current_position() is not null then
    if old.role = 'aft_teacher' then
      raise exception 'insufficient privilege to change an อวท. teacher role';
    end if;
    return new;
  end if;

  raise exception 'insufficient privilege to change role';
end;
$$;

-- 3. Identity fields -----------------------------------------------------
--
-- Same shape: officers may edit an ordinary member's student_id / department /
-- class / club, but not a staff or admin member's.
create or replace function public.prevent_member_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id     is not distinct from old.student_id
     and new.department_id is not distinct from old.department_id
     and new.class_name    is not distinct from old.class_name
     and new.club_id       is not distinct from old.club_id
  then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if public.current_role() in ('admin', 'aft_teacher') then
    return new;
  end if;

  if public.current_position() is not null then
    if old.role in ('admin', 'aft_teacher') then
      raise exception 'insufficient privilege to change member identity fields';
    end if;
    return new;
  end if;

  raise exception 'insufficient privilege to change member identity fields';
end;
$$;

-- 4. Re-revoke -----------------------------------------------------------
--
-- MANDATORY, not defensive: `create or replace function` resets a function's
-- grants to the PostgreSQL default of PUBLIC EXECUTE, silently undoing an
-- earlier REVOKE. That is exactly how 0011 reopened handle_new_user() and had
-- to be fixed by 0012. Both functions above were just replaced, so both need
-- this in the same migration that replaced them.
revoke execute on function public.prevent_role_self_escalation() from anon, authenticated, public;
revoke execute on function public.prevent_member_identity_change() from anon, authenticated, public;
