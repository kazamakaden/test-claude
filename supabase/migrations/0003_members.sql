-- §9 Members module. Adds departments/clubs and extends profiles with the
-- §14 student-ID fields and filter columns.

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- §14 7-digit department code, e.g. '3190100'
  name_th text not null,
  name_en text not null
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name_th text not null,
  name_en text not null
);

alter table public.profiles
  add column student_id text unique check (student_id ~ '^[0-9]{11,}$'),
  add column department_id uuid references public.departments (id),
  add column class_name text,
  add column club_id uuid references public.clubs (id),
  -- §14: store once, never selectable by non-admins (see 0004_members_rls.sql)
  add column citizen_id text;

-- §14: "Year = 69" derived from student_id so it can never drift from it.
alter table public.profiles
  add column academic_year smallint
  generated always as (
    case
      when student_id is not null then substring(student_id from 1 for 2)::smallint
      else null
    end
  ) stored;

create index profiles_department_idx on public.profiles (department_id);
create index profiles_club_idx on public.profiles (club_id);
create index profiles_class_name_idx on public.profiles (class_name);
create index profiles_academic_year_idx on public.profiles (academic_year);
create index profiles_full_name_idx on public.profiles (full_name);

-- §14: citizen_id "cannot be changed without Administrator permission".
create function public.prevent_citizen_id_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.citizen_id is distinct from old.citizen_id
     and old.citizen_id is not null
     and public.current_role() <> 'admin' then
    raise exception 'insufficient privilege to change citizen_id';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_citizen_id_change
  before update on public.profiles
  for each row execute function public.prevent_citizen_id_change();
