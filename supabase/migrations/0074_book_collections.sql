-- Three named shelves instead of one undifferentiated pile.
--
-- /documents becomes "11 ดี 11 เก่ง อวท." with two lists (11 ดี / 11 เก่ง) and
-- the new /admin-info page ("สภาพทั่วไปและการบริหารองค์การ") is a third, flat
-- one. Which list a book sits in is a filing decision, NOT a privilege: no
-- policy references this column and none should. Publish authority stays
-- exactly where 0028 put it (document:approve — admin), and the owner-draft
-- boundary is untouched.
--
-- NOT NULL with NO DEFAULT, the activities.category precedent (0068): an
-- insert that omits it raises 23502, so "filed at upload" is a database fact
-- rather than a convention some service file is trusted to follow. Ordering
-- matters — add nullable, backfill, then set not null, or the existing rows
-- fail the constraint the moment it is added.
--
-- No GRANT work here, and that is checked rather than assumed. Unlike
-- attendance (0055), activities (0061) and site_banners (0065), `books` has no
-- column allow-list: anon/authenticated hold table-wide INSERT/UPDATE, so a new
-- column is granted automatically. That is safe only because 0028's policies
-- carry the weight — books_update_own_draft pins status = 'draft' AND
-- owner_id = auth.uid() in BOTH using and with check, so an owner can neither
-- self-publish nor transfer a book despite holding the column grants.

create type public.book_collection as enum ('aft11_good', 'aft11_skilled', 'admin_info');

alter table public.books add column collection public.book_collection;

-- Every existing row is seed/demo content (6 rows, 1 published). They land in
-- 11 ดี so nothing disappears from the shelf on deploy; staff re-file from the
-- edit form afterwards. A default on the column would have been the lazy way
-- to do this and would then have to be dropped again — the backfill is the
-- one-time operation it actually is.
update public.books set collection = 'aft11_good' where collection is null;

alter table public.books alter column collection set not null;

-- Matches how the shelf actually reads: one collection, published first,
-- newest first. Mirrors books_status_published_at_idx (0027) with the
-- collection prepended, since every list query now filters on it.
create index books_collection_status_idx
  on public.books (collection, status, published_at desc);
