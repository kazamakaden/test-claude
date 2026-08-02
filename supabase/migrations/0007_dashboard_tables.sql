-- §8 Dashboard §20 tables. Only the 6 tables the dashboard actually reads;
-- project_drafts, qr_sessions, signature_records, audit_logs stay deferred
-- to their own §30.10 phases.

create type public.activity_status as enum ('pending', 'completed', 'cancelled');
create type public.project_status as enum ('draft', 'teacher_review', 'admin_approval', 'official');
create type public.document_status as enum ('draft', 'signed', 'pending_approval', 'official');
create type public.notification_type as enum ('meeting', 'activity', 'deadline', 'approval', 'announcement');

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  department_id uuid references public.departments (id),
  club_id uuid references public.clubs (id),
  academic_year smallint,
  status public.activity_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  is_public boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activities_department_idx on public.activities (department_id);
create index activities_status_idx on public.activities (status);
create index activities_academic_year_idx on public.activities (academic_year);
create index activities_starts_at_idx on public.activities (starts_at);

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- §15 attendance. GPS/device fingerprint columns are sensitive — see
-- 0008_dashboard_rls.sql for the column-level grant guard (same pattern as
-- profiles.citizen_id in 0005).
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  department_id uuid references public.departments (id),
  class_name text,
  room text,
  status public.activity_status not null default 'pending',
  gps_lat numeric,
  gps_lng numeric,
  device_fingerprint text,
  browser text,
  ip inet,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- §13 "one attendance per student/event" — enforced in schema, not app code.
  unique (activity_id, student_id)
);

create index attendance_activity_idx on public.attendance (activity_id);
create index attendance_student_idx on public.attendance (student_id);
create index attendance_department_idx on public.attendance (department_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status public.project_status not null default 'draft',
  owner_id uuid references public.profiles (id) on delete set null,
  department_id uuid references public.departments (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_status_idx on public.projects (status);
create index projects_owner_idx on public.projects (owner_id);
create index projects_department_idx on public.projects (department_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status public.document_status not null default 'draft',
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_status_idx on public.documents (status);
create index documents_owner_idx on public.documents (owner_id);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_drafts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  content text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index document_drafts_document_idx on public.document_drafts (document_id);

create trigger document_drafts_set_updated_at
  before update on public.document_drafts
  for each row execute function public.set_updated_at();

-- recipient_id nullable = broadcast/announcement (§16), not just a shortcut
-- for seeding before users exist.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id);
create index notifications_created_at_idx on public.notifications (created_at);
