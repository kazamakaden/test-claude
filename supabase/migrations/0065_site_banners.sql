-- Homepage banner carousel: images tagged with an academic year and เทอม, newest
-- first, in a PUBLIC Storage bucket.
--
-- Shape borrowed from 0063_activity_banners.sql, with two deliberate departures.
--
-- THE PATH CARRIES NO OWNERSHIP SEGMENT. 0063 keys its objects on {activity_id}/
-- so that storage rights track the per-activity co-editor grant and are lost when
-- that grant is revoked. There is no per-object grant here: the right to write a
-- site banner is simply "is staff", checked live against current_role() in every
-- policy below. A folder segment would encode nothing a policy could use, so the
-- path is a bare {uuid}.{ext} and the role check does all the work.
--
-- DRAFT IS A REAL STATE, NOT A FLAG. A banner imported from Facebook has no year
-- and no เทอม -- the post does not carry them -- so it cannot be described well
-- enough to publish, and an admin fills those in. site_banners_published_needs_term
-- turns that into an invariant instead of a form rule: published => fully
-- described. Combined with site_banners_select_published (anon sees published
-- rows only) that gives published => visible => fully described, the same shape
-- books_published_needs_pdf (0053) gives the shelf.
--
-- PUBLIC BUCKET, consequence stated rather than buried: a DRAFT's image is
-- fetchable by anyone holding its URL, and CDN copies outlive a later delete.
-- Accepted because the content is a banner on its way to a public homepage, and
-- for the Facebook path it was already public on Facebook. Paths carry a random
-- uuid and there is NO anon select policy on storage.objects for this bucket, so
-- listing stays closed -- the exposure is "leaked URL", not "enumerable gallery".
-- Do NOT add an anon select policy here.

create table if not exists public.site_banners (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique,
  status        text not null default 'draft' check (status in ('draft', 'published')),
  -- Thai Buddhist-era year, e.g. 2569. Bounded so a typo cannot sort a banner
  -- to the front of the carousel forever.
  academic_year smallint check (academic_year between 2500 and 2700),
  term          smallint check (term in (1, 2)),
  source        text not null default 'upload' check (source in ('upload', 'facebook')),
  -- Dedupe key for the daily Facebook poll: a post already imported is skipped,
  -- so polling does not accumulate one copy per day. NULL for uploads, and UNIQUE
  -- tolerates any number of NULLs.
  facebook_post_id text unique,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  constraint site_banners_published_needs_term
    check (status <> 'published' or (academic_year is not null and term is not null))
);

comment on table public.site_banners is
  'Homepage banner carousel. published => academic_year and term are both set (site_banners_published_needs_term), so a banner can never reach the homepage half-described.';

-- The carousel's exact ordering, so paging is an index scan rather than a sort.
create index if not exists site_banners_published_idx
  on public.site_banners (status, academic_year desc, term desc, created_at desc);

-- ---------------------------------------------------------------------
-- published_at is set by trigger, never by a client
--
-- Same reasoning as announcements (0060): a caller who can write this column can
-- reorder the feed. It is not in the UPDATE grant below either, so this is the
-- only way it moves.

create or replace function public.set_site_banner_published_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

-- CREATE OR REPLACE resets a function's grants to the PostgreSQL default of
-- PUBLIC EXECUTE. This trigger has no business being callable over /rest/v1/rpc,
-- and skipping this revoke is exactly how 0011 silently undid 0006's.
revoke execute on function public.set_site_banner_published_at() from public, anon, authenticated;

drop trigger if exists site_banners_set_published_at on public.site_banners;
create trigger site_banners_set_published_at
  before insert or update on public.site_banners
  for each row execute function public.set_site_banner_published_at();

-- ---------------------------------------------------------------------
-- RLS

alter table public.site_banners enable row level security;

-- The homepage is public; drafts are not.
drop policy if exists "site_banners_select_published" on public.site_banners;
create policy "site_banners_select_published"
  on public.site_banners for select
  to anon, authenticated
  using ( status = 'published' );

-- Staff review drafts before publishing them, so they must be able to see them.
drop policy if exists "site_banners_select_staff" on public.site_banners;
create policy "site_banners_select_staff"
  on public.site_banners for select
  to authenticated
  using (
    ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

drop policy if exists "site_banners_insert_staff" on public.site_banners;
create policy "site_banners_insert_staff"
  on public.site_banners for insert
  to authenticated
  with check (
    created_by = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

drop policy if exists "site_banners_update_staff" on public.site_banners;
create policy "site_banners_update_staff"
  on public.site_banners for update
  to authenticated
  using      ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) )
  with check ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

drop policy if exists "site_banners_delete_staff" on public.site_banners;
create policy "site_banners_delete_staff"
  on public.site_banners for delete
  to authenticated
  using (
    ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

-- ---------------------------------------------------------------------
-- Column grants
--
-- RLS cannot say "this column must not change" -- a WITH CHECK clause only ever
-- sees the NEW row -- so an allow-list grant is the only mechanism that can
-- (0055, 0061). What must not move after insert:
--
--   storage_path      re-pointing a published row at a different object is how a
--                     reviewed banner becomes an unreviewed one
--   source            so a staff member cannot dress an upload up as a Facebook
--                     import; combined with facebook_post_id below, only the
--                     service-role importer can create a row claiming that origin
--   facebook_post_id  the dedupe key; a client that can write it can make the
--                     next poll skip a real post, or re-import one forever
--   created_by        authorship
--   published_at      see the trigger above
--
-- Only the four review fields are updatable. `source` is not insertable either:
-- its default covers every client insert, and the service-role client used by the
-- importer bypasses grants entirely.

revoke all on public.site_banners from anon, authenticated;

grant select (id, storage_path, status, academic_year, term, source, created_by,
              created_at, published_at)
  on public.site_banners to anon, authenticated;
-- facebook_post_id is deliberately absent above: nothing in the app reads it,
-- only the importer's own service-role client does.

grant insert (storage_path, status, academic_year, term, created_by)
  on public.site_banners to authenticated;

grant update (status, academic_year, term) on public.site_banners to authenticated;

grant delete on public.site_banners to authenticated;

-- ---------------------------------------------------------------------
-- The bucket
--
-- file_size_limit and allowed_mime_types are not optional on a public bucket:
-- without them it is an open file host on a college-associated domain.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-banners', 'site-banners', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site_banners_storage_insert" on storage.objects;
create policy "site_banners_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-banners'
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

drop policy if exists "site_banners_storage_update" on storage.objects;
create policy "site_banners_storage_update"
  on storage.objects for update
  to authenticated
  using      ( bucket_id = 'site-banners'
               and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) )
  with check ( bucket_id = 'site-banners'
               and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

drop policy if exists "site_banners_storage_delete" on storage.objects;
create policy "site_banners_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'site-banners'
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

-- Authenticated SELECT so staff can list and manage objects. anon gets NO policy:
-- public reads go through the object-serving endpoint, which bypasses RLS by
-- design, while listing stays closed.
drop policy if exists "site_banners_storage_select" on storage.objects;
create policy "site_banners_storage_select"
  on storage.objects for select
  to authenticated
  using ( bucket_id = 'site-banners' );
