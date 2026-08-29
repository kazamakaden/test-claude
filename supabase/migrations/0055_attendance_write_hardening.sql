-- SEC-1 / SEC-2: close the attendance WRITE boundary.
--
-- 0008 hardened this table's READ side (revoke the table-level SELECT, re-grant
-- an explicit column allow-list, the pattern 0005 established for
-- profiles.citizen_id) and its own comment claims "new sensitive columns added
-- later are unreadable until added here — fail-closed by design". That is true
-- for SELECT and silently false for INSERT/UPDATE: Supabase's default grants to
-- `anon`/`authenticated` cover every column for every command, and 0008 only
-- ever revoked SELECT. Verified live before writing this migration —
-- information_schema.column_privileges showed INSERT and UPDATE on all 14
-- columns for both roles, gps_lat/gps_lng/device_fingerprint/browser/ip
-- included.
--
-- Combined with attendance_insert_own, whose whole predicate was
-- `student_id = auth.uid()`, that meant ANY signed-in user could write a
-- finished attendance record for any activity with entirely self-chosen
-- evidence. Reproduced live in a self-rolling-back transaction as the `student`
-- 66209010020 — a role that per §6 is READ-ONLY and does not hold
-- `attendance:submit` at all: one row written, status 'completed', GPS set to
-- Bangkok (~560 km from the college), device_fingerprint 'FORGED-FINGERPRINT',
-- ip 203.0.113.99, recorded_at backdated 30 days. §13 requires GPS, time and
-- device fingerprint to be SERVER-verified; every one of them was client input.
--
-- Two independent layers are fixed here, deliberately not one:
--
--   1. GRANTS  — no client may write this table at all any more. §13 attendance
--                arrives through the security-definer record_attendance() RPC
--                (0056), which derives student_id from auth.uid(), recorded_at
--                from now() and ip from inet_client_addr(), so it needs no
--                grant of its own. A table with no write grant cannot be
--                forged through PostgREST no matter what the policies say.
--
--   2. POLICY  — attendance_insert_own additionally gains the role check that
--                brings RLS in line with the `attendance:submit` matrix in
--                lib/auth/permissions.ts. This is redundant while the grant
--                above is revoked, and that is the point: it is the layer that
--                still holds if a future migration re-grants INSERT (the exact
--                way 0011's `create or replace` silently restored an EXECUTE
--                grant that 0006 had revoked — see CLAUDE.md). Defence in
--                depth, not belt-and-braces for its own sake.
--
-- Safe to apply with zero migration risk: the table has 0 rows and nothing in
-- the app writes to it (grep-verified — `attendance` appears only in read
-- paths: services/activities.ts#getActivityCounts, services/dashboard.ts and
-- get_activity_stats()). Those reads are untouched; the SELECT allow-list from
-- 0008 stays exactly as it is.

-- 1. Grants -----------------------------------------------------------------

-- Table-level first: a column-level revoke cannot narrow a table-level grant
-- (PostgreSQL refuses to, silently) — the lesson 0005 paid for.
revoke insert, update on public.attendance from authenticated, anon;

-- REFERENCES too: it is granted by default and lets a caller create a foreign
-- key against this table, which leaks row existence through FK violation
-- errors. Nothing in this schema references attendance.
revoke references on public.attendance from authenticated, anon;

-- Deliberately NOT re-granting a narrow INSERT allow-list. An earlier draft
-- kept `grant insert (activity_id, student_id)` as a fallback path; it was
-- dropped because it is a second way in that nothing needs — the RPC is the
-- only writer, and a fallback nobody uses is a boundary nobody tests.

-- Trade-off, stated rather than left to be discovered: `authenticated` is one
-- Postgres role shared by every signed-in user, so this revoke necessarily
-- takes the admin's write path with it. attendance_all_admin (0008) is FOR ALL
-- and did permit an admin to insert/update attendance over raw REST. There is
-- no UI for that and no caller in the codebase, and the capability was never
-- complete in the first place — DELETE has never been granted on this table to
-- anyone, so an admin could already create rows they could not remove. The
-- service-role client (lib/supabase/admin.ts) keeps full access for genuine
-- out-of-band correction, and an in-app admin correction flow should arrive as
-- its own admin-gated RPC, alongside the audit_logs entry such an edit must
-- leave (Phase 2). Silently keeping a forgeable grant open to preserve an
-- unused capability would be the wrong trade under §28.

-- 2. Policy ------------------------------------------------------------------

-- ALTER, not DROP+CREATE: there is never an instant where the policy does not
-- exist, and the role/command/permissive attributes cannot change by accident.
-- Same discipline as 0041.
--
-- current_role() is wrapped in a scalar subquery so it is evaluated once per
-- query rather than once per row, matching the shape 0041 gave every other
-- policy (advisor: auth_rls_initplan).
alter policy attendance_insert_own on public.attendance
  with check (
    student_id = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

comment on table public.attendance is
  '§15 attendance. WRITES ONLY through public.record_attendance() (0056) — anon/authenticated hold no insert/update grant (0055). SELECT is a column allow-list (0008): gps_lat, gps_lng, device_fingerprint, browser and ip are admin-only, readable via a reviewer/admin path, never by the row owner.';
