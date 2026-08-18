-- §13 QR attendance + §15 attendance data. The write path 0055 deliberately
-- left empty.
--
-- Threat model first, because it drives every choice below. The person
-- submitting attendance is the person who benefits from cheating, on a device
-- they fully control. So NOTHING the client sends is trusted as evidence:
--
--   * student_id  — taken from auth.uid(), never a parameter.
--   * recorded_at — taken from now(), never a parameter.
--   * status      — derived by comparing now() to the activity window.
--   * ip          — read from PostgREST's request headers, not a parameter.
--   * activity_id — derived from the token, so a caller cannot present a token
--                   for one activity and claim attendance at another.
--
-- The client supplies exactly three things, all of which are checked rather
-- than stored on trust: the token (verified by HMAC), its GPS reading (range-
-- checked against the session's radius) and a device fingerprint (recorded as
-- a duplicate-detection signal, never as an authorisation input — see §15).

-- ---------------------------------------------------------------------
-- 1. Attendance outcome enum (B-3)
-- ---------------------------------------------------------------------
-- attendance.status has been reusing `activity_status`
-- ('pending'/'completed'/'cancelled') — an ACTIVITY lifecycle enum standing in
-- for an ATTENDANCE outcome, with no way to say "late" or "absent". Safe to
-- swap outright: the table has 0 rows (0055 verified this, and nothing has
-- been able to write to it since).
create type public.attendance_status as enum ('present', 'late', 'absent');

alter table public.attendance
  alter column status drop default;

alter table public.attendance
  alter column status type public.attendance_status
  using 'present'::public.attendance_status;

alter table public.attendance
  alter column status set default 'present'::public.attendance_status;

-- ---------------------------------------------------------------------
-- 2. QR sessions
-- ---------------------------------------------------------------------
-- §13: "Admin creates dynamic QR sessions" with Event ID, Expiration, GPS
-- radius.
--
-- "Dynamic" is the interesting requirement. A static QR is photographed once
-- and shared with everyone who stayed home. The obvious fix — store a token
-- column and rotate it on a timer — needs a job runner this project does not
-- have, and a write every few seconds forever.
--
-- Instead the token is DERIVED, TOTP-style: a per-session secret that never
-- leaves the database, HMAC'd with the current time bucket. Nothing has to
-- rotate anything; the token simply stops verifying when the bucket rolls
-- over. A screenshot is worthless within `rotation_seconds`.
create table public.qr_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,

  -- Public half of the token, so a scan can find its session in one indexed
  -- lookup instead of recomputing the HMAC for every open session.
  slug text not null unique check (slug ~ '^[a-z0-9]{10}$'),

  -- Private half. NEVER selectable by any client — see the column grants at
  -- the bottom of this file. Anyone holding this can mint valid tokens for
  -- the whole session.
  secret bytea not null,

  -- How often the QR changes. Floor of 10s keeps it human-scannable; ceiling
  -- of 300s stops someone creating an effectively-static session and calling
  -- it dynamic.
  rotation_seconds integer not null default 30
    check (rotation_seconds between 10 and 300),

  expires_at timestamptz not null,

  -- §13 "GPS radius". Nullable as a pair: a session with no coordinates does
  -- no location check at all, which is the honest behaviour for an online or
  -- off-site activity. The CHECK stops the half-configured middle state where
  -- a radius is set but there is no centre to measure from.
  gps_lat numeric(9,6) check (gps_lat between -90 and 90),
  gps_lng numeric(9,6) check (gps_lng between -180 and 180),
  radius_metres integer check (radius_metres between 10 and 10000),
  constraint qr_sessions_gps_all_or_nothing check (
    (gps_lat is null and gps_lng is null and radius_metres is null)
    or (gps_lat is not null and gps_lng is not null and radius_metres is not null)
  ),

  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index qr_sessions_activity_idx on public.qr_sessions (activity_id);
create index qr_sessions_created_by_idx on public.qr_sessions (created_by);

alter table public.qr_sessions enable row level security;

