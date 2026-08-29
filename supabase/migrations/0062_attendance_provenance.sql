-- Attendance provenance (QR vs manual), staff manual entry, and letting a plain
-- `student` check in by QR.
--
-- Three problems this closes:
--
-- 1. NOTHING recorded how an attendance row came to exist. That was unambiguous
--    only because record_attendance() was the sole writer; the moment a second
--    write path exists, a row is either a cryptographically verified scan or a
--    staff member's assertion, and the table could not tell you which.
--
-- 2. There was NO manual-entry path at all. 0055 revoked every client
--    INSERT/UPDATE grant on attendance -- deliberately, and that stays -- so a
--    teacher could not record a student who arrived without a phone. The answer
--    is another SECURITY DEFINER RPC, not a re-grant: 0055's own note says a
--    fallback nobody uses is a boundary nobody tests.
--
-- 3. A plain `student` could not scan at all: record_attendance() refuses any role
--    outside aft/teacher/admin, because §6 makes `student` read-only. For an
--    attendance list of ordinary students that is the wrong boundary, so `student`
--    is added -- to the RPC only. See the note on attendance_insert_own below.

-- ---------------------------------------------------------------------
-- Provenance columns

create type public.attendance_method as enum ('qr', 'manual');

-- Added nullable, backfilled, then made NOT NULL -- and deliberately left with
-- NO DEFAULT. Defaulting to 'qr' would mean any future writer that forgets to set
-- the column silently produces rows claiming to be cryptographically verified:
-- fail-open, and precisely the class 0055 exists to prevent. With no default,
-- forgetting is a NOT NULL violation at write time. record_attendance() below is
-- therefore updated to state 'qr' explicitly.
alter table public.attendance
  add column method public.attendance_method,
  add column recorded_by uuid references public.profiles (id) on delete set null;

update public.attendance set method = 'qr' where method is null;

alter table public.attendance alter column method set not null;

comment on column public.attendance.method is
  'How the row was created: qr = verified scan through record_attendance(); manual = asserted by staff through record_attendance_manual(). No default, on purpose -- a writer that forgets must fail, not silently claim verification.';
comment on column public.attendance.recorded_by is
  'Staff member who asserted a manual row. NULL for qr rows, where student_id is the subject and the scan is its own evidence.';

-- 0008's SELECT allow-list is REPLACED, not appended to: a bare
-- `grant select (method)` does not re-grant the original nine columns, and the
-- §15 sensitive five (gps_lat, gps_lng, device_fingerprint, browser, ip) must
-- stay unreadable by every client role.
grant select (id, activity_id, student_id, department_id, class_name, room,
              status, recorded_at, created_at, method, recorded_by)
  on public.attendance to authenticated;

-- ---------------------------------------------------------------------
-- Manual entry
--
-- The security boundary here is can_edit_activity() (0061), NOT a role test:
-- unlike record_attendance(), student_id is a PARAMETER, so this function writes
-- a row about somebody else. Only the activity's owner, its co-editors, and an
-- admin may assert attendance at that activity.

