-- §11/§12/§17 draft -> review -> approve -> official workflow for projects
-- and documents. Adds signature_records (deferred from 0007's comment) and
-- the minimal workflow columns needed for a usable reject path.

alter table public.projects
  add column rejected_reason text;

alter table public.documents
  add column rejected_reason text;

-- document_drafts (0007) has no uniqueness on document_id. This codebase
-- has no draft version-history feature — one document has exactly one
-- current draft. Making that explicit turns "save draft" into a single
-- upsert instead of a manual select-then-insert-or-update.
alter table public.document_drafts
  add constraint document_drafts_document_id_key unique (document_id);

-- No Supabase Storage usage exists anywhere else in this repo. A signature
-- is a small PNG data URL (react-signature-canvas's toDataURL()), typically
-- tens of KB — well within a text column, keeping the write path a single
-- plain insert with no bucket/policy setup to add.
create table public.signature_records (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  signer_id uuid references public.profiles (id) on delete set null,
  signature_data text not null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index signature_records_document_idx on public.signature_records (document_id);
create index signature_records_signer_idx on public.signature_records (signer_id);

-- Signing must atomically (a) record the signature and (b) flip
-- documents.status draft -> signed. security invoker (Postgres's default,
-- stated explicitly) means RLS still applies to both statements under the
-- caller's own privileges — this function is a transaction wrapper, not a
-- privilege escalation, matching how the other functions in this schema
-- use security definer sparingly and only for narrow, non-business-logic
-- work (current_role(), set_updated_at(), handle_new_user()).
create or replace function public.sign_document(p_document_id uuid, p_signature_data text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Insert the signature record BEFORE flipping status: the
  -- signature_records RLS insert policy (0017) requires the parent
  -- document to still be status = 'draft' at insert time, matching a
  -- direct (non-RPC) insert attempt under the same policy. Doing the
  -- update first would flip status to 'signed' and make the insert fail
  -- its own RLS check.
  insert into public.signature_records (document_id, signer_id, signature_data)
  select p_document_id, auth.uid(), p_signature_data
  from public.documents
  where id = p_document_id
    and owner_id = auth.uid()
    and status = 'draft';

  if not found then
    raise exception 'document not signable';
  end if;

  update public.documents
    set status = 'signed'
    where id = p_document_id
      and owner_id = auth.uid()
      and status = 'draft';
end;
$$;

grant execute on function public.sign_document(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Transition-graph guards (0017's RLS policies alone are not enough — see
-- the long comment on each trigger below for why).
-- ---------------------------------------------------------------------

-- Postgres combines multiple permissive RLS policies for the same command
-- by OR-ing every applicable USING clause together, and OR-ing every
-- applicable WITH CHECK clause together — independently of each other, not
-- pairwise per policy. 0017 adds separate owner policies for
-- draft->teacher_review (projects) and draft->signed / signed->
-- pending_approval (documents), specifically so a caller can't skip a
-- stage. But because the USING clauses and WITH CHECK clauses combine
-- independently across policies, a caller who satisfies one policy's
-- USING (e.g. "my document is currently draft") can still satisfy a
-- *different* policy's WITH CHECK (e.g. "the new status is
-- pending_approval") in the very same UPDATE — even though no single
-- policy actually permits that exact transition. RLS's WITH CHECK alone
-- cannot express "the OLD status must have been X" (it only ever sees the
-- NEW row), so this cannot be closed with RLS policies alone. A BEFORE
-- UPDATE trigger can see both OLD and NEW, so it becomes the actual
-- authoritative gate on which (old, new) status pairs are legal at all;
-- RLS keeps deciding *who* may attempt a change, this decides *whether the
-- specific transition* is legal, independent of which policy let the
-- caller touch the row.
--
-- admin/aft_teacher are exempted: 0008/0011 already gave them unconditional
-- "for all" / unconditional UPDATE on these tables before this migration
-- existed, by design (trusted broad access, documented and left untouched
-- per this migration's own scope). This trigger only closes the gap
-- introduced by 0017's new, narrower student/teacher policies — it must
-- not become a new restriction on access that already existed.
create or replace function public.enforce_project_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.current_role() in ('admin', 'aft_teacher') then
    return new;
  end if;

  if old.status = new.status then
    return new; -- editing content without a stage change is always fine
  end if;

  if not (
    (old.status = 'draft' and new.status = 'teacher_review') or
    (old.status = 'teacher_review' and new.status = 'admin_approval') or
    (old.status = 'teacher_review' and new.status = 'draft')
  ) then
    raise exception 'illegal project status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

create trigger projects_enforce_status_transition
  before update on public.projects
  for each row execute function public.enforce_project_status_transition();

-- Same reasoning as above, for documents: without this, an owner could
-- combine documents_update_own_draft's USING (old status = 'draft') with
-- documents_update_own_submit's WITH CHECK (new status =
-- 'pending_approval') and skip the digital-signature step entirely.
create or replace function public.enforce_document_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.current_role() in ('admin', 'aft_teacher') then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status = 'signed') or
    (old.status = 'signed' and new.status = 'pending_approval')
  ) then
    raise exception 'illegal document status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

create trigger documents_enforce_status_transition
  before update on public.documents
  for each row execute function public.enforce_document_status_transition();
