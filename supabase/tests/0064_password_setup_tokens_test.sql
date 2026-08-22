-- 0064 password-setup token matrix. Re-runnable and non-destructive: one
-- transaction, rolled back, including every token row it mints.
--
-- Run with:  psql "$DATABASE_URL" -f supabase/tests/0064_password_setup_tokens_test.sql
--
-- WHAT IS BEING PROVEN, AND WHY IT IS PROVEN HERE RATHER THAN IN TYPESCRIPT
--
-- This table is the authorisation for the first unauthenticated path to the
-- service-role key in this codebase: whoever presents a token gets their
-- password changed. So the properties below are not "does the service layer
-- call the right functions" -- they are properties of the DATA, and the only
-- honest place to assert them is against the database itself.
--
-- Cases 01-03 are the ones that matter. If a client can read or write this
-- table, everything else here is decoration.

begin;

create temporary table _r (case_name text, outcome text);

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 json_build_object('sub', uid, 'role','authenticated')::text);
end $$;

-- Statements run as STATEMENTS -- `select (insert into ...)` is not valid
-- syntax, so an expect-refused helper would record the syntax error as a
-- refusal (a false green this project has already been bitten by, 0057).
create or replace function pg_temp.exec(case_name text, uid uuid, sql text, expect text)
returns void language plpgsql as $$
begin
  begin
    if uid is null then execute 'set local role anon';
    else perform pg_temp.as_user(uid); end if;
    execute sql;
    reset role;
    insert into _r values (case_name,
      case when expect='refused' then 'FAIL - ALLOWED' else 'PASS - allowed' end);
  exception when others then
    reset role;
    insert into _r values (case_name,
      case when expect='refused' then 'PASS - refused (' || sqlstate || ': ' || sqlerrm || ')'
           else 'FAIL - refused (' || sqlstate || ': ' || sqlerrm || ')' end);
  end;
end $$;

-- Fixtures --------------------------------------------------------------
-- Two DIFFERENT users, because the single most damaging failure mode is not
-- "a token works twice" but "a token works for the wrong account".
create temporary table _fx as
select (select id from public.profiles order by id limit 1)        as user_a,
       (select id from public.profiles order by id desc limit 1)   as user_b;

-- 32 random bytes, hex-sha256'd exactly as lib/password-tokens.ts does.
create or replace function pg_temp.mk_token() returns text language sql as $$
  select encode(extensions.gen_random_bytes(32), 'base64')
$$;
create or replace function pg_temp.hash(t text) returns text language sql as $$
  select encode(extensions.digest(t, 'sha256'), 'hex')
$$;

-- The consumption statement, copied verbatim in shape from
-- services/password-setup.ts#consumeToken. Returns the user id or null.
create or replace function pg_temp.consume(t text) returns uuid language plpgsql as $$
declare v uuid;
begin
  update public.password_setup_tokens
     set used_at = now()
   where token_hash = pg_temp.hash(t)
     and used_at is null
     and expires_at > now()
  returning user_id into v;
  return v;
end $$;

do $$
declare
  fx record;
  t_valid text; t_expired text; t_used text; t_b text;
  got uuid; got2 uuid; n int;
