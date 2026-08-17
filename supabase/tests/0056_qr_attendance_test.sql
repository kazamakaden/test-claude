-- §13 abuse matrix for 0056. Re-runnable and non-destructive: everything runs
-- inside one transaction that is rolled back, including the temporary mutation
-- of activity dates that several cases need.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0056_qr_attendance_test.sql
--
-- The point of this file is that record_attendance() is SECURITY DEFINER and
-- granted to `authenticated`. It is reachable at /rest/v1/rpc/record_attendance
-- by anyone signed in, so every guard inside it is a real boundary and none of
-- them is enforced by RLS. They are only as good as this matrix.
--
-- Cases marked (†) read `secret` as the table OWNER to forge test tokens. No
-- client can do that -- case 09 is the proof -- it is done here precisely to
-- attack the scheme from a stronger position than any real attacker holds.

begin;

create temporary table _r (case_name text, outcome text);

create temporary table _fx as
select (select id from public.profiles where role='admin'   order by id limit 1) as admin_id,
       (select id from public.profiles where role='student' order by id limit 1) as student_id;

-- TWO activities, deliberately. An earlier version of this file used one, which
-- silently made the cross-session case meaningless: both sessions pointed at
-- the same activity, so the "forged" token was legitimately valid for its own
-- session and merely tripped the duplicate guard. It looked like a pass and
-- tested nothing. Two activities is what makes a cross-session token an actual
-- privilege gain -- attendance somewhere the holder never was.
create temporary table _acts as
  select id, row_number() over (order by starts_at) rn from public.activities limit 2;

update public.activities
set starts_at = now() - interval '5 minutes', ends_at = now() + interval '2 hours'
where id in (select id from _acts);

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
end $$;

