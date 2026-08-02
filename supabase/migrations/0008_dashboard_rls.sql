-- RLS for the 6 dashboard tables. Transcribes the contract already stated in
-- lib/auth/permissions.ts (lines 108-127) — that comment is the spec.

alter table public.activities enable row level security;
alter table public.attendance enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.document_drafts enable row level security;
alter table public.notifications enable row level security;

-- activities: guest sees is_public only; any signed-in user sees all.
create policy "activities_select_public"
  on public.activities for select
  to anon, authenticated
  using (is_public = true);

create policy "activities_select_authenticated"
  on public.activities for select
  to authenticated
  using (true);

create policy "activities_all_admin"
  on public.activities for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- attendance: student sees/inserts own; teacher/admin see all.
create policy "attendance_select_own"
  on public.attendance for select
  to authenticated
  using (student_id = auth.uid());

create policy "attendance_insert_own"
  on public.attendance for insert
  to authenticated
  with check (student_id = auth.uid());

create policy "attendance_select_reviewer"
  on public.attendance for select
  to authenticated
  using (public.current_role() in ('teacher', 'admin'));

create policy "attendance_all_admin"
  on public.attendance for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- projects: guest/anon sees official only; owner sees own; reviewer sees all.
create policy "projects_select_official"
  on public.projects for select
  to anon, authenticated
  using (status = 'official');

create policy "projects_select_own"
  on public.projects for select
  to authenticated
  using (owner_id = auth.uid());

create policy "projects_select_reviewer"
  on public.projects for select
  to authenticated
  using (public.current_role() in ('teacher', 'admin'));

create policy "projects_all_admin"
  on public.projects for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- documents: same shape as projects.
create policy "documents_select_official"
  on public.documents for select
  to anon, authenticated
  using (status = 'official');

create policy "documents_select_own"
  on public.documents for select
  to authenticated
  using (owner_id = auth.uid());

create policy "documents_select_reviewer"
  on public.documents for select
  to authenticated
  using (public.current_role() in ('teacher', 'admin'));

create policy "documents_all_admin"
  on public.documents for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- document_drafts: own via parent document ownership; reviewer sees all.
create policy "document_drafts_select_own"
  on public.document_drafts for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_drafts.document_id and d.owner_id = auth.uid()
    )
  );

create policy "document_drafts_insert_own"
  on public.document_drafts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_drafts.document_id and d.owner_id = auth.uid()
    )
  );

create policy "document_drafts_select_reviewer"
  on public.document_drafts for select
  to authenticated
  using (public.current_role() in ('teacher', 'admin'));

create policy "document_drafts_all_admin"
  on public.document_drafts for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- notifications: own row or broadcast (recipient_id is null); own read-state update.
create policy "notifications_select_own_or_broadcast"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid() or recipient_id is null);

create policy "notifications_update_own_read"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "notifications_all_admin"
  on public.notifications for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- §15: attendance carries GPS/IP/device-fingerprint. Same pattern as
-- 0005_citizen_id_column_grants.sql — a column-level revoke alone is a
-- proven no-op against Supabase's default table-level grant, so revoke the
-- table grant first, then re-grant an explicit allow-list. New sensitive
-- columns added later are unreadable until added here — fail-closed by
-- design.
revoke select on public.attendance from authenticated, anon;

grant select (id, activity_id, student_id, department_id, class_name,
              room, status, recorded_at, created_at)
  on public.attendance to authenticated;
