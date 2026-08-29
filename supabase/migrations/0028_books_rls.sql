-- Books RLS. Per the confirmed decision, publishing is gated on อวท.
-- teacher / admin, not every signed-in user — the same tier
-- document:approve already uses for the §12 workflow.
alter table public.books enable row level security;

create policy "books_select_published"
  on public.books for select
  to anon, authenticated
  using (status = 'published');

create policy "books_select_own"
  on public.books for select
  to authenticated
  using (owner_id = auth.uid());

create policy "books_select_staff"
  on public.books for select
  to authenticated
  using (public.current_role() in ('aft_teacher', 'admin'));

-- `to authenticated` alone is not enough: a `pending` signup already holds
-- a valid JWT (it just lacks workspace:access in the app layer), so
-- current_role() must be checked explicitly here or an unapproved account
-- could write to the shelf before ever being approved.
create policy "books_insert_own"
  on public.books for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and public.current_role() in ('student', 'teacher', 'aft_teacher', 'admin')
    and status = 'draft'
  );

-- Owner may only touch a book while it is still a draft, and the row must
-- remain a draft after the edit — so an owner can never flip their own
-- book to published, and once staff has published it the owner loses
-- write access until staff unpublishes it again. Simple by design (see
-- CLAUDE.md task 2/3): no request-to-republish workflow.
create policy "books_update_own_draft"
  on public.books for update
  to authenticated
  using (
    owner_id = auth.uid()
    and status = 'draft'
    and public.current_role() in ('student', 'teacher', 'aft_teacher', 'admin')
  )
  with check (
    owner_id = auth.uid()
    and status = 'draft'
  );

-- Deleting one's own book is not restricted to draft — removing a mistake
-- (including an already-published one) is a strictly safer operation than
-- silently re-publishing content, and the "Simple direct manage" decision
-- doesn't call for a staff-mediated takedown request for one's own upload.
create policy "books_delete_own"
  on public.books for delete
  to authenticated
  using (
    owner_id = auth.uid()
    and public.current_role() in ('student', 'teacher', 'aft_teacher', 'admin')
  );

-- Staff: full authority over every book, any status — this is what
-- actually performs publish/unpublish (setting status regardless of the
-- owner-only draft restriction above).
create policy "books_staff_all"
  on public.books for all
  to authenticated
  using (public.current_role() in ('aft_teacher', 'admin'))
  with check (public.current_role() in ('aft_teacher', 'admin'));
