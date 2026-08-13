-- Collapse to four roles: guest / student / teacher / admin.
--
-- `pending` goes away because signing up no longer needs approval — an
-- @udontech.ac.th account is in immediately. `aft_teacher` goes away because
-- nothing sits between teacher and admin any more; 0047 already redistributed
-- its authority across every policy that named it.
--
-- Apply AFTER 0047. The CHECK at the bottom makes both values unstorable, and
-- a policy still testing for one of them would be testing for something the
-- table can no longer contain.
--
-- WHY A CHECK RATHER THAN DROPPING THE ENUM VALUES: PostgreSQL cannot remove a
-- value from an enum in place. Doing it properly means creating a new type and
-- swapping it, which requires dropping and recreating all 18 policies plus
-- current_role(), handle_new_user(), both guard triggers, and notify_roles()
-- (whose signature takes user_role[]) — a large, high-risk rewrite of the
-- auth-critical path to delete two labels nothing can produce. The CHECK gets
-- the property that actually matters: no row can hold either value, enforced
-- by the database rather than by convention.

-- 1. Signup: no waiting room ---------------------------------------------
--
-- Only the role expression changes: 'pending' -> 'student'. §14 split is
-- unchanged — a numeric local part is a student ID, a named address is staff.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  local_part  text := split_part(new.email, '@', 1);
  is_student  boolean := local_part ~ '^[0-9]{11,}$';
  from_google boolean := coalesce(new.raw_app_meta_data -> 'providers' ? 'google', false);
begin
  insert into public.profiles (id, email, role, student_id, full_name, avatar_url)
  values (
    new.id,
    new.email,
    case when is_student then 'student'::public.user_role
                         else 'teacher'::public.user_role end,
    case when is_student then local_part else null end,
    case when from_google
      then left(coalesce(new.raw_user_meta_data ->> 'full_name',
                          new.raw_user_meta_data ->> 'name'), 100)
      else null end,
    case when from_google
         and coalesce(new.raw_user_meta_data ->> 'avatar_url',
                       new.raw_user_meta_data ->> 'picture') ~ '^https://'
      then coalesce(new.raw_user_meta_data ->> 'avatar_url',
                     new.raw_user_meta_data ->> 'picture')
      else null end
  );
  return new;
end;
$function$;

-- 2. Role transitions ----------------------------------------------------
--
-- With aft_teacher gone, the actors who may change someone's role are admin
-- and anyone holding a ตำแหน่ง (0044/0045). A plain teacher no longer can —
-- they lost member:approve in the new matrix. Every other guarantee is
-- unchanged: nobody edits their own role, and only an admin may mint or
-- demote an admin.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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

  if actor = 'admin' then
    return new;
  end if;

  if public.current_position() is not null then
    return new;
  end if;

  raise exception 'insufficient privilege to change role';
end;
$function$;

-- 3. Identity fields -----------------------------------------------------
create or replace function public.prevent_member_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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

  if public.current_role() = 'admin' then
    return new;
  end if;

  if public.current_position() is not null then
    if old.role = 'admin' then
      raise exception 'insufficient privilege to change member identity fields';
    end if;
    return new;
  end if;

  raise exception 'insufficient privilege to change member identity fields';
end;
$function$;

-- 4. Re-revoke -----------------------------------------------------------
--
-- MANDATORY. `create or replace function` resets grants to the PostgreSQL
-- default of PUBLIC EXECUTE, silently undoing an earlier REVOKE — exactly how
-- 0011 reopened handle_new_user() and had to be fixed by 0012, and how 0044
-- left prevent_position_change() open by revoking from anon+authenticated but
-- not public. All three functions above were just replaced.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.prevent_role_self_escalation() from anon, authenticated, public;
revoke execute on function public.prevent_member_identity_change() from anon, authenticated, public;

-- 5. Migrate existing rows off the retired values ------------------------
--
-- Runs as the migration role, so auth.uid() is null and the guard triggers
-- take their service-role carve-out. Same §14 rule the trigger now applies.
update public.profiles
   set role = case when student_id is not null or split_part(email,'@',1) ~ '^[0-9]{11,}$'
                   then 'student'::public.user_role
                   else 'teacher'::public.user_role end
 where role in ('pending', 'aft_teacher');

-- 6. Make them unstorable ------------------------------------------------
alter table public.profiles
  add constraint profiles_role_allowed
  check (role in ('guest', 'student', 'teacher', 'admin'));

comment on constraint profiles_role_allowed on public.profiles is
  'Four-role model. `pending` and `aft_teacher` remain as enum labels only '
  'because PostgreSQL cannot drop an enum value in place; this constraint is '
  'what actually prevents either from being stored.';
