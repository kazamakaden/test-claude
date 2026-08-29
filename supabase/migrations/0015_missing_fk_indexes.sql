-- Supabase's performance advisor flagged 4 foreign keys with no covering
-- index (unindexed_foreign_keys lint). Harmless at today's row counts, but
-- free to fix now and consistent with the indexing pattern already used for
-- every other FK on these tables.

create index activities_created_by_idx on public.activities (created_by);
create index approved_accounts_approved_by_idx on public.approved_accounts (approved_by);
create index approved_accounts_department_idx on public.approved_accounts (department_id);
create index document_drafts_created_by_idx on public.document_drafts (created_by);
