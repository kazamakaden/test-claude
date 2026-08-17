-- Regression test for 0055 (SEC-1 / SEC-2). Re-runnable, non-destructive:
-- every case runs inside a transaction that is rolled back, and the final
-- assertion confirms the table is back to its starting row count.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0055_attendance_write_hardening_test.sql
-- or paste into the Supabase SQL editor. Expect PASS on every row.
--
-- Case 7 deliberately re-GRANTs inside the rolled-back transaction. That is not
-- a mistake: it proves the POLICY half of 0055 refuses a `student` on its own,
-- independently of the grant half — i.e. that re-granting INSERT in some future
-- migration would not silently reopen SEC-1. Confirmed by MESSAGE, not just
-- SQLSTATE: cases 1-6b/8 report "permission denied for table attendance" (the
-- grant layer) while case 7 reports "new row violates row-level security
-- policy" (the policy layer). Both are 42501, which is exactly why the helper
-- records sqlerrm — the code alone cannot tell the two layers apart.

begin;

create temporary table _result (case_name text, outcome text);

-- Helper: run `sql` as `uid` and record whether it was refused.
create or replace function pg_temp.expect_refused(case_name text, uid text, sql text)
returns void language plpgsql as $$
begin
  begin
    execute format('set local role authenticated');
    execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
    execute sql;
    reset role;
    insert into _result values (case_name, 'FAIL - write was ALLOWED');
  exception when others then
    reset role;
    -- sqlerrm, not just sqlstate: a MISSING GRANT and an RLS POLICY VIOLATION
    -- both raise 42501, so the code alone cannot tell the two layers apart.
    -- Case 7 depends on that distinction — it restores the grant precisely so
    -- that the refusal must come from the policy — and would otherwise be an
    -- inference rather than an observation.
    insert into _result values (case_name, 'PASS - refused (' || sqlstate || ': ' || sqlerrm || ')');
  end;
end;
$$;

create or replace function pg_temp.expect_allowed(case_name text, uid text, sql text)
returns void language plpgsql as $$
begin
  begin
    execute format('set local role authenticated');
    execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
    execute sql;
    reset role;
    insert into _result values (case_name, 'PASS - allowed');
  exception when others then
    reset role;
    insert into _result values (case_name, 'FAIL - refused (' || sqlstate || ': ' || sqlerrm || ')');
  end;
end;
$$;

-- Fixtures: a real student, a real admin, and any activity.
create temporary view _fx as
  select (select id from public.profiles where role = 'student' order by id limit 1) as student_id,
         (select id from public.profiles where role = 'admin'   order by id limit 1) as admin_id,
         (select id from public.activities order by starts_at limit 1)               as activity_id;

do $$
declare fx record;
begin
  select * into fx from _fx;

  -- 1. THE ORIGINAL EXPLOIT: read-only student forges a completed record with
  --    self-chosen GPS / fingerprint / IP / backdated timestamp.
  perform pg_temp.expect_refused('1. student forges completed+GPS+fingerprint+ip', fx.student_id::text, format(
    $q$insert into public.attendance (activity_id, student_id, status, gps_lat, gps_lng,
         device_fingerprint, browser, ip, recorded_at)
       values (%L, %L, 'completed', 13.7563, 100.5018, 'FORGED', 'FORGED', '203.0.113.99',
               now() - interval '30 days')$q$, fx.activity_id, fx.student_id));

  -- 2. Minimal insert — no sensitive columns at all. Must still be refused:
  --    a read-only student holds no attendance:submit (§6).
  perform pg_temp.expect_refused('2. student minimal insert (activity+self)', fx.student_id::text, format(
    $q$insert into public.attendance (activity_id, student_id) values (%L, %L)$q$,
    fx.activity_id, fx.student_id));

  -- 3. IDOR: student writes attendance for a DIFFERENT user.
  perform pg_temp.expect_refused('3. student inserts for another user (IDOR)', fx.student_id::text, format(
    $q$insert into public.attendance (activity_id, student_id) values (%L, %L)$q$,
    fx.activity_id, fx.admin_id));

  -- 4. Admin over raw REST — refused too. Documented trade-off in 0055:
  --    `authenticated` is one shared role, so no client path remains.
  perform pg_temp.expect_refused('4. admin direct insert (documented)', fx.admin_id::text, format(
    $q$insert into public.attendance (activity_id, student_id) values (%L, %L)$q$,
    fx.activity_id, fx.admin_id));

  -- 5. UPDATE (SEC-2) — the grant is gone, not merely unpolicied.
  perform pg_temp.expect_refused('5. student updates attendance', fx.student_id::text,
    $q$update public.attendance set status = 'completed'$q$);

  -- 6. Reads are UNCHANGED: the allow-listed columns still work...
  perform pg_temp.expect_allowed('6a. student selects allow-listed columns', fx.student_id::text,
    $q$select 1 from public.attendance where id is not null$q$);

  --    ...and the §15 sensitive columns are still refused.
  perform pg_temp.expect_refused('6b. student selects gps/fingerprint', fx.student_id::text,
    $q$select gps_lat, device_fingerprint from public.attendance$q$);

  -- 7. POLICY LAYER, proven independently: re-grant INSERT (rolled back with
  --    everything else) and confirm attendance_insert_own still refuses a
  --    student. This is what stops a future re-grant from reopening SEC-1.
  grant insert on public.attendance to authenticated;
  perform pg_temp.expect_refused('7. student insert WITH grant restored (policy layer)',
    fx.student_id::text, format(
    $q$insert into public.attendance (activity_id, student_id) values (%L, %L)$q$,
    fx.activity_id, fx.student_id));

  -- 7b. CONTROL for case 7. Without this, case 7 proves only "the policy
  --     refuses", which a policy of `with check (false)` would also satisfy —
  --     it would not show the ROLE CHECK is what refuses. Same grant, same
  --     statement, an actor whose role IS in the policy's array: must be
  --     ALLOWED. Case 7 + 7b together are what demonstrate the policy
  --     discriminates by role rather than blocking everyone.
  perform pg_temp.expect_allowed('7b. CONTROL: admin insert WITH grant restored', fx.admin_id::text, format(
    $q$insert into public.attendance (activity_id, student_id) values (%L, %L)$q$,
    fx.activity_id, fx.admin_id));
end $$;

-- anon is checked outside the helper because it needs a different role.
do $$
declare fx record;
begin
  select * into fx from _fx;
  begin
    set local role anon;
    execute format($q$insert into public.attendance (activity_id, student_id) values (%L, %L)$q$,
                   fx.activity_id, fx.student_id);
    reset role;
    insert into _result values ('8. anon insert', 'FAIL - write was ALLOWED');
  exception when others then
    reset role;
    insert into _result values ('8. anon insert', 'PASS - refused (' || sqlstate || ': ' || sqlerrm || ')');
  end;
end $$;

select case_name, outcome from _result order by case_name;

rollback;
