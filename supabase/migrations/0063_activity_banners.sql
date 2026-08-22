-- Activity banner photos: up to 10 per activity, in a PUBLIC Storage bucket.
--
-- Two decisions here differ from the obvious implementation, both on purpose.
--
-- THE CAP IS A CONSTRAINT, NOT A TRIGGER. A `before insert` trigger that counts
-- existing rows is racy: under READ COMMITTED two concurrent inserts each see 9
-- and both commit, giving 11. Making the trigger correct would need `select ...
-- for update` on the parent to serialize. `check (sort_order between 0 and 9)`
-- plus `unique (activity_id, sort_order)` is a hard cap under any concurrency,
-- enforced by an index -- and the ordering key is needed for the carousel anyway,
-- so it costs nothing extra. Reordering becomes a two-phase update (shift out of
-- range, then back), which is the price.
--
-- THE STORAGE PATH IS KEYED ON THE ACTIVITY, NOT THE UPLOADER. 0029's books
-- convention is {uploader_id}/{entity_id}/... with the first folder segment as the
-- ownership check. Copying that here would mean a co-editor keeps update/delete
-- rights over objects they uploaded even after their grant is revoked -- rights
-- that outlive the grant. Keying on {activity_id}/ and testing can_edit_activity()
-- makes storage rights track the grant instead.

-- ---------------------------------------------------------------------
-- A NULL-returning uuid cast
--
-- Storage policies must turn a path segment into a uuid. A bare
-- ((storage.foldername(name))[1])::uuid RAISES 22P02 on a malformed path, and a
-- regex guard placed to its left does not save it: PostgreSQL does not guarantee
-- the evaluation order of AND operands, so the cast can still run first.

create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
returns null on null input
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.safe_uuid(text) from public;
grant execute on function public.safe_uuid(text) to anon, authenticated;

-- ---------------------------------------------------------------------

create table if not exists public.activity_banners (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities (id) on delete cascade,
  storage_path text not null unique,
  -- 0..9 IS the "max 10 photos" rule. See the header.
  sort_order   smallint not null check (sort_order between 0 and 9),
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (activity_id, sort_order)
);

create index if not exists activity_banners_activity_idx
  on public.activity_banners (activity_id, sort_order);

comment on table public.activity_banners is
  'Banner photos for an activity. The 10-photo cap is check(sort_order 0..9) + unique(activity_id, sort_order) -- an index, not a counting trigger, which would be racy.';

alter table public.activity_banners enable row level security;

-- Visibility mirrors the activity: a banner is as public as the event it belongs
-- to. Writes are the co-editor axis from 0061.
create policy "activity_banners_select_public"
  on public.activity_banners for select
  to anon, authenticated
  using (
    exists (select 1 from public.activities a
             where a.id = activity_id and a.is_public = true)
  );

create policy "activity_banners_select_authenticated"
  on public.activity_banners for select
  to authenticated
  using (true);

create policy "activity_banners_write_editor"
  on public.activity_banners for insert
  to authenticated
  with check (
    uploaded_by = ( select auth.uid() )
    and public.can_edit_activity(activity_id)
  );

create policy "activity_banners_update_editor"
  on public.activity_banners for update
  to authenticated
  using      ( public.can_edit_activity(activity_id) )
  with check ( public.can_edit_activity(activity_id) );

create policy "activity_banners_delete_editor"
  on public.activity_banners for delete
  to authenticated
  using ( public.can_edit_activity(activity_id) );

-- Revoke-then-allow-list on all three commands, 0055's lesson: activity_id and
-- storage_path must not be re-pointed after insert (that would let an editor
-- attach an object they no longer have rights over, or move a banner onto an
-- activity they cannot edit). Only sort_order is updatable -- reordering.
revoke all on public.activity_banners from authenticated, anon;
grant select (id, activity_id, storage_path, sort_order, uploaded_by, created_at)
  on public.activity_banners to anon, authenticated;
grant insert (activity_id, storage_path, sort_order, uploaded_by)
  on public.activity_banners to authenticated;
grant update (sort_order) on public.activity_banners to authenticated;
grant delete on public.activity_banners to authenticated;

-- ---------------------------------------------------------------------
-- The bucket
--
-- PUBLIC, chosen knowingly. Consequence stated rather than buried: the banners of
-- a NON-public activity are readable by anyone holding the URL, and CDN copies
-- survive a later flip to private. Paths carry two random UUIDs and there is NO
-- anon SELECT policy on storage.objects for this bucket, so listing is closed and
-- the exposure is "leaked URL", not "enumerable gallery". Do NOT add an anon
-- select policy here the way 0029 did for books.
--
-- file_size_limit and allowed_mime_types are not optional on a public bucket:
-- without them it is an open file host on a college-associated domain.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-banners', 'activity-banners', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {activity_id}/{uuid}.{ext} -- see the header for why the
-- uploader is deliberately NOT the first segment.
create policy "activity_banners_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'activity-banners'
    and public.can_edit_activity(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy "activity_banners_storage_update"
  on storage.objects for update
  to authenticated
  using      ( bucket_id = 'activity-banners'
               and public.can_edit_activity(public.safe_uuid((storage.foldername(name))[1])) )
  with check ( bucket_id = 'activity-banners'
               and public.can_edit_activity(public.safe_uuid((storage.foldername(name))[1])) );

create policy "activity_banners_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'activity-banners'
    and public.can_edit_activity(public.safe_uuid((storage.foldername(name))[1]))
  );

-- Authenticated SELECT so a signed-in editor can list/manage objects. anon gets
-- NO policy: public reads go through the object-serving endpoint, which bypasses
-- RLS by design, while listing stays closed.
create policy "activity_banners_storage_select"
  on storage.objects for select
  to authenticated
  using ( bucket_id = 'activity-banners' );
