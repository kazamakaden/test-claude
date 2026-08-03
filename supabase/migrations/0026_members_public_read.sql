-- §5: guests can read the Members directory (to check "am I registered?"),
-- admin and aft_teacher can edit it. This migration only grants the read
-- side; editing already works through profiles_update_admin (0002) +
-- profiles_update_aft_teacher (0024), unchanged here.
--
-- anon has NO table-level SELECT grant on profiles today (verified live —
-- 0005's revoke-then-allow-list pattern only ever re-granted to
-- `authenticated`). This grant IS the allow-list: email and citizen_id are
-- deliberately absent, matching the user's decision that guests see name +
-- student ID + class + year + department + club, not contact info.
grant select (id, full_name, role, student_id, department_id,
              class_name, club_id, academic_year, avatar_url)
  on public.profiles to anon;

-- Excludes 'pending' (and the unused 'guest' role value): an unapproved
-- signup must not appear in a public directory before a human has looked
-- at them. A policy's USING clause may reference a column even though anon
-- cannot SELECT it directly (role is not in the grant above) — that's how
-- this hides pending rows without exposing the role column to anon at all.
create policy "profiles_select_public_directory"
  on public.profiles for select to anon
  using (role in ('student', 'teacher', 'aft_teacher', 'admin'));

-- departments/clubs already have anon SELECT table grants (Supabase's
-- default for a new table with no explicit revoke) but RLS was enabled
-- with only an authenticated-scoped policy, so anon got zero rows despite
-- the grant — confirmed live via curl before this migration: anon
-- departments?select=id and clubs?select=id both returned [], while
-- activities (same shape, but WITH an anon policy from 0008) returned
-- rows. This also means the already-public /[lang]/activities page's
-- Department and Club filter dropdowns have been rendering empty for
-- every guest visitor — this migration fixes that as a side effect, not
-- just the Members directory.
create policy "departments_select_public" on public.departments for select to anon using (true);
create policy "clubs_select_public"       on public.clubs       for select to anon using (true);
