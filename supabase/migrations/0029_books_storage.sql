-- Storage for books' PDFs and cover images. First Storage usage in this
-- repo (0016 already noted why signature_records didn't need it — a
-- signature data URL is tens of KB and fits a text column; a PDF does not).
--
-- Both buckets are PRIVATE. A public bucket makes every object
-- world-readable *by path*, regardless of books.status — a draft's PDF
-- would be one URL guess away from public, defeating the draft state
-- entirely. Reads go through a signed URL minted per request instead (see
-- lib/books.ts), authorized by the policies below.
--
-- 25 MB (not 50) keeps headroom under the project-wide upload ceiling.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 26214400, array['application/pdf']);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

-- Accepted, documented risk: allowed_mime_types validates the
-- client-declared Content-Type, not magic bytes — a renamed binary sent as
-- application/pdf will store. Acceptable because objects are only ever
-- served from the supabase.co storage origin and can never execute in the
-- app's own origin; this is not the same risk class as, say, accepting an
-- uploaded HTML file into a bucket the app origin could ever serve from.

-- Path convention: {owner_id}/{book_id}/{uuid}.{ext} — the first folder
-- segment is the ownership check.
create policy "books_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('books', 'book-covers')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_role() in ('student', 'teacher', 'aft_teacher', 'admin')
  );

create policy "books_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('books', 'book-covers')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('books', 'book-covers')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "books_storage_delete_own_or_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('books', 'book-covers')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_role() in ('aft_teacher', 'admin')
    )
  );

-- Authenticated SELECT: own objects, staff (any object), or the object is
-- attached to an already-published book. The subquery runs under the
-- caller's own RLS on public.books (this policy is security invoker, like
-- every other policy here), so it only ever matches rows books_select_*
-- (0028) would already let this same caller see.
create policy "books_storage_select_authenticated"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('books', 'book-covers')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_role() in ('aft_teacher', 'admin')
      or exists (
        select 1 from public.books b
        where (b.pdf_path = storage.objects.name or b.cover_path = storage.objects.name)
          and b.status = 'published'
      )
    )
  );

-- Anon needs its own SELECT policy: a signed URL for a published book is
-- minted with the *caller's own* client (lib/supabase/server.ts /
-- lib/supabase/client.ts), and for a guest that caller is anon — never the
-- service-role key, which this codebase never puts in a request path.
create policy "books_storage_select_anon"
  on storage.objects for select
  to anon
  using (
    bucket_id in ('books', 'book-covers')
    and exists (
      select 1 from public.books b
      where (b.pdf_path = storage.objects.name or b.cover_path = storage.objects.name)
        and b.status = 'published'
    )
  );
