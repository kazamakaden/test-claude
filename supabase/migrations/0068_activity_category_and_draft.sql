-- Activity category (อวท./ชมรม) + the draft -> public lifecycle, and the fix for
-- 0008's activities_select_authenticated, which is `using (true)` and would hand
-- every draft to every signed-in user, students included.
--
-- BOTH ENUMS ARE NEW TYPES, so create-and-use in one transaction is fine. The
-- prohibition this project keeps hitting (0010, 0019, 0048) is `alter type ...
-- add value`, which cannot be USED in the transaction that adds it. That is one
-- of two reasons 'draft' is not a fourth public.activity_status; the other is
-- that `status` is the EVENT's lifecycle and is filtered on by
-- listActivities()/getActivityCounts(), which would start counting drafts.

-- ---------------------------------------------------------------------
-- 1. Category

create type public.activity_category as enum (
  'org',    -- อวท.  — an organisation-level activity
  'club'    -- ชมรม  — a club activity
);

-- 'org', not 'aft': `aft` is already a user_role on a different axis. 0044 made
-- the same call naming the ครู position `advisor` rather than `teacher`.

alter table public.activities add column category public.activity_category;

-- Backfill BEFORE the NOT NULL. club_id is the only evidence the table carries.
update public.activities
   set category = case when club_id is not null then 'club' else 'org' end
                    ::public.activity_category
 where category is null;

-- NOT NULL with NO DEFAULT is what makes "chosen at creation" a database fact:
-- an insert that omits it raises 23502 rather than silently landing in a bucket
-- somebody has to notice later.
alter table public.activities alter column category set not null;

comment on column public.activities.category is
  'อวท. (org) or ชมรม (club). Chosen at creation -- NOT NULL, no default.';