create or replace function public.record_attendance_manual(
  p_activity_id uuid,
  p_student_id uuid,
  p_status public.attendance_status default 'present'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_dept uuid;
  v_class text;
  v_inserted uuid;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- coalesce(..., false): can_edit_activity() returns NULL for an activity that
  -- does not exist, and NULL is not false. Fail closed.
  if not coalesce(public.can_edit_activity(p_activity_id), false) then
    raise exception 'insufficient privilege to record attendance for this activity'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.activities a where a.id = p_activity_id) then
    return 'invalid_activity';
  end if;

  select p.department_id, p.class_name into v_dept, v_class
  from public.profiles p where p.id = p_student_id;

  if not found then
    return 'unknown_student';
  end if;

  -- No GPS, no fingerprint, no browser, no ip: a manual row has no such evidence
  -- and must not fabricate any. Its provenance is method='manual' + recorded_by.
  insert into public.attendance
    (activity_id, student_id, department_id, class_name, status, method,
     recorded_by, recorded_at)
  values
    (p_activity_id, p_student_id, v_dept, v_class, p_status, 'manual',
     v_actor, now())
  on conflict (activity_id, student_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return 'already_recorded';
  end if;

  -- audit_attendance_tamper (0057) fires on UPDATE and DELETE only, so a manual
  -- INSERT would otherwise leave no trace. Staff asserting a fact with no
  -- evidence is exactly what an audit trail is for.
  perform public.write_audit_log(
    'attendance.manual_entry', 'attendance', v_inserted::text, null,
    jsonb_build_object('activity_id', p_activity_id, 'student_id', p_student_id,
                       'status', p_status, 'recorded_by', v_actor));

  return 'recorded';
end;
$$;

revoke execute on function public.record_attendance_manual(uuid, uuid, public.attendance_status)
  from anon, public;
grant execute on function public.record_attendance_manual(uuid, uuid, public.attendance_status)
  to authenticated;

-- ---------------------------------------------------------------------
-- Undo, scoped to manual rows only
--
-- Needed because DELETE on attendance has never been granted to anyone, so
-- without this a mistyped manual entry is permanent. Restricted to
-- method = 'manual': a QR check-in is evidence the student was physically
-- present, and staff must not be able to quietly erase it. That asymmetry is the
-- integrity property 0055 paid for.

create or replace function public.remove_manual_attendance(
  p_activity_id uuid,
  p_student_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_method public.attendance_method;
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not coalesce(public.can_edit_activity(p_activity_id), false) then
    raise exception 'insufficient privilege to remove attendance for this activity'
      using errcode = '42501';
  end if;

  select id, method into v_id, v_method
  from public.attendance
  where activity_id = p_activity_id and student_id = p_student_id;

  if not found then
    return 'not_found';
  end if;

  if v_method <> 'manual' then
    return 'qr_verified_not_removable';
  end if;

  delete from public.attendance where id = v_id;

  -- The DELETE also fires audit_attendance_tamper (0057), which is the record
  -- that matters; this row names the intent rather than leaving the trail to
  -- read as an out-of-band tamper.
  perform public.write_audit_log(
    'attendance.manual_removed', 'attendance', v_id::text,
    jsonb_build_object('activity_id', p_activity_id, 'student_id', p_student_id), null);

  return 'removed';
end;
$$;

revoke execute on function public.remove_manual_attendance(uuid, uuid) from anon, public;
grant execute on function public.remove_manual_attendance(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- record_attendance(): allow `student`, and state method = 'qr' explicitly
--
-- Replaced wholesale because plpgsql has no way to patch a body. Only two things
-- change from 0056: 'student' joins the role array, and the INSERT names `method`
-- (required now that the column has no default). Every other guard -- throttle,
-- slug regex, session lookup, revoked/expired, HMAC over the current and one
-- grace bucket, activity window, GPS haversine, present/late, x-forwarded-for --
-- is byte-identical to what 0056 shipped and 0056's test matrix proved.
--
-- attendance_insert_own STAYS aft/teacher/admin and is NOT relaxed. That policy
-- is unreachable today because no client holds an INSERT grant, so narrowing
-- costs nothing; keeping it narrow means that if some future migration re-grants
-- INSERT, a student still could not forge a direct row -- they stay confined to
-- this verified RPC. The policy and this guard deliberately disagree; do not
-- "fix" the inconsistency.

create or replace function public.record_attendance(
  p_token text,
  p_gps_lat numeric default null,
  p_gps_lng numeric default null,
  p_fingerprint text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_slug text;
  s record;
  a record;
  v_bucket bigint;
  v_distance numeric;
  v_status public.attendance_status;
  v_ip inet;
  v_recent integer;
  v_inserted uuid;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- `student` added: an attendance list of ordinary students is the point of the
  -- feature. coalesce(..., false), not `not (x = any ...)`: current_role() is
  -- NULL for a caller with no profile row and NULL propagates through `= any`,
  -- so a bare negation would SKIP this raise and fail open.
  if not coalesce(
       (select public.current_role()) = any (array['student','aft','teacher','admin']::public.user_role[]),
       false) then
    raise exception 'insufficient privilege to record attendance' using errcode = '42501';
  end if;

  select count(*) into v_recent
  from public.qr_scan_attempts t
  where t.user_id = v_actor and t.attempted_at > now() - interval '1 minute';

  if v_recent >= 10 then
    raise exception 'too many attempts, wait a minute' using errcode = '53400';
  end if;

  v_slug := split_part(coalesce(p_token, ''), '.', 1);
  if v_slug !~ '^[a-z0-9]{10}$' then
    insert into public.qr_scan_attempts (user_id) values (v_actor);
    return 'invalid_token';
  end if;

  select * into s from public.qr_sessions q where q.slug = v_slug;
  if not found then
    insert into public.qr_scan_attempts (user_id) values (v_actor);
    return 'invalid_token';
  end if;

  if s.revoked_at is not null or s.expires_at <= now() then
    return 'session_closed';
  end if;

  v_bucket := floor(extract(epoch from now()) / s.rotation_seconds)::bigint;
  if p_token <> public.qr_token_for_bucket(s.slug, s.secret, v_bucket)
     and p_token <> public.qr_token_for_bucket(s.slug, s.secret, v_bucket - 1) then
    insert into public.qr_scan_attempts (user_id) values (v_actor);
    return 'expired_token';
  end if;

  select * into a from public.activities act where act.id = s.activity_id;
  if not found then
    return 'invalid_token';
  end if;

  if now() < a.starts_at - interval '30 minutes'
     or now() > coalesce(a.ends_at, a.starts_at + interval '4 hours') + interval '30 minutes' then
    return 'outside_activity_window';
  end if;

  if s.radius_metres is not null then
    if p_gps_lat is null or p_gps_lng is null then
      return 'gps_required';
    end if;
    if p_gps_lat not between -90 and 90 or p_gps_lng not between -180 and 180 then
      return 'gps_required';
    end if;

    v_distance := 6371000 * 2 * asin(sqrt(
        power(sin(radians(p_gps_lat - s.gps_lat) / 2), 2)
      + cos(radians(s.gps_lat)) * cos(radians(p_gps_lat))
      * power(sin(radians(p_gps_lng - s.gps_lng) / 2), 2)
    ));

    if v_distance > s.radius_metres then
      return 'out_of_range';
    end if;
  end if;

  v_status := case when now() <= a.starts_at + interval '15 minutes'
                   then 'present'::public.attendance_status
                   else 'late'::public.attendance_status end;

  begin
    v_ip := split_part(
      coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
      ',', 1)::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.attendance
    (activity_id, student_id, department_id, class_name, status, method,
     gps_lat, gps_lng, device_fingerprint, browser, ip, recorded_at)
  select
    s.activity_id, v_actor, p.department_id, p.class_name, v_status,
    'qr'::public.attendance_method,
    p_gps_lat, p_gps_lng, left(p_fingerprint, 200),
    left(coalesce(current_setting('request.headers', true)::json ->> 'user-agent', ''), 300),
    v_ip, now()
  from public.profiles p
  where p.id = v_actor
  on conflict (activity_id, student_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    if exists (select 1 from public.attendance ex
                where ex.activity_id = s.activity_id and ex.student_id = v_actor) then
      return 'already_recorded';
    end if;
    raise exception 'no profile row for authenticated user %', v_actor using errcode = 'P0002';
  end if;

  return 'recorded';
end;
$$;

-- The 0011 -> 0012 trap, again: `create or replace` above reset this function's
-- grants to PUBLIC EXECUTE. Without these two lines anon could call it.
revoke execute on function public.record_attendance(text, numeric, numeric, text) from anon, public;
grant execute on function public.record_attendance(text, numeric, numeric, text) to authenticated;