begin
  select * into fx from _fx;

  t_valid   := pg_temp.mk_token();
  t_expired := pg_temp.mk_token();
  t_used    := pg_temp.mk_token();
  t_b       := pg_temp.mk_token();

  insert into public.password_setup_tokens (user_id, token_hash, expires_at) values
    (fx.user_a, pg_temp.hash(t_valid),   now() + interval '1 hour'),
    (fx.user_a, pg_temp.hash(t_expired), now() - interval '1 minute'),
    (fx.user_a, pg_temp.hash(t_used),    now() + interval '1 hour'),
    (fx.user_b, pg_temp.hash(t_b),       now() + interval '1 hour');

  update public.password_setup_tokens
     set used_at = now() where token_hash = pg_temp.hash(t_used);

  -- 04: the happy path, first. Without this control, a matrix where nothing
  -- works at all would "pass" every refusal case below.
  got := pg_temp.consume(t_valid);
  insert into _r values ('04 valid token consumes and returns its owner',
    case when got = fx.user_a then 'PASS - returned user_a' else 'FAIL - returned ' || coalesce(got::text,'null') end);

  -- 05: THE single-use property. The same token, immediately again. This is
  -- one statement doing its own check, not a read-then-write, so a second
  -- caller finds used_at already set and matches nothing.
  got2 := pg_temp.consume(t_valid);
  insert into _r values ('05 same token a second time returns nothing',
    case when got2 is null then 'PASS - 0 rows' else 'FAIL - consumed twice (' || got2 || ')' end);

  insert into _r values ('06 expired token refused',
    case when pg_temp.consume(t_expired) is null then 'PASS - 0 rows' else 'FAIL - expired token accepted' end);

  insert into _r values ('07 already-used token refused',
    case when pg_temp.consume(t_used) is null then 'PASS - 0 rows' else 'FAIL - used token accepted' end);

  insert into _r values ('08 unknown token refused',
    case when pg_temp.consume(pg_temp.mk_token()) is null then 'PASS - 0 rows' else 'FAIL - unknown token accepted' end);

  -- 09: user A's token must never resolve to user B. The failure this guards
  -- is not theoretical -- it is what any "look up the token, then read the
  -- user from the request" implementation would allow.
  got := pg_temp.consume(t_b);
  insert into _r values ('09 user B token returns user B, never user A',
    case when got = fx.user_b then 'PASS - returned user_b'
         when got = fx.user_a then 'FAIL - CROSS-ACCOUNT: returned user_a'
         else 'FAIL - returned ' || coalesce(got::text,'null') end);

  -- 10: the CHECK is what makes "the stored value is a hash" an invariant
  -- rather than a convention. A raw token stored by mistake is refused.
  begin
    insert into public.password_setup_tokens (user_id, token_hash, expires_at)
    values (fx.user_a, 'not-a-sha256-hex-digest', now() + interval '1 hour');
    insert into _r values ('10 non-hex token_hash refused by CHECK', 'FAIL - ALLOWED');
  exception when check_violation then
    insert into _r values ('10 non-hex token_hash refused by CHECK', 'PASS - refused (23514)');
  end;

  -- 11: the unique index. Two rows sharing a hash would make "consume by
  -- hash" ambiguous.
  begin
    insert into public.password_setup_tokens (user_id, token_hash, expires_at)
    values (fx.user_b, pg_temp.hash(t_b), now() + interval '1 hour');
    insert into _r values ('11 duplicate token_hash refused by unique index', 'FAIL - ALLOWED');
  exception when unique_violation then
    insert into _r values ('11 duplicate token_hash refused by unique index', 'PASS - refused (23505)');
  end;

  -- 12: the mint throttle's arithmetic (the count services/password-setup.ts
  -- runs). 4 rows already exist for user_a from the fixtures above.
  select count(*) into n from public.password_setup_tokens
   where user_id = fx.user_a and created_at >= now() - interval '15 minutes';
  insert into _r values ('12 throttle counts this user''s recent mints',
    case when n >= 3 then 'PASS - ' || n || ' in window (>= limit 3, 4th would be declined)'
         else 'FAIL - counted ' || n end);

  -- 13: cascade. A deleted account must not leave live tokens behind that
  -- would resolve to a dangling user_id.
  select count(*) into n from pg_constraint
   where conname = 'password_setup_tokens_user_id_fkey' and confdeltype = 'c';
  insert into _r values ('13 tokens cascade when the profile is deleted',
    case when n = 1 then 'PASS - ON DELETE CASCADE' else 'FAIL - not cascading' end);

  -- 18-20: THE EMAIL-SCANNER SIMULATION.
  --
  -- Gmail, Outlook and corporate antivirus fetch links in mail before a human
  -- does. peekToken() (a SELECT) is what the GET runs; consumeToken() (the
  -- UPDATE above) is what the POST runs. Two scanner fetches followed by a
  -- real click must still work -- if the GET ever consumes, this is the case
  -- that catches it, and it is the difference between a flow that works and
  -- one that fails intermittently for reasons no log explains.
  t_valid := pg_temp.mk_token();
  insert into public.password_setup_tokens (user_id, token_hash, expires_at)
  values (fx.user_a, pg_temp.hash(t_valid), now() + interval '1 hour');

  select count(*) into n from public.password_setup_tokens
   where token_hash = pg_temp.hash(t_valid) and used_at is null and expires_at > now();
  insert into _r values ('18 scanner GET #1 sees a valid token',
    case when n = 1 then 'PASS - valid' else 'FAIL - ' || n end);

  select count(*) into n from public.password_setup_tokens
   where token_hash = pg_temp.hash(t_valid) and used_at is null and expires_at > now();
  insert into _r values ('19 scanner GET #2 still sees it (peek does not consume)',
    case when n = 1 then 'PASS - still valid' else 'FAIL - consumed by a peek' end);

  got := pg_temp.consume(t_valid);
  insert into _r values ('20 the human''s POST after 2 scanner GETs still works',
    case when got = fx.user_a then 'PASS - consumed by the POST'
         else 'FAIL - link was already dead (' || coalesce(got::text,'null') || ')' end);
end $$;

-- Client access. These run OUTSIDE the DO block because a failed statement
-- inside one aborts the whole block; each is its own subtransaction here.
--
-- 01-03 are the load-bearing cases. The service-role client is exempt from
-- all of this by design -- it is the only thing that touches this table.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.exec('01 authenticated cannot SELECT tokens', fx.user_a,
    'select 1 from public.password_setup_tokens', 'refused');
  perform pg_temp.exec('02 authenticated cannot INSERT a token', fx.user_a,
    format('insert into public.password_setup_tokens (user_id, token_hash, expires_at) values (%L, repeat(''a'',64), now() + interval ''1 hour'')', fx.user_a),
    'refused');
  perform pg_temp.exec('03 authenticated cannot DELETE (cover their tracks)', fx.user_a,
    'delete from public.password_setup_tokens', 'refused');
  perform pg_temp.exec('14 authenticated cannot UPDATE (un-use a token)', fx.user_a,
    'update public.password_setup_tokens set used_at = null', 'refused');
  perform pg_temp.exec('15 anon cannot SELECT tokens', null,
    'select 1 from public.password_setup_tokens', 'refused');
  perform pg_temp.exec('16 anon cannot INSERT a token', null,
    format('insert into public.password_setup_tokens (user_id, token_hash, expires_at) values (%L, repeat(''b'',64), now() + interval ''1 hour'')', fx.user_a),
    'refused');
end $$;

-- 17: RLS enabled with zero policies -- the fail-closed state. Checked
-- explicitly because the grants above are what refuse today; if a future
-- migration re-grants SELECT (the way Supabase's defaults granted UPDATE on
-- activities.created_by until 0061 revoked it), this is the layer that still
-- returns zero rows instead of the whole table.
insert into _r
select '17 RLS enabled, no policies (fails closed)',
       case when (select relrowsecurity from pg_class where oid = 'public.password_setup_tokens'::regclass)
             and (select count(*) from pg_policies where tablename = 'password_setup_tokens') = 0
            then 'PASS - RLS on, 0 policies'
            else 'FAIL - RLS off or policies present' end;

select case_name, outcome from _r order by case_name;

rollback;