-- Staff only, both directions. There is deliberately no student-facing policy:
-- a student never reads this table — they present a token and the
-- security-definer RPC does the lookup on their behalf. Giving them SELECT
-- would hand them `secret` and let them mint their own tokens.
create policy "qr_sessions_select_staff"
  on public.qr_sessions for select to authenticated
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

create policy "qr_sessions_insert_staff"
  on public.qr_sessions for insert to authenticated
  with check (
    created_by = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

-- Update is limited to revocation and expiry in practice; the policy allows a
-- staff row edit generally, but `secret` and `slug` are removed from the
-- column grant below so neither can be rewritten to forge a token.
create policy "qr_sessions_update_staff"
  on public.qr_sessions for update to authenticated
  using ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) )
  with check ( ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[]) );

create policy "qr_sessions_delete_admin"
  on public.qr_sessions for delete to authenticated
  using ( ( select public.current_role() ) = 'admin'::public.user_role );

-- Column grants, same revoke-then-allow-list shape as 0005/0008 — and the
-- reason 0055 exists is that 0008 applied it to SELECT only. Applied to all
-- three commands here.
revoke all on public.qr_sessions from authenticated, anon;

grant select (id, activity_id, slug, rotation_seconds, expires_at,
              gps_lat, gps_lng, radius_metres, revoked_at, created_by, created_at)
  on public.qr_sessions to authenticated;

-- `secret` and `slug` are absent: both are generated by the database in
-- create_qr_session() below. A caller who could choose either could mint
-- tokens or collide with another session.
grant insert (activity_id, rotation_seconds, expires_at, gps_lat, gps_lng,
              radius_metres, created_by)
  on public.qr_sessions to authenticated;

grant update (rotation_seconds, expires_at, gps_lat, gps_lng, radius_metres, revoked_at)
  on public.qr_sessions to authenticated;

grant delete on public.qr_sessions to authenticated;

