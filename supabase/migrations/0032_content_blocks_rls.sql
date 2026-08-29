-- content_blocks RLS. Public page copy (§5 guest content is read-only
-- public), editable only by staff — the same aft_teacher/admin tier
-- activity:manage and document:approve already use for content authority.
alter table public.content_blocks enable row level security;

create policy "content_blocks_select_all"
  on public.content_blocks for select
  to anon, authenticated
  using (true);

create policy "content_blocks_update_staff"
  on public.content_blocks for update
  to authenticated
  using (public.current_role() in ('aft_teacher', 'admin'))
  with check (public.current_role() in ('aft_teacher', 'admin'));

-- Deliberately no INSERT/DELETE policy: the row set is fixed by migration
-- seed (0031). Staff can edit an existing slug's text but cannot invent new
-- pages from the UI — a new page is a new migration, matching how every
-- other route in this app is code-defined, not data-defined.