-- ---------------------------------------------------------------------
-- 2. The draft -> public lifecycle
--
-- A SECOND axis, not a reuse of is_public. is_public is AUDIENCE ("guests may
-- see this"), and is_public = false already means a live INTERNAL event -- three
-- of them exist in the live database right now, and
-- activity_banners_select_public plus the activity-banners storage policy (0063)
-- both read it with that meaning. Collapsing draft into it would reclassify
-- every internal event as unpublished.

create type public.activity_publish_status as enum ('draft', 'published');

alter table public.activities
  add column publish_status public.activity_publish_status not null default 'published',
  add column published_at   timestamptz;

-- Note the default above and the flip below, in that order and not the other way
-- round: every existing activity is LIVE today, so the add-column default
-- backfills them as 'published' with no table rewrite, and only then does
-- 'draft' become the default for every future insert. Adding this column as
-- `default 'draft'` without a backfill would empty /activities on deploy.
alter table public.activities alter column publish_status set default 'draft';

update public.activities
   set published_at = created_at
 where publish_status = 'published' and published_at is null;

-- The invariant, in the shape of books_published_needs_pdf (0053) and
-- site_banners_published_needs_term (0065): public => published. It is what lets
-- 0063's `a.is_public = true` policies stay correct without being touched, and
-- what makes "a draft is never visible to a guest" true by constraint rather
-- than by four policies agreeing with each other. Added AFTER the backfill --
-- before it, every is_public row would still be draft and this would fail.
alter table public.activities
  add constraint activities_public_needs_published
    check (is_public = false or publish_status = 'published');

comment on column public.activities.publish_status is
  'draft until an explicit confirmation step publishes it. Orthogonal to `status` (the event lifecycle) and to is_public (audience). public => published is enforced by activities_public_needs_published.';

create index if not exists activities_publish_status_idx
  on public.activities (publish_status, starts_at desc);

-- ---------------------------------------------------------------------
-- 3. The publish guard
--
-- Two jobs, one BEFORE trigger:
--
-- (a) published_at is trigger-owned, never client-written (0060, 0065). It is
--     absent from the UPDATE grant below, so this is the only thing that moves it.
--
-- (b) Only STAFF may take the draft -> published step. RLS cannot express this:
--     activities_update_editor passes on `created_by = auth.uid()` ALONE, so an
--     owner who has since been demoted to student keeps the power to publish,
--     and a WITH CHECK clause cannot see the OLD row to notice the transition.
--     A BEFORE trigger can. `auth.uid() is null` is the migration/service-role
--     carve-out, the same one prevent_role_self_escalation uses.
--
-- Unpublishing also forces is_public back to false, so a caller can never trip
-- activities_public_needs_published by withdrawing a public activity.

create or replace function public.activities_publish_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publish_status = 'published'
     and (tg_op = 'INSERT' or old.publish_status is distinct from 'published') then

    -- coalesce(..., false): current_role() is NULL for a caller with no profile
    -- row, and NULL propagates through `= any`, so a bare negation would skip
    -- this raise and fail OPEN. Same reasoning as 0056's create_qr_session.
    if ( select auth.uid() ) is not null
       and not coalesce(
             ( select public.current_role() )
               = any (array['aft','teacher','admin']::public.user_role[]),
             false) then
      raise exception 'only staff may publish an activity' using errcode = '42501';
    end if;

    new.published_at := coalesce(new.published_at, now());

  elsif new.publish_status <> 'published' then
    new.published_at := null;
    new.is_public    := false;
  end if;

  return new;
end;
$$;

-- create or replace RESETS grants to PUBLIC EXECUTE. The 0011 -> 0012 trap.
revoke execute on function public.activities_publish_guard() from public, anon, authenticated;

drop trigger if exists activities_publish_guard on public.activities;
create trigger activities_publish_guard
  before insert or update on public.activities
  for each row execute function public.activities_publish_guard();

-- ---------------------------------------------------------------------
-- 4. SELECT: the actual bug
--
-- DROPPED, not narrowed. Permissive policies OR together, so a `using (true)`
-- policy cannot be fixed by adding stricter ones next to it -- the whole fix
-- would appear to work and change nothing.

drop policy if exists "activities_select_authenticated" on public.activities;

-- Guests and the public list/calendar. The publish_status half is redundant
-- given activities_public_needs_published, and is written out anyway: a policy
-- that states its own rule survives a future relaxation of the constraint.
alter policy "activities_select_public" on public.activities
  using ( is_public = true and publish_status = 'published' );

-- Signed-in members keep EXACTLY today's view minus drafts: every published
-- activity, internal ones (is_public = false) included. This is the policy that
-- keeps /activities, /calendar, the dashboard cards and search_all (0059,
-- SECURITY INVOKER) working for a student.
create policy "activities_select_member"
  on public.activities for select
  to authenticated
  using ( publish_status = 'published' );

-- Staff review drafts before publishing them. A THIRD policy, `to
-- authenticated`, deliberately NOT merged into either of the two above:
-- 0066/0067 showed that a merged `to anon, authenticated` policy evaluates its
-- staff clause for the anon ROLE, where current_role() answers from the JWT
-- CLAIM. The split makes the staff clause unreachable for anon BY GRANT.
--
-- No can_edit_activity() call here: activity_editors_require_staff (0061)
-- guarantees every co-editor already holds a staff role, so this covers them --
-- and a SECURITY DEFINER call in a SELECT policy would run per row.
create policy "activities_select_staff"
  on public.activities for select
  to authenticated
  using (
    ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

-- ---------------------------------------------------------------------
-- 5. activity_banners: the same bug, one table over
--
-- 0063's activity_banners_select_authenticated is also `using (true)`. Left
-- alone, a draft's banner rows -- storage_path, in a PUBLIC bucket, i.e. a
-- working URL -- stay readable by every signed-in user. Fixed here rather than
-- in a follow-up because it is the same leak.
--
-- The exists() runs as the INVOKER against activities, whose policies do not
-- reference activity_banners, so there is no policy cycle -- the one-directional
-- shape 0061's header insists on.

drop policy if exists "activity_banners_select_authenticated" on public.activity_banners;

create policy "activity_banners_select_member"
  on public.activity_banners for select
  to authenticated
  using (
    exists (select 1 from public.activities a
             where a.id = activity_id and a.publish_status = 'published')
  );

create policy "activity_banners_select_staff"
  on public.activity_banners for select
  to authenticated
  using (
    ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

-- ---------------------------------------------------------------------
-- 6. Column grants
--
-- SELECT is untouched and needs no line here: 0061 revoked only insert/update/
-- references, so activities still carries the table-level SELECT grant and the
-- three new columns are readable the moment they exist. That is the OPPOSITE of
-- profiles (0005) and site_banners (0065), where a new column is INVISIBLE until
-- named in a grant -- 0030's trap. Stated because those tables sit next to this
-- one in this repo and behave differently.
--
-- Table-level revoke FIRST (0005): a column-level revoke cannot narrow a
-- table-level grant. Re-revoking is also required because this file REMOVES
-- is_public from the insert allow-list, which a bare `grant` cannot do.

revoke insert, update, references on public.activities from authenticated, anon;

-- INSERT -- excluded, and why:
--   publish_status  THE feature. The column default is the enforcement: every
--                   client insert is a draft, so "new entries are created as
--                   DRAFT" is a property of the database, not a convention in
--                   services/activities.ts (which today hardcodes the opposite).
--   is_public       a draft may not be public, so `false` is the only value a
--                   client could legally insert anyway. Leaving it out turns
--                   that into a clean column-permission error instead of a
--                   constraint violation, and moves the audience decision to the
--                   confirmation step, where it belongs.
--   published_at    trigger-owned.
--   id/created_at/updated_at  as 0061.
-- created_by stays insertable and stays pinned to auth.uid() by
-- activities_write_staff (0061).
grant insert (title, description, department_id, club_id, academic_year, status,
              starts_at, ends_at, location, category, expected_attendees, created_by)
  on public.activities to authenticated;

-- UPDATE -- 0061's list, plus category and publish_status. Still excluded:
-- id, created_by, created_at, updated_at (0061) and published_at (trigger).
--
-- category IS updatable: it is a description, not an authority, and a
-- miscategorised activity is the likeliest correction anyone will need. Column
-- grants are per-ROLE, so "the owner may re-categorise but a co-editor may not"
-- is inexpressible (0061's corollary) -- if the org ever wants category frozen,
-- drop it from this list and it becomes immutable for everyone over REST.
grant update (title, description, department_id, club_id, academic_year, status,
              starts_at, ends_at, location, is_public, category, publish_status,
              expected_attendees)
  on public.activities to authenticated;
