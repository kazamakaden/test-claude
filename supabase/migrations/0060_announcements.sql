-- §5/§16 Announcements.
--
-- /announcements has been a PageShell "coming soon" stub since Phase 1, linked
-- from the footer but absent from navItems — a dead link, not an unbuilt
-- feature (B-1).
--
-- A table rather than a content_blocks row (0031). content_blocks is
-- slug-keyed: one editable page of copy, which is right for "11 ดี 11 เก่ง
-- อวท." and wrong for a feed of dated posts that are published, pinned and
-- superseded. Its header did anticipate /announcements reusing it; that was
-- written before the shape was decided, and a single row cannot express "the
-- third-newest announcement".
--
-- th/en are separate columns rather than a jsonb blob or a second table, and
-- the _en halves are nullable so the app can tell "no English yet" (fall back
-- to Thai) from "deliberately blank" — the same convention, and the same
-- reasoning, as content_blocks.

create type public.announcement_status as enum ('draft', 'published');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),

  title_th text not null check (char_length(title_th) between 1 and 200),
  title_en text check (title_en is null or char_length(title_en) <= 200),
  body_th text not null default '' check (char_length(body_th) <= 20000),
  body_en text check (body_en is null or char_length(body_en) <= 20000),

  status public.announcement_status not null default 'draft',

  -- Set by the trigger below on the draft -> published transition, never by a
  -- client: a caller-chosen publish date can order a feed however it likes.
  published_at timestamptz,

  -- §16 "Announcement" is a notification type, so publishing fans out. The
  -- flag records that it happened, so re-publishing after an unpublish does
  -- not notify everyone a second time about the same post.
  notified_at timestamptz,

  pinned boolean not null default false,

  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Mirrors books_published_needs_pdf (0053): published implies there is
  -- something to read. With the anon SELECT policy below, that yields
  -- "published => has a body" and "a guest only ever sees published rows", so
  -- the list cannot render an entry with nothing behind it. A database
  -- invariant, not a UI check.
  constraint announcements_published_needs_body
    check (status <> 'published' or char_length(trim(body_th)) > 0)
);

create index announcements_status_published_idx
  on public.announcements (status, pinned desc, published_at desc);
create index announcements_author_idx on public.announcements (author_id);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

-- Everyone reads published rows, including guests (§5: "Guest = read-only
-- official content").
create policy "announcements_select_published"
  on public.announcements for select to anon, authenticated
  using (status = 'published');

-- Staff see their own drafts too, so a post can be written over several
-- sittings and previewed before it goes out.
create policy "announcements_select_staff"
  on public.announcements for select to authenticated
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

-- content:manage — the same grant that governs editable page copy (0032).
create policy "announcements_insert_staff"
  on public.announcements for insert to authenticated
  with check (
    author_id = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

create policy "announcements_update_staff"
  on public.announcements for update to authenticated
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) )
  with check ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

-- content:delete is admin-only (lib/auth/permissions.ts), so deletion is too.
-- Staff can unpublish; removing the record entirely is a different authority.
create policy "announcements_delete_admin"
  on public.announcements for delete to authenticated
  using ( ( select public.current_role() ) = 'admin'::public.user_role );

-- Column allow-list on all three commands, not just SELECT. That is 0055's
-- lesson applied up front: 0008 revoked SELECT only and left every column
-- INSERT-able, which is how attendance ended up forgeable.
revoke all on public.announcements from authenticated, anon;

grant select (id, title_th, title_en, body_th, body_en, status,
              published_at, pinned, author_id, created_at, updated_at)
  on public.announcements to anon, authenticated;

-- published_at and notified_at are absent: both are set by the trigger below.
-- A client that could write published_at could reorder the feed at will.
grant insert (title_th, title_en, body_th, body_en, status, pinned, author_id)
  on public.announcements to authenticated;

grant update (title_th, title_en, body_th, body_en, status, pinned)
  on public.announcements to authenticated;

grant delete on public.announcements to authenticated;

-- ---------------------------------------------------------------------
-- Publish side effects
-- ---------------------------------------------------------------------
-- §16: publishing fans out as a broadcast notification (recipient_id null),
-- which reuses the whole 0036 -> 0038 chain for free — per-user read state,
-- the nav bell, the /notifications page and web push all work with no further
-- code.
--
-- A trigger, not app code, for the same reason 0036 gave: `notifications` has
-- no INSERT policy for `authenticated` at all, so a signed-in user cannot
-- forge a broadcast addressed to everyone. Routing this through the app would
-- have meant opening that door.
create function public.announcement_publish_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := coalesce(new.published_at, now());

    -- Notify once per announcement, ever. Without this, unpublish/republish
    -- re-notifies everyone about a post they have already seen.
    if new.notified_at is null then
      new.notified_at := now();

      insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
      values (
        null,                       -- broadcast (§16)
        'announcement',
        new.title_th,               -- entity's own name; locale-neutral
        'announcementPublished',
        jsonb_build_object('title', new.title_th),
        '/announcements/' || new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger announcements_publish_effects
  before update on public.announcements
  for each row execute function public.announcement_publish_effects();

-- An announcement created directly as published (rather than saved as a draft
-- first) must notify too; BEFORE UPDATE alone would miss it.
create function public.announcement_insert_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, now());
    new.notified_at := now();

    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    values (null, 'announcement', new.title_th, 'announcementPublished',
            jsonb_build_object('title', new.title_th),
            '/announcements/' || new.id::text);
  end if;
  return new;
end;
$$;

create trigger announcements_insert_effects
  before insert on public.announcements
  for each row execute function public.announcement_insert_effects();

-- Trigger-only, revoked in the SAME migration that defines them: `create or
-- replace` resets grants to PUBLIC EXECUTE, and a later revoke is one
-- forgotten migration away from never happening (the 0011 -> 0012 sequence).
revoke execute on function public.announcement_publish_effects() from anon, authenticated, public;
revoke execute on function public.announcement_insert_effects() from anon, authenticated, public;
