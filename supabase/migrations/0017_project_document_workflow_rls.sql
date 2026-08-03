-- INSERT/UPDATE policies for the §11/§12 workflow, plus RLS for
-- signature_records. Existing SELECT policies (0008, extended for
-- aft_teacher in 0011) and the blanket projects_all_admin /
-- documents_all_admin / document_drafts_all_admin /
-- projects_update_aft_teacher / documents_update_aft_teacher policies
-- ALREADY cover every admin and aft_teacher transition — RLS policies for
-- the same command are OR'd together, so one passing permissive policy is
-- enough. No new admin/aft_teacher policy is added here; every policy
-- below is scoped to the owning student/author or to plain teacher, the
-- two roles that had zero write access before this migration.
--
-- IMPORTANT: these UPDATE policies alone do NOT guarantee a caller can
-- only make one specific legal transition. Postgres combines multiple
-- permissive policies for the same command by OR-ing every applicable
-- USING clause together and OR-ing every applicable WITH CHECK clause
-- together, independently — not pairwise per policy. That means a caller
-- who satisfies one policy's USING can still satisfy a *different*
-- policy's WITH CHECK in the same UPDATE, even though no single policy
-- permits that exact (old, new) pair. The actual authoritative guard
-- against skipping a stage is the BEFORE UPDATE trigger added in 0016
-- (enforce_project_status_transition / enforce_document_status_transition)
-- — it sees both OLD and NEW, which WITH CHECK alone never can. The
-- policies below still matter for deciding *who* may touch a row at all
-- and for role/data checks the trigger doesn't cover (e.g. requiring
-- rejected_reason on reject) — read them as "who may attempt this", with
-- the trigger as "is this specific transition even legal".

alter table public.signature_records enable row level security;

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------

create policy "projects_insert_own_draft"
  on public.projects for insert
  to authenticated
  with check (owner_id = auth.uid() and status = 'draft');

-- Scopes which rows the owner may touch at all (their own, still-draft
-- rows) and which new status values are even reachable through this
-- policy. The transition trigger (0016) is what actually prevents this
-- from being combined with another policy's WITH CHECK to skip a stage.
create policy "projects_update_own_draft"
  on public.projects for update
  to authenticated
  using (owner_id = auth.uid() and status = 'draft')
  with check (owner_id = auth.uid() and status in ('draft', 'teacher_review'));

-- Plain teacher only: recommend (teacher_review -> admin_approval) or
-- reject back to draft, with a reason required whenever rejecting.
--
-- owner_id <> auth.uid() matters beyond "no self-review": teachers also
-- hold project:draft:submit (inherited from student permissions), so a
-- teacher can own a submitted project. Without this exclusion, Postgres's
-- OR-combination of multiple permissive policies (USING clauses are OR'd
-- across ALL policies independently of WITH CHECK) would let a
-- teacher-owner satisfy this policy's USING (current_role='teacher' and
-- status='teacher_review') while satisfying projects_update_own_draft's
-- WITH CHECK (owner_id=auth.uid() and status in ('draft','teacher_review'))
-- — silently editing their own submission's content post-submit, bypassing
-- the "frozen once submitted" rule that policy exists to enforce.
create policy "projects_update_teacher_recommend"
  on public.projects for update
  to authenticated
  using (
    public.current_role() = 'teacher'
    and status = 'teacher_review'
    and owner_id <> auth.uid()
  )
  with check (
    public.current_role() = 'teacher'
    and status in ('admin_approval', 'draft')
    and (status <> 'draft' or rejected_reason is not null)
  );

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------

create policy "documents_insert_own_draft"
  on public.documents for insert
  to authenticated
  with check (owner_id = auth.uid() and status = 'draft');

create policy "documents_update_own_draft"
  on public.documents for update
  to authenticated
  using (owner_id = auth.uid() and status = 'draft')
  with check (owner_id = auth.uid() and status in ('draft', 'signed'));

-- Separate policy from the one above, scoping who may attempt the
-- signed -> pending_approval submit step. As with projects, this alone
-- does not stop a caller from combining this policy's USING with the
-- draft policy's WITH CHECK to jump draft -> pending_approval directly —
-- the transition trigger (0016) is what actually closes that.
create policy "documents_update_own_submit"
  on public.documents for update
  to authenticated
  using (owner_id = auth.uid() and status = 'signed')
  with check (owner_id = auth.uid() and status = 'pending_approval');

-- No new teacher policy for documents: document:approve is aft_teacher/
-- admin only per the existing permission matrix (no teacher-tier document
-- permission exists), and both already hold unconditional UPDATE via
-- 0011/0008. Plain teacher correctly gets nothing new here.

-- ---------------------------------------------------------------------
-- document_drafts
-- ---------------------------------------------------------------------

-- New: owner can edit draft content, but only while the parent document is
-- still 'draft' — frozen the instant it's signed.
create policy "document_drafts_update_own"
  on public.document_drafts for update
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_drafts.document_id
        and d.owner_id = auth.uid()
        and d.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_drafts.document_id
        and d.owner_id = auth.uid()
        and d.status = 'draft'
    )
  );

-- Modifies an EXISTING policy: 0008's document_drafts_insert_own checked
-- ownership only, not document status — an owner could insert stray draft
-- rows even after signing. Recreated with the same status guard as the
-- update policy above.
drop policy "document_drafts_insert_own" on public.document_drafts;
create policy "document_drafts_insert_own"
  on public.document_drafts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_drafts.document_id
        and d.owner_id = auth.uid()
        and d.status = 'draft'
    )
  );

-- ---------------------------------------------------------------------
-- signature_records
-- ---------------------------------------------------------------------

create policy "signature_records_select_own"
  on public.signature_records for select
  to authenticated
  using (signer_id = auth.uid());

create policy "signature_records_select_reviewer"
  on public.signature_records for select
  to authenticated
  using (public.current_role() in ('teacher', 'aft_teacher', 'admin'));

-- Independent of sign_document() — a direct insert attempt is equally safe:
-- signer must be the caller, and the parent document must be their own
-- still-draft document. sign_document() inserts before flipping the
-- document's status specifically so it satisfies this same check.
create policy "signature_records_insert_own"
  on public.signature_records for insert
  to authenticated
  with check (
    signer_id = auth.uid()
    and exists (
      select 1 from public.documents d
      where d.id = signature_records.document_id
        and d.owner_id = auth.uid()
        and d.status = 'draft'
    )
  );

-- Deliberately NO update/delete policy for ANY role, including admin — a
-- deviation from the sibling-table "_all_admin for all" pattern. A
-- signature is a legal artifact; if even admin could silently rewrite one
-- via the app, it stops being trustworthy evidence of who signed what. If
-- a signed document was signed in error, the fix is rejecting the document
-- back to draft (a documents.status change that doesn't touch this table
-- at all) — the stale signature_records row just stays as history.
