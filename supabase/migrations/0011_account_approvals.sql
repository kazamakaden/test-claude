-- §14 admin allow-list for numeric student-ID email local parts, plus the
-- อาจารย์ อวท. (aft_teacher) role split into the reviewer/approver RLS.

create table public.approved_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email like '%@udontech.ac.th'),
  role public.user_role not null default 'student',
  student_id text check (student_id ~ '^[0-9]{11,}$'),
  department_id uuid references public.departments (id),
  note text,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A roster of who is permitted to sign up, not app data — admin-only, no
-- student/teacher/aft_teacher policy exists for it at all.
alter table public.approved_accounts enable row level security;

create policy "approved_accounts_all_admin"
  on public.approved_accounts for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Rewrite of 0001's handle_new_user(): §14 numeric local-part emails
-- (student IDs) must be pre-approved; named staff emails still sign up
-- freely as 'teacher'. This is the actual enforcement point — not the
-- Server Action (§19 forbids trusting an app-layer check alone), mirroring
-- the three-layer pattern already used for the @udontech.ac.th domain check
-- (client Zod -> server re-validate -> DB CHECK).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_part text := split_part(new.email, '@', 1);
  approved public.approved_accounts%rowtype;
begin
  if local_part ~ '^[0-9]{11,}$' then
    select * into approved from public.approved_accounts where email = new.email;

    if not found then
      raise exception 'account not approved: %', new.email;
    end if;

    insert into public.profiles (id, email, role, student_id, department_id)
    values (new.id, new.email, approved.role, local_part, approved.department_id);
  else
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'teacher');
  end if;

  return new;
end;
$$;

-- Extend the reviewer read policies (0008) to include aft_teacher — missing
-- one would silently give AFT advisors less access than plain teachers.
drop policy "attendance_select_reviewer" on public.attendance;
create policy "attendance_select_reviewer"
  on public.attendance for select
  to authenticated
  using (public.current_role() in ('teacher', 'aft_teacher', 'admin'));

drop policy "projects_select_reviewer" on public.projects;
create policy "projects_select_reviewer"
  on public.projects for select
  to authenticated
  using (public.current_role() in ('teacher', 'aft_teacher', 'admin'));

drop policy "documents_select_reviewer" on public.documents;
create policy "documents_select_reviewer"
  on public.documents for select
  to authenticated
  using (public.current_role() in ('teacher', 'aft_teacher', 'admin'));

drop policy "document_drafts_select_reviewer" on public.document_drafts;
create policy "document_drafts_select_reviewer"
  on public.document_drafts for select
  to authenticated
  using (public.current_role() in ('teacher', 'aft_teacher', 'admin'));

-- New: aft_teacher approval authority (project:approve / document:approve)
-- and activity management (activity:manage) — below admin's FOR ALL, above
-- plain teacher's read-only reviewer access.
create policy "projects_update_aft_teacher"
  on public.projects for update
  to authenticated
  using (public.current_role() = 'aft_teacher')
  with check (public.current_role() = 'aft_teacher');

create policy "documents_update_aft_teacher"
  on public.documents for update
  to authenticated
  using (public.current_role() = 'aft_teacher')
  with check (public.current_role() = 'aft_teacher');

create policy "activities_write_aft_teacher"
  on public.activities for insert
  to authenticated
  with check (public.current_role() = 'aft_teacher');

create policy "activities_update_aft_teacher"
  on public.activities for update
  to authenticated
  using (public.current_role() = 'aft_teacher')
  with check (public.current_role() = 'aft_teacher');
