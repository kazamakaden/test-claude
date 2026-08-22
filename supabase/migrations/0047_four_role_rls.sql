-- Remove `aft_teacher` from every policy that names it (18 of them).
--
-- MUST be applied BEFORE 0046's CHECK constraint: a policy still testing
-- `current_role() = 'aft_teacher'` against a table that can no longer hold
-- that value is dead weight at best, and the order makes the intermediate
-- state coherent rather than momentarily contradictory.
--
-- Where aft_teacher's authority goes, per the 4-role model:
--
--   review / read drafts ......... teacher   (was teacher + aft_teacher)
--   manage activities ............ teacher   (they run them)
--   manage site content .......... teacher
--   APPROVE projects/documents ... admin     (must sit above the submitter)
--   edit members ................. admin + anyone holding a ตำแหน่ง (0044/0045)
--
-- `alter policy` rather than drop+create wherever only the predicate moves:
-- there is never an instant with no policy, and the role/command/permissive
-- attributes cannot drift by accident.

-- 1. Reviewer read lists — drop the value, keep everything else -----------

alter policy attendance_select_reviewer on public.attendance
  using ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

alter policy document_drafts_select_reviewer on public.document_drafts
  using ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

alter policy documents_select_reviewer on public.documents
  using ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

alter policy projects_select_reviewer on public.projects
  using ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

alter policy signature_records_select_reviewer on public.signature_records
  using ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

-- Which roles appear in the PUBLIC directory. Note this tests the ROW's role,
-- not the caller's — anon browsing the member list.
alter policy profiles_select_public_directory on public.profiles
  using ( role = any (array['student','teacher','admin']::public.user_role[]) );

-- Students keep push: they still receive notifications, they just cannot
-- author content.
alter policy push_subscriptions_insert_own on public.push_subscriptions
  with check (
    user_id = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['student','teacher','admin']::public.user_role[])
  );

-- 2. Books: authoring is no longer a student capability -------------------
--
-- A book is a document submission. With `student` read-only, letting a
-- student create one would contradict the model — and RLS is the real
-- boundary, so removing it from the app's `workspace:access` gate alone
-- would not be enough. `document:draft:submit` (teacher+) is the app-side
-- counterpart added alongside this.

alter policy books_insert_own on public.books
  with check (
    owner_id = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[])
    and status = 'draft'::public.book_status
  );

alter policy books_update_own_draft on public.books
  using (
    owner_id = ( select auth.uid() )
    and status = 'draft'::public.book_status
    and ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[])
  )
  with check ( owner_id = ( select auth.uid() ) and status = 'draft'::public.book_status );

alter policy books_delete_own on public.books
  using (
    owner_id = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[])
  );

-- Teachers review book drafts before an admin publishes them, so they keep
-- the staff read.
alter policy books_select_staff on public.books
  using ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

-- ...but blanket ALL (publish, delete anyone's) narrows to admin, matching
-- document:approve.
alter policy books_staff_all on public.books
  using      ( ( select public.current_role() ) = 'admin'::public.user_role )
  with check ( ( select public.current_role() ) = 'admin'::public.user_role );

-- 3. Content and activities move DOWN to teacher --------------------------

alter policy content_blocks_update_staff on public.content_blocks
  using      ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) )
  with check ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

alter policy activities_update_aft_teacher on public.activities
  using      ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) )
  with check ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

alter policy activities_write_aft_teacher on public.activities
  with check ( ( select public.current_role() ) = any (array['teacher','admin']::public.user_role[]) );

-- 4. Approval moves UP to admin -------------------------------------------

alter policy documents_update_aft_teacher on public.documents
  using      ( ( select public.current_role() ) = 'admin'::public.user_role )
  with check ( ( select public.current_role() ) = 'admin'::public.user_role );

alter policy projects_update_aft_teacher on public.projects
  using      ( ( select public.current_role() ) = 'admin'::public.user_role )
  with check ( ( select public.current_role() ) = 'admin'::public.user_role );

-- 5. Redundant policy, dropped rather than re-pointed ---------------------
--
-- profiles_update_aft_teacher existed only to give that role member-editing.
-- profiles_update_admin (0002) and profiles_update_officer (0045) already
-- cover everyone who should have it, so re-pointing this at admin would just
-- duplicate an existing policy and add a second permissive branch to
-- evaluate for no gain.
drop policy profiles_update_aft_teacher on public.profiles;

-- 6. Names should not outlive their meaning -------------------------------

alter policy activities_update_aft_teacher on public.activities rename to activities_update_staff;
alter policy activities_write_aft_teacher  on public.activities rename to activities_write_staff;
alter policy documents_update_aft_teacher  on public.documents  rename to documents_update_admin;
alter policy projects_update_aft_teacher   on public.projects   rename to projects_update_admin;
