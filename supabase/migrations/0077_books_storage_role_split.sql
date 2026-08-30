-- 0029's storage policies were never updated for the 0046-0049 role rework.
--
-- 0049 rewrote every policy on public.books from the old
-- ('student','teacher','aft_teacher','admin') list to ('aft','teacher','admin').
-- The storage.objects policies in 0029 kept the old list verbatim, and
-- `aft_teacher` has been UNSTORABLE since 0046 (profiles_role_allowed), so it
-- matches nobody. Three live consequences:
--
-- 1. An `aft` -- นักศึกษา อวท., the role book authoring was deliberately
--    narrowed to (document:draft:submit) -- could create a book row
--    (books_insert_own admits aft) but could NOT upload its PDF or cover.
--    Since books_published_needs_pdf (0053) requires a PDF to publish, an
--    `aft` could never produce a publishable book at all.
-- 2. A `student`, who cannot author a book, still held INSERT on both buckets
--    and could write objects nothing would ever point at -- litter invisible
--    to the app's row-based delete.
-- 3. The staff clause on SELECT and DELETE read ('aft_teacher','admin'), i.e.
--    admin-only. A `teacher` could see a draft book row (books_select_staff
--    admits them) but could not mint a signed URL for its PDF, so the reader
--    failed for the very reviewer it was built for.
--
-- The fix is only to bring these three in line with what 0049 already did one
-- table over. No new authority is granted to anyone: `aft` gains exactly the
-- upload its books_insert_own already assumed, `teacher` gains exactly the read
-- its books_select_staff already assumed, and `student` loses an INSERT it had
-- no legitimate use for.
--
-- Worth knowing for the next role change: 0063's activity-banner policies were
-- immune to all of this because they delegate to can_edit_activity() instead of
-- naming roles. A policy that names roles has to be found and updated by hand
-- every time the role model moves; one that calls a predicate does not.

alter policy "books_storage_insert_own" on storage.objects
  with check (
    bucket_id in ('books', 'book-covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.current_role()) = any (array['aft','teacher','admin']::public.user_role[])
  );

alter policy "books_storage_delete_own_or_staff" on storage.objects
  using (
    bucket_id in ('books', 'book-covers')
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.current_role()) = any (array['aft','teacher','admin']::public.user_role[])
    )
  );

-- The subquery still runs under the caller's own RLS on public.books (every
-- policy here is security invoker), so it can only ever match rows
-- books_select_* would already show this same caller.
alter policy "books_storage_select_authenticated" on storage.objects
  using (
    bucket_id in ('books', 'book-covers')
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.current_role()) = any (array['aft','teacher','admin']::public.user_role[])
      or exists (
        select 1 from public.books b
        where (b.pdf_path = storage.objects.name or b.cover_path = storage.objects.name)
          and b.status = 'published'
      )
    )
  );

-- books_storage_update_own and books_storage_select_anon are deliberately
-- untouched: neither names a role. The first is pure folder ownership, the
-- second is "the object belongs to a published book", and both are still
-- exactly right.
