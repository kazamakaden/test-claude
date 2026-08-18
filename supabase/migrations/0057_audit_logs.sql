-- §19 "audit logs". The last of the §20 tables, and the one whose absence is
-- already a live gap rather than a missing feature: every privileged action
-- this app has shipped so far leaves no record at all. `deleteMemberAction`
-- (actions/members.ts) calls auth.admin.deleteUser() and the profile cascades
-- away with it — an account is destroyed and nothing anywhere says who did it
-- or what it was. Same for role grants, approval revocation, project and
-- document approvals, and book publication.
--
-- Two design decisions, both load-bearing:
--
-- 1. APPEND-ONLY, ENFORCED BY GRANT, NOT BY POLICY. `authenticated` gets a
--    SELECT policy (admin only) and nothing else — no INSERT, UPDATE or DELETE
--    policy exists, and the underlying grants are revoked too. That double
--    layer is the 0055 lesson applied from the start rather than after the
--    fact: a policy that merely doesn't exist is a boundary held by omission,
--    and the next migration to add one reopens it.
--
-- 2. WRITTEN BY TRIGGERS, NEVER BY APP CODE. The same choice 0036 made for
--    notifications, for a stronger reason here: an audit trail an application
--    caller can write is an audit trail they can forge, and one they can
--    forget to call is one that silently has holes. Triggers fire for a Server
--    Action, a psql session, the Table Editor and a service-role script alike
--    — including, deliberately, writes that bypass RLS entirely, which is
--    exactly the class of change most worth recording.

create table public.audit_logs (
  id bigserial primary key,

  -- Null for anything not done by a signed-in user: a migration, a
  -- service-role script, a cascade. Null is meaningful here ("no session"),
  -- not missing data, which is why there is no NOT NULL and no placeholder.
  actor_id uuid references public.profiles (id) on delete set null,

  -- Denormalised copy of who the actor was AT THE TIME. actor_id alone is not
  -- enough: profiles.id is `on delete set null` here, so deleting the actor
  -- would erase the one field naming them. An audit trail that a later
  -- deletion can blank is not an audit trail.
  actor_email text,
  actor_role public.user_role,

  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_table text not null,
  entity_id text,

  -- jsonb, and only the columns that changed. Storing whole rows would put
  -- citizen_id, GPS and device fingerprints into a table with a completely
  -- different access story from the one they were revoked out of (0005/0008).
  before_data jsonb,
  after_data jsonb,

  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_table, entity_id);
create index audit_logs_action_idx on public.audit_logs (action);

alter table public.audit_logs enable row level security;

-- Admin reads. Nobody writes, updates or deletes through the API at all.
create policy "audit_logs_select_admin"
  on public.audit_logs for select to authenticated
  using ( ( select public.current_role() ) = 'admin'::public.user_role );

revoke all on public.audit_logs from authenticated, anon;
revoke all on sequence public.audit_logs_id_seq from authenticated, anon;
grant select on public.audit_logs to authenticated;

comment on table public.audit_logs is
  'Append-only §19 audit trail. Written ONLY by security-definer triggers; authenticated holds SELECT and nothing else, and admin is the only role any SELECT policy admits. Not writable, updatable or deletable through the API by anyone, admin included.';

