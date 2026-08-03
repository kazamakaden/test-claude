-- Found while planning §5 ("admin/teacher อวท. own member data"): today ANY
-- authenticated user can rewrite their own student_id, department_id,
-- class_name and club_id — profiles_update_own (0002) permits the UPDATE,
-- and only role (0002) and citizen_id (0003) have blocking triggers.
-- Verified live against pg_trigger before writing this: exactly three
-- triggers exist on profiles (set_updated_at, prevent_role_self_escalation,
-- prevent_citizen_id_change) and none of them touch these four columns.
-- Since academic_year (0003) is GENERATED from student_id, a student could
-- silently move themselves to a different year/department/class/club, or
-- squat an unissued student_id (it's UNIQUE).
--
-- Personal fields (full_name, avatar_url) stay self-editable — this trigger
-- only locks the four identity/membership columns.
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

  -- No JWT = service role / migration / SQL console. Same carve-out used
  -- throughout this schema (0018, 0024) for non-user-initiated writes.
  if auth.uid() is null then
    return new;
  end if;

  if public.current_role() not in ('admin', 'aft_teacher') then
    raise exception 'insufficient privilege to change member identity fields';
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_member_identity_change() from public, anon, authenticated;

create trigger profiles_prevent_member_identity_change
  before update on public.profiles
  for each row execute function public.prevent_member_identity_change();
