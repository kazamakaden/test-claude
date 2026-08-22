-- Performance only. Wraps auth.uid() / current_role() in a scalar subquery so
-- Postgres evaluates them ONCE per query instead of once per row
-- (Supabase advisor: auth_rls_initplan, 26 findings before this migration).
--
-- This is a pure transform. Every predicate below is byte-identical to what
-- was already in pg_policies apart from the `( select ... )` wrapper — the
-- statements were GENERATED from the live catalog rather than retyped,
-- precisely because a transcription slip in a security predicate is an
-- access-control bug, not a typo.
--
-- ALTER POLICY, not DROP + CREATE: there is never an instant where the policy
-- does not exist, and the role/command/permissive attributes cannot be
-- changed by accident.
--
-- `notification_reads`' three policies are absent because 0037 already wrote
-- them in the wrapped form; they are what the target shape was copied from.
--
-- NOT addressed here, deliberately: the 22 `multiple_permissive_policies`
-- advisories. Merging permissive policies changes who can do what, not just
-- how fast, and belongs in its own pass with its own role matrix.

alter policy attendance_insert_own on public.attendance
  with check ((student_id = ( select auth.uid() )));

alter policy attendance_select_own on public.attendance
  using ((student_id = ( select auth.uid() )));

alter policy books_delete_own on public.books
  using (((owner_id = ( select auth.uid() )) AND (( select "current_role"() ) = ANY (ARRAY['student'::user_role, 'teacher'::user_role, 'aft_teacher'::user_role, 'admin'::user_role]))));

alter policy books_insert_own on public.books
  with check (((owner_id = ( select auth.uid() )) AND (( select "current_role"() ) = ANY (ARRAY['student'::user_role, 'teacher'::user_role, 'aft_teacher'::user_role, 'admin'::user_role])) AND (status = 'draft'::book_status)));

alter policy books_select_own on public.books
  using ((owner_id = ( select auth.uid() )));

alter policy books_update_own_draft on public.books
  using (((owner_id = ( select auth.uid() )) AND (status = 'draft'::book_status) AND (( select "current_role"() ) = ANY (ARRAY['student'::user_role, 'teacher'::user_role, 'aft_teacher'::user_role, 'admin'::user_role]))))
  with check (((owner_id = ( select auth.uid() )) AND (status = 'draft'::book_status)));

alter policy document_drafts_insert_own on public.document_drafts
  with check ((EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = document_drafts.document_id) AND (d.owner_id = ( select auth.uid() )) AND (d.status = 'draft'::document_status)))));

alter policy document_drafts_select_own on public.document_drafts
  using ((EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = document_drafts.document_id) AND (d.owner_id = ( select auth.uid() ))))));

alter policy document_drafts_update_own on public.document_drafts
  using ((EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = document_drafts.document_id) AND (d.owner_id = ( select auth.uid() )) AND (d.status = 'draft'::document_status)))))
  with check ((EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = document_drafts.document_id) AND (d.owner_id = ( select auth.uid() )) AND (d.status = 'draft'::document_status)))));

alter policy documents_insert_own_draft on public.documents
  with check (((owner_id = ( select auth.uid() )) AND (status = 'draft'::document_status)));

alter policy documents_select_own on public.documents
  using ((owner_id = ( select auth.uid() )));

alter policy documents_update_own_draft on public.documents
  using (((owner_id = ( select auth.uid() )) AND (status = 'draft'::document_status)))
  with check (((owner_id = ( select auth.uid() )) AND (status = ANY (ARRAY['draft'::document_status, 'signed'::document_status]))));

alter policy documents_update_own_submit on public.documents
  using (((owner_id = ( select auth.uid() )) AND (status = 'signed'::document_status)))
  with check (((owner_id = ( select auth.uid() )) AND (status = 'pending_approval'::document_status)));

alter policy notifications_select_own_or_broadcast on public.notifications
  using (((recipient_id = ( select auth.uid() )) OR (recipient_id IS NULL)));

alter policy profiles_select_own on public.profiles
  using ((id = ( select auth.uid() )));

alter policy profiles_update_own on public.profiles
  using ((id = ( select auth.uid() )))
  with check ((id = ( select auth.uid() )));

alter policy projects_insert_own_draft on public.projects
  with check (((owner_id = ( select auth.uid() )) AND (status = 'draft'::project_status)));

alter policy projects_select_own on public.projects
  using ((owner_id = ( select auth.uid() )));

alter policy projects_update_own_draft on public.projects
  using (((owner_id = ( select auth.uid() )) AND (status = 'draft'::project_status)))
  with check (((owner_id = ( select auth.uid() )) AND (status = ANY (ARRAY['draft'::project_status, 'teacher_review'::project_status]))));

alter policy projects_update_teacher_recommend on public.projects
  using (((( select "current_role"() ) = 'teacher'::user_role) AND (status = 'teacher_review'::project_status) AND (owner_id <> ( select auth.uid() ))))
  with check (((( select "current_role"() ) = 'teacher'::user_role) AND (status = ANY (ARRAY['admin_approval'::project_status, 'draft'::project_status])) AND ((status <> 'draft'::project_status) OR (rejected_reason IS NOT NULL))));

alter policy push_subscriptions_delete_own on public.push_subscriptions
  using ((user_id = ( select auth.uid() )));

alter policy push_subscriptions_insert_own on public.push_subscriptions
  with check (((user_id = ( select auth.uid() )) AND (( select "current_role"() ) = ANY (ARRAY['student'::user_role, 'teacher'::user_role, 'aft_teacher'::user_role, 'admin'::user_role]))));

alter policy push_subscriptions_select_own on public.push_subscriptions
  using ((user_id = ( select auth.uid() )));

alter policy push_subscriptions_update_own on public.push_subscriptions
  using ((user_id = ( select auth.uid() )))
  with check ((user_id = ( select auth.uid() )));

alter policy signature_records_insert_own on public.signature_records
  with check (((signer_id = ( select auth.uid() )) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = signature_records.document_id) AND (d.owner_id = ( select auth.uid() )) AND (d.status = 'draft'::document_status))))));

alter policy signature_records_select_own on public.signature_records
  using ((signer_id = ( select auth.uid() )));
