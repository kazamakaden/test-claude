-- "Auto input" (/members/autoinput) resolves the 7-digit รหัสวิชา embedded in
-- a student's email to a real `departments` row. When a NEW รหัสวิชา appears,
-- an admin adds it inline — which, until now, was impossible: 0004 and 0026
-- gave `departments` SELECT policies only, so RLS denied every INSERT to every
-- role including admin.

-- Admin only, matching the `member:manage` tier that already governs adding and
-- deleting member accounts (lib/auth/permissions.ts) — deliberately NOT the
-- looser `member:approve`, which aft_teacher also holds. Creating a department
-- reshapes the directory for everyone, so it sits with account management.
--
-- `( select current_role() )` rather than a bare call: 0041 just took
-- auth_rls_initplan from 26 findings to 0, and a new policy written the old way
-- would re-introduce one immediately.
create policy "departments_insert_admin"
  on public.departments for insert
  to authenticated
  with check ( ( select public.current_role() ) = 'admin' );

-- Database layer of §19's three-layer validation (Zod in schemas/members.ts and
-- the parser in lib/student-id.ts are the other two). The 2+7+remainder split
-- of a student ID only works if the code really is 7 digits — a 6- or 8-digit
-- row would silently mis-parse every student in that department.
--
-- Verified safe before writing: all 6 existing rows (3190100..3190600) already
-- match, so this constraint validates without touching data.
alter table public.departments
  add constraint departments_code_format check (code ~ '^[0-9]{7}$');