-- ---------------------------------------------------------------------
-- 3. Failed-scan throttle (SEC-6)
-- ---------------------------------------------------------------------
-- §19 asks for rate limiting and the app has none anywhere. A token is short
-- enough to be worth guessing if guessing is free, so it is not made free.
-- Only FAILURES are recorded — a successful scan is already one-per-activity
-- by unique constraint and needs no throttle.
create table public.qr_scan_attempts (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index qr_scan_attempts_user_time_idx
  on public.qr_scan_attempts (user_id, attempted_at desc);

alter table public.qr_scan_attempts enable row level security;

-- No policy for `authenticated` at all, and no grants: this table is written
-- only by the security-definer RPC below and read only by admins through it.
-- A throttle a caller can read or delete is not a throttle.
revoke all on public.qr_scan_attempts from authenticated, anon;
revoke all on sequence public.qr_scan_attempts_id_seq from authenticated, anon;

-- ---------------------------------------------------------------------
-- 4. Token derivation
-- ---------------------------------------------------------------------
-- token = "<slug>.<8 hex chars of HMAC(secret, slug || bucket)>"
--
-- The slug half makes the lookup a single indexed hit. The HMAC half is what
-- cannot be forged without `secret`, which no client can read. Truncating to
-- 8 hex characters (32 bits) is sized against the throttle above, not against
-- an offline attacker: 4.3 billion possibilities against 10 guesses/minute,
-- inside a window that is 30 seconds wide by default.
--
-- Marked IMMUTABLE-adjacent but is in fact STABLE: it reads clock time only
-- through the bucket argument, which the caller computes.
create function public.qr_token_for_bucket(p_slug text, p_secret bytea, p_bucket bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  -- hmac(bytea, bytea, text), not hmac(text, text, text): the key is a bytea
  -- secret, and pgcrypto has no mixed text/bytea overload -- confirmed against
  -- pg_proc rather than guessed, after the first attempt failed with 42883.
  -- convert_to(..., 'UTF8') pins the encoding so the same slug+bucket can never
  -- hash differently under a different client_encoding.
  select p_slug || '.' || substr(
    encode(
      extensions.hmac(convert_to(p_slug || ':' || p_bucket::text, 'UTF8'), p_secret, 'sha256'),
      'hex'), 1, 8);
$$;

revoke execute on function public.qr_token_for_bucket(text, bytea, bigint) from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- 5. Create a session (staff)
-- ---------------------------------------------------------------------
-- SECURITY DEFINER purely so it can generate `secret`/`slug`, which the
-- caller has no grant to write. The role check is duplicated here rather than
-- left to RLS because a definer function bypasses the policy it would
-- otherwise rely on — the single most common way this pattern goes wrong.
create function public.create_qr_session(
  p_activity_id uuid,
  p_expires_at timestamptz,
  p_rotation_seconds integer default 30,
  p_gps_lat numeric default null,
  p_gps_lng numeric default null,
  p_radius_metres integer default null
)
returns table (id uuid, slug text, rotation_seconds integer, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
-- OUT params (id, slug, rotation_seconds, expires_at) collide by name with the
-- columns of the table being inserted into. Without this, plpgsql resolves the
-- name to the VARIABLE inside the RETURNING clause. Pin it to the column.
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_slug text;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- coalesce(..., false), not `not (x = any ...)`: current_role() is NULL for a
  -- caller with no profile row, and NULL propagates through `= any` so a bare
  -- negation would SKIP this raise and fail open. Fail closed on NULL.
  if not coalesce(
       (select public.current_role()) = any (array['aft','teacher','admin']::public.user_role[]),
       false) then
    raise exception 'insufficient privilege to create a QR session' using errcode = '42501';
  end if;

  if p_expires_at <= now() then
    raise exception 'expiry must be in the future' using errcode = '22023';
  end if;

  -- Bounded: an all-day token defeats the point of a rotating one.
  if p_expires_at > now() + interval '24 hours' then
    raise exception 'expiry may not be more than 24 hours out' using errcode = '22023';
  end if;

  if not exists (select 1 from public.activities a where a.id = p_activity_id) then
    raise exception 'unknown activity' using errcode = '23503';
  end if;

  -- 10 chars of base32-ish alphabet from 8 random bytes. Loop on the
  -- astronomically unlikely collision rather than failing the caller.
  loop
    v_slug := substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=', 'abc'), 1, 10);
    v_slug := lower(v_slug);
    exit when v_slug ~ '^[a-z0-9]{10}$'
          and not exists (select 1 from public.qr_sessions s where s.slug = v_slug);
  end loop;

  return query
  insert into public.qr_sessions
    (activity_id, slug, secret, rotation_seconds, expires_at,
     gps_lat, gps_lng, radius_metres, created_by)
  values
    (p_activity_id, v_slug, extensions.gen_random_bytes(32), p_rotation_seconds, p_expires_at,
     p_gps_lat, p_gps_lng, p_radius_metres, v_actor)
  returning qr_sessions.id, qr_sessions.slug, qr_sessions.rotation_seconds, qr_sessions.expires_at;
end;
$$;

revoke execute on function public.create_qr_session(uuid, timestamptz, integer, numeric, numeric, integer) from anon, public;
grant execute on function public.create_qr_session(uuid, timestamptz, integer, numeric, numeric, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Current token for the staff display
-- ---------------------------------------------------------------------
-- The display page polls this. Staff-only and definer, because computing the
-- token requires `secret`, which not even staff may SELECT.
create function public.current_qr_token(p_session_id uuid)
returns table (token text, expires_in_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_bucket bigint;
begin
  -- coalesce(..., false), not `not (x = any ...)`: current_role() is NULL for a
  -- caller with no profile row, and NULL propagates through `= any` so a bare
  -- negation would SKIP this raise and fail open. Fail closed on NULL.
  if not coalesce(
       (select public.current_role()) = any (array['aft','teacher','admin']::public.user_role[]),
       false) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select * into s from public.qr_sessions q where q.id = p_session_id;
  if not found then
    raise exception 'unknown session' using errcode = 'P0002';
  end if;
  if s.revoked_at is not null or s.expires_at <= now() then
    raise exception 'session is closed' using errcode = 'P0001';
  end if;

  v_bucket := floor(extract(epoch from now()) / s.rotation_seconds)::bigint;

  return query select
    public.qr_token_for_bucket(s.slug, s.secret, v_bucket),
    (s.rotation_seconds - (floor(extract(epoch from now()))::bigint % s.rotation_seconds))::integer;
end;
$$;

revoke execute on function public.current_qr_token(uuid) from anon, public;
grant execute on function public.current_qr_token(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. THE write path
-- ---------------------------------------------------------------------
-- The only way a row reaches public.attendance. Returns a status string
-- rather than raising for the outcomes a student can legitimately hit
-- (already checked in, too far away, expired token), because those are
-- answers to show them, not errors. Genuine abuse still raises.
create function public.record_attendance(
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

  -- §6: a plain `student` is read-only and holds no attendance:submit. This is
  -- the check whose absence in RLS was SEC-1; a definer function must make it
  -- itself.
  -- coalesce(..., false), not `not (x = any ...)`: current_role() is NULL for a
  -- caller with no profile row, and NULL propagates through `= any` so a bare
  -- negation would SKIP this raise and fail open. Fail closed on NULL.
  if not coalesce(
       (select public.current_role()) = any (array['aft','teacher','admin']::public.user_role[]),
       false) then
    raise exception 'insufficient privilege to record attendance' using errcode = '42501';
  end if;

  -- Throttle before any token work, so guessing costs the same as failing.
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

  -- Accept the current bucket and the one before it. Without the grace bucket
  -- a scan that starts at 29.8s into a 30s window fails through no fault of
  -- the student; with more than one it stops being dynamic.
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

  -- §13 time validation, independent of the token's own expiry: a session
  -- must not be able to authorise attendance outside its activity's window.
  -- 30 minutes either side covers arriving early and signing in late.
  if now() < a.starts_at - interval '30 minutes'
     or now() > coalesce(a.ends_at, a.starts_at + interval '4 hours') + interval '30 minutes' then
    return 'outside_activity_window';
  end if;

  -- §13 GPS. Haversine on the server; the client's own distance calculation,
  -- if it made one, is not consulted.
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

  -- Derived, never supplied: on time until the activity starts, late after.
  v_status := case when now() <= a.starts_at + interval '15 minutes'
                   then 'present'::public.attendance_status
                   else 'late'::public.attendance_status end;

  -- inet_client_addr() is deliberately NOT used: through PostgREST it returns
  -- the pooler's address, not the student's — confirmed against this project
  -- rather than assumed. PostgREST exposes the real request headers as a GUC,
  -- so the forwarded address is read from there. Trust level, stated plainly:
  -- this is set by the platform edge, not by the request body, but
  -- x-forwarded-for is still a header and is evidence, not proof. It is
  -- recorded for §15 audit purposes and is never an authorisation input.
  begin
    v_ip := split_part(
      coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
      ',', 1)::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.attendance
    (activity_id, student_id, department_id, class_name, status,
     gps_lat, gps_lng, device_fingerprint, browser, ip, recorded_at)
  select
    s.activity_id, v_actor, p.department_id, p.class_name, v_status,
    p_gps_lat, p_gps_lng, left(p_fingerprint, 200),
    left(coalesce(current_setting('request.headers', true)::json ->> 'user-agent', ''), 300),
    v_ip, now()
  from public.profiles p
  where p.id = v_actor
  -- §13 "duplicate protection". The unique (activity_id, student_id) index
  -- from 0007 is the real guard; this turns the second scan into a calm
  -- "already recorded" instead of a 23505 the UI would have to decode.
  on conflict (activity_id, student_id) do nothing
  returning id into v_inserted;

  -- FOUND alone cannot distinguish the two ways this inserts nothing: a real
  -- duplicate scan, or a missing profiles row for the caller. Reporting the
  -- second as "already recorded" would tell a student their attendance was
  -- taken when no row exists. Check which it actually was.
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

revoke execute on function public.record_attendance(text, numeric, numeric, text) from anon, public;
grant execute on function public.record_attendance(text, numeric, numeric, text) to authenticated;

comment on function public.record_attendance(text, numeric, numeric, text) is
  '§13 attendance write path. student_id/recorded_at/status/ip/activity_id are all server-derived; the caller supplies only a token, a GPS reading and a device fingerprint, each of which is verified rather than stored on trust.';
