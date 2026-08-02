-- A column-level revoke cannot override a table-level SELECT grant (PostgreSQL
-- GRANT docs). Supabase grants table-level SELECT to authenticated/anon by
-- default, so 0004's revoke was a no-op — confirmed live: an authenticated
-- student session could read profiles.citizen_id via both `select=citizen_id`
-- and `select=*`. Fix: drop the table grant, then re-grant an explicit
-- allow-list. New sensitive columns are unreadable until added here —
-- fail-closed by design.
revoke select on public.profiles from authenticated, anon;

grant select (id, email, full_name, role, created_at, updated_at,
              student_id, department_id, class_name, club_id, academic_year)
  on public.profiles to authenticated;
