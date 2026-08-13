-- `departments` could be read by anyone and INSERTed by an admin, but had no
-- UPDATE or DELETE policy at all — so renaming a สาขา or removing one that was
-- added by mistake was impossible through the app, admin or not.
--
-- Both are admin-only, matching departments_insert_admin (0043).
--
-- No delete guard is written here on purpose: all four referencing FKs
-- (profiles, activities, projects, attendance) are NO ACTION, so PostgreSQL
-- already refuses to delete a สาขา that anything still points at. That is the
-- real backstop. services/members.ts#getDepartmentsWithUsage counts those
-- references so the UI can explain WHY a delete is unavailable, instead of
-- surfacing a raw 23503.

create policy departments_update_admin on public.departments
  for update to authenticated
  using      ( ( select public.current_role() ) = 'admin'::public.user_role )
  with check ( ( select public.current_role() ) = 'admin'::public.user_role );

create policy departments_delete_admin on public.departments
  for delete to authenticated
  using ( ( select public.current_role() ) = 'admin'::public.user_role );