-- Records the RETURN VALUE, not just pass/fail: record_attendance answers with
-- a status string for the outcomes a student can legitimately reach, and the
-- distinction between 'out_of_range' and 'expired_token' is the assertion.
create or replace function pg_temp.try(case_name text, uid uuid, sql text)
returns void language plpgsql as $$
declare res text;
begin
  begin
    perform pg_temp.as_user(uid);
    execute sql into res;
    reset role;
    insert into _r values (case_name, 'returned: ' || coalesce(res,'<null>'));
  exception when others then
    reset role;
    insert into _r values (case_name, 'raised: ' || sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare fx record; a1 uuid; a2 uuid; s1 record; s2 record;
begin
  select * into fx from _fx;
  select id into a1 from _acts where rn=1;
  select id into a2 from _acts where rn=2;
  perform pg_temp.as_user(fx.admin_id);
  -- Session 1 is GPS-fenced on the college; session 2 is unfenced.
  select * into s1 from public.create_qr_session(a1, now() + interval '1 hour', 30,
                                                 17.413000, 102.787000, 100);
  select * into s2 from public.create_qr_session(a2, now() + interval '1 hour', 30,
                                                 null, null, null);
  reset role;
  create temporary table _s as select s1.slug slug1, s2.slug slug2, a1 act1, a2 act2;
end $$;

do $$
declare fx record; sl1 text; sl2 text; sec1 bytea; sec2 bytea; bkt bigint;
begin
  select * into fx from _fx;
  select slug1, slug2 into sl1, sl2 from _s;
  select secret into sec1 from public.qr_sessions where slug = sl1;  -- (†)
  select secret into sec2 from public.qr_sessions where slug = sl2;  -- (†)
  bkt := floor(extract(epoch from now())/30)::bigint;

  -- Authorization -------------------------------------------------------
  -- 01 is SEC-1 restated at the RPC layer: a read-only student holds no
  -- attendance:submit, and a SECURITY DEFINER function bypasses the RLS that
  -- would otherwise say so, hence the explicit guard inside it.
  perform pg_temp.try('01 student calls record_attendance', fx.student_id,
    format('select public.record_attendance(%L, 17.413, 102.787, ''fp'')',
           public.qr_token_for_bucket(sl1, sec1, bkt)));
  perform pg_temp.try('02 student creates a session', fx.student_id,
    format('select (public.create_qr_session(%L, now() + interval ''1 hour'')).slug',
           (select act1 from _s)));

  -- The scheme rests entirely on `secret` being unreachable and the token
  -- helper being uncallable. If either of these ever passes, tokens can be
  -- minted client-side and every other case here is decoration.
  perform pg_temp.try('03 staff reads secret', fx.admin_id,
    'select length(secret)::text from public.qr_sessions limit 1');
  perform pg_temp.try('04 staff mints own token', fx.admin_id,
    format('select public.qr_token_for_bucket(%L, ''\x00''::bytea, 1)', sl1));
  perform pg_temp.try('05 student reads qr_sessions', fx.student_id,
    'select count(*)::text from public.qr_sessions');
  perform pg_temp.try('06 student reads throttle table', fx.student_id,
    'select count(*)::text from public.qr_scan_attempts');

  -- Token validity -------------------------------------------------------
  perform pg_temp.try('07 valid scan, in fence and window', fx.admin_id,
    format('select public.record_attendance(%L, 17.413, 102.787, ''fp'')',
           public.qr_token_for_bucket(sl1, sec1, bkt)));
  perform pg_temp.try('08 replay of the same token', fx.admin_id,
    format('select public.record_attendance(%L, 17.413, 102.787, ''fp'')',
           public.qr_token_for_bucket(sl1, sec1, bkt)));
  perform pg_temp.try('09 stale bucket (n-5)', fx.admin_id,
    format('select public.record_attendance(%L, 17.413, 102.787, ''fp'')',
           public.qr_token_for_bucket(sl1, sec1, bkt - 5)));
  perform pg_temp.try('10 grace bucket (n-1) accepted', fx.admin_id,
    format('select public.record_attendance(%L, null, null, null)',
           public.qr_token_for_bucket(sl2, sec2, bkt - 1)));
  perform pg_temp.try('11 garbage token', fx.admin_id,
    'select public.record_attendance(''aaaaaaaaaa.deadbeef'', 17.413, 102.787, ''fp'')');

  -- THE cross-session forgery: session 1's public slug signed with session 2's
  -- secret. If the HMAC were not bound to the per-session secret, holding any
  -- one QR would grant attendance at every other activity.
  perform pg_temp.try('12 cross-session forged token', fx.admin_id,
    format('select public.record_attendance(%L, 17.413, 102.787, ''fp'')',
           public.qr_token_for_bucket(sl1, sec2, bkt)));

  -- Location and time ----------------------------------------------------
  perform pg_temp.try('13 out of range (Bangkok)', fx.admin_id,
    format('select public.record_attendance(%L, 13.7563, 100.5018, ''fp'')',
           public.qr_token_for_bucket(sl1, sec1, bkt)));
  perform pg_temp.try('14 GPS omitted on fenced session', fx.admin_id,
    format('select public.record_attendance(%L, null, null, ''fp'')',
           public.qr_token_for_bucket(sl1, sec1, bkt)));
end $$;

-- 15. Revoked session refuses an otherwise perfect current token.
do $$
declare fx record; sl2 text; sec2 bytea;
begin
  select * into fx from _fx;
  select slug2 into sl2 from _s;
  select secret into sec2 from public.qr_sessions where slug = sl2;
  update public.qr_sessions set revoked_at = now() where slug = sl2;
  perform pg_temp.try('15 revoked session', fx.admin_id,
    format('select public.record_attendance(%L, null, null, null)',
           public.qr_token_for_bucket(sl2, sec2, floor(extract(epoch from now())/30)::bigint)));
  update public.qr_sessions set revoked_at = null where slug = sl2;
end $$;

-- 16. Outside the activity's own window, with a perfectly valid token. The
--     session's expiry and the activity's window are independent checks: a
--     session must not be able to authorise attendance at an activity that is
--     ten hours away.
do $$
declare fx record; sl2 text; sec2 bytea; a2 uuid;
begin
  select * into fx from _fx;
  select slug2, act2 into sl2, a2 from _s;
  select secret into sec2 from public.qr_sessions where slug = sl2;
  delete from public.qr_scan_attempts;
  delete from public.attendance;
  update public.activities set starts_at = now() + interval '10 hours',
                               ends_at   = now() + interval '12 hours' where id = a2;
  perform pg_temp.try('16 outside activity window', fx.admin_id,
    format('select public.record_attendance(%L, null, null, null)',
           public.qr_token_for_bucket(sl2, sec2, floor(extract(epoch from now())/30)::bigint)));
end $$;

-- 17. Throttle (SEC-6). Ten failures are absorbed; the eleventh raises. Without
--     this a 32-bit token is worth guessing, because guessing would be free.
do $$
declare fx record; i int; res text;
begin
  select * into fx from _fx;
  delete from public.qr_scan_attempts;
  for i in 1..10 loop
    perform pg_temp.as_user(fx.admin_id);
    begin execute 'select public.record_attendance(''zzzzzzzzzz.deadbeef'')' into res;
    exception when others then null; end;
    reset role;
  end loop;
  perform pg_temp.try('17 throttle trips on 11th attempt', fx.admin_id,
    'select public.record_attendance(''zzzzzzzzzz.deadbeef'')');
end $$;

select case_name, outcome from _r order by case_name;

rollback;
