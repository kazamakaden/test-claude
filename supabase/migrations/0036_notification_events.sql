-- §16 notifications: give the table a write path and a per-user read state.
--
-- Until now nothing in the app ever created a notification — `.from("notifications")`
-- appeared exactly once in the codebase, as a read (services/dashboard.ts). Every
-- row came from seed.sql. Approvals, submissions and reviews notified nobody.
--
-- Two structural problems are fixed here before any writer is added:
--
-- 1. i18n. The seeded rows store Thai prose directly in `title`. A notification
--    is read by the RECIPIENT, whose locale is unknown at write time, so text
--    baked in at insert time is wrong for half the audience. System-generated
--    rows instead store `message_key` + `message_params` and are translated at
--    render time from the same dictionaries as the rest of the app (§30.3).
--    `title` stays NOT NULL and carries the entity's own name (a project or
--    document title is locale-neutral), so legacy readers and free-text
--    announcements keep working unchanged.
--
-- 2. Read state. `notifications.read` is one boolean on a row that, for
--    broadcasts (`recipient_id is null`, §16), is SHARED by every user. One
--    person marking it read would mark it read for all — and in practice nobody
--    can, because notifications_update_own_read (0008) requires
--    `recipient_id = auth.uid()`, which is never true for a broadcast. So a
--    badge built on that column would show a count no user could ever clear.
--    notification_reads gives each user their own read row, and works
--    identically for personal and broadcast notifications.

alter table public.notifications
  add column message_key text,
  add column message_params jsonb,
  add column link text;

comment on column public.notifications.message_key is
  'Dictionary key under notifications.messages.* for system-generated rows. Null for free-text/announcement rows, which render `title` instead.';

-- ---------------------------------------------------------------------
-- Per-user read state
-- ---------------------------------------------------------------------

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index notification_reads_user_idx on public.notification_reads (user_id);

alter table public.notification_reads enable row level security;

-- Read state is private and self-managed: a user may only ever see, create or
-- clear their OWN read markers. There is deliberately no admin policy — an
-- admin has no business knowing whether a given user has read something, and
-- nothing in the app needs it.
create policy "notification_reads_select_own"
  on public.notification_reads for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "notification_reads_insert_own"
  on public.notification_reads for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "notification_reads_delete_own"
  on public.notification_reads for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Writers
--
-- Every writer below is a TRIGGER, not an application-layer insert, for two
-- reasons this codebase already relies on elsewhere (enforce_project_status_
-- transition, handle_new_user):
--
--   * It cannot be forgotten. Any path that changes a status — a Server
--     Action, a future Edge Function, a manual Table Editor fix — notifies.
--   * It needs no INSERT policy for users. These are `security definer`, so
--     notifications are created by the database itself and a signed-in user
--     can never forge one addressed to somebody else. There is intentionally
--     still no INSERT policy on public.notifications for `authenticated`.
--
-- Per 0006/0012: `create or replace` resets a function's grants to the
-- PostgreSQL default (PUBLIC EXECUTE), so EXECUTE is revoked at the bottom of
-- this file, in the same migration that defines them. These are trigger-only
-- functions and must not be callable via /rest/v1/rpc/<name>.
-- ---------------------------------------------------------------------

-- Fan-out helper: notify every holder of the given roles except the actor.
-- Notifying the person who just performed the action is noise, never news.
create or replace function public.notify_roles(
  p_roles public.user_role[],
  p_type public.notification_type,
  p_title text,
  p_key text,
  p_params jsonb,
  p_link text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
  select p.id, p_type, p_title, p_key, p_params, p_link
  from public.profiles p
  where p.role = any (p_roles)
    and p.id is distinct from (select auth.uid());
end;
$$;

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
    -- people who now have work to do hear about it.
    perform public.notify_roles(
      array['teacher', 'aft_teacher', 'admin']::public.user_role[],
      'approval', new.title, 'projectSubmitted', v_params, v_link);

  elsif new.status = 'admin_approval' then
    perform public.notify_roles(
      array['aft_teacher', 'admin']::public.user_role[],
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

create trigger projects_notify_status_change
  after update of status on public.projects
  for each row execute function public.notify_project_status_change();

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
    perform public.notify_roles(
      array['aft_teacher', 'admin']::public.user_role[],
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

create trigger documents_notify_status_change
  after update of status on public.documents
  for each row execute function public.notify_document_status_change();

-- Account approval / revocation (the /approvals and /members flows). `pending`
-- is the un-approved state (0019/0020), so crossing that boundary in either
-- direction is what the member actually needs to hear about.
create or replace function public.notify_member_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if old.role = 'pending' and new.role <> 'pending' then
    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    values (new.id, 'approval', coalesce(new.full_name, new.email),
            'accountApproved', jsonb_build_object('role', new.role::text), '/dashboard');

  elsif old.role <> 'pending' and new.role = 'pending' then
    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    values (new.id, 'approval', coalesce(new.full_name, new.email),
            'accountRevoked', '{}'::jsonb, '/pending');
  end if;

  return new;
end;
$$;

create trigger profiles_notify_role_change
  after update of role on public.profiles
  for each row execute function public.notify_member_role_change();

-- Trigger-only: never callable over REST. See 0006/0012 — this must live in
-- the same migration as the create-or-replace above, or the default
-- PUBLIC EXECUTE grant silently stands.
revoke execute on function public.notify_roles(public.user_role[], public.notification_type, text, text, jsonb, text) from anon, authenticated, public;
revoke execute on function public.notify_project_status_change() from anon, authenticated, public;
revoke execute on function public.notify_document_status_change() from anon, authenticated, public;
revoke execute on function public.notify_member_role_change() from anon, authenticated, public;