-- ---------------------------------------------------------------------
-- Writer
-- ---------------------------------------------------------------------
-- One helper the triggers share. SECURITY DEFINER so it can insert into a
-- table with no insert grant; owned by postgres, so it also bypasses the RLS
-- that admits nobody.
create function public.write_audit_log(
  p_action text,
  p_entity_table text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
  v_role public.user_role;
begin
  -- Resolved once, here, so the row carries who the actor was at the time
  -- even after the account is gone.
  if v_actor is not null then
    select p.email, p.role into v_email, v_role
    from public.profiles p where p.id = v_actor;
  end if;

  insert into public.audit_logs
    (actor_id, actor_email, actor_role, action, entity_table, entity_id, before_data, after_data)
  values
    (v_actor, v_email, v_role, p_action, p_entity_table, p_entity_id, p_before, p_after);
end;
$$;

revoke execute on function public.write_audit_log(text, text, text, jsonb, jsonb) from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
-- Scoped to privilege- and state-changing events, not every column edit. An
-- audit log that records a user fixing a typo in their own display name buries
-- the role grant three pages down.

-- profiles: role and ตำแหน่ง are privilege grants (§6 — a ตำแหน่ง SETS the
-- role via sync_role_with_position). Both are admin-only to change, and both
-- are exactly what an attacker would want to change quietly.
create function public.audit_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    perform public.write_audit_log(
      'member.role_changed', 'profiles', new.id::text,
      jsonb_build_object('role', old.role),
      jsonb_build_object('role', new.role, 'email', new.email));
  end if;

  if new.position is distinct from old.position then
    perform public.write_audit_log(
      'member.position_changed', 'profiles', new.id::text,
      jsonb_build_object('position', old.position),
      jsonb_build_object('position', new.position, 'email', new.email));
  end if;

  return new;
end;
$$;

create trigger profiles_audit_change
  after update of role, position on public.profiles
  for each row execute function public.audit_profile_change();

-- Deletion is the event with no other trace: the row is gone and, because
-- deleteMember() goes through auth.admin.deleteUser(), so is the auth user.
-- AFTER DELETE on profiles catches the cascade too.
create function public.audit_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit_log(
    'member.deleted', 'profiles', old.id::text,
    jsonb_build_object('email', old.email, 'role', old.role, 'student_id', old.student_id),
    null);
  return old;
end;
$$;

create trigger profiles_audit_delete
  after delete on public.profiles
  for each row execute function public.audit_profile_delete();

-- attendance: DELETE and UPDATE only, deliberately not INSERT. A check-in is
-- already its own record, so auditing inserts would duplicate the table. What
-- has no other trace is a check-in being altered or removed — and since 0055
-- no client can do either, any row here means someone went around the API
-- with service-role or psql. That is precisely what this catches.
create function public.audit_attendance_tamper()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.write_audit_log(
      'attendance.deleted', 'attendance', old.id::text,
      jsonb_build_object('activity_id', old.activity_id, 'student_id', old.student_id,
                         'status', old.status, 'recorded_at', old.recorded_at),
      null);
    return old;
  end if;

  perform public.write_audit_log(
    'attendance.updated', 'attendance', new.id::text,
    jsonb_build_object('status', old.status, 'recorded_at', old.recorded_at),
    jsonb_build_object('status', new.status, 'recorded_at', new.recorded_at));
  return new;
end;
$$;

create trigger attendance_audit_tamper
  after update or delete on public.attendance
  for each row execute function public.audit_attendance_tamper();

-- Workflow approvals (§11/§12). The status column IS the decision, so only a
-- transition is recorded.
create function public.audit_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  perform public.write_audit_log(
    tg_table_name || '.status_changed', tg_table_name, new.id::text,
    jsonb_build_object('status', old.status),
    jsonb_build_object('status', new.status, 'title', new.title));
  return new;
end;
$$;

create trigger projects_audit_status
  after update of status on public.projects
  for each row execute function public.audit_status_change();

create trigger documents_audit_status
  after update of status on public.documents
  for each row execute function public.audit_status_change();

create trigger books_audit_status
  after update of status on public.books
  for each row execute function public.audit_status_change();

-- A published book is public content; its removal should not be silent.
create function public.audit_book_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit_log(
    'book.deleted', 'books', old.id::text,
    jsonb_build_object('title', old.title, 'status', old.status),
    null);
  return old;
end;
$$;

create trigger books_audit_delete
  after delete on public.books
  for each row execute function public.audit_book_delete();

-- Trigger-only, never callable over REST. Same migration as the definitions,
-- because `create or replace` resets grants to PUBLIC EXECUTE and a later
-- revoke is one forgotten migration away from not happening — the exact
-- 0011 -> 0012 sequence this project already lived through once.
revoke execute on function public.audit_profile_change() from anon, authenticated, public;
revoke execute on function public.audit_profile_delete() from anon, authenticated, public;
revoke execute on function public.audit_attendance_tamper() from anon, authenticated, public;
revoke execute on function public.audit_status_change() from anon, authenticated, public;
revoke execute on function public.audit_book_delete() from anon, authenticated, public;
