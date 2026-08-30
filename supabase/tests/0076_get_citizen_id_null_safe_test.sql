-- Matrix for 0076: get_citizen_id() must fail CLOSED for a caller with no session.
--
-- 0075 rewrote the guard as `member_id <> (select auth.uid())`. For anon
-- auth.uid() is NULL, so that comparison is NULL, `NULL and true` is NULL, and
-- `if NULL then` does not fire -- the function skipped the raise and RETURNED
-- the value. It failed open for exactly the caller it was meant to stop.
--
-- Unlike 0075's matrix this file is strictly READ-ONLY: it writes nothing to
-- public.profiles, so it needs no rollback and is safe to paste into the
-- Supabase SQL editor against production. That is possible only because a
-- refusal RAISES while an allowance RETURNS -- with citizen_id NULL for every
-- profile the two outcomes are still distinguishable.
--
-- The three "(guard)" cases are load-bearing: without them the refusals would
-- pass just as well against a function that refuses EVERYONE, which would be a
-- different bug rather than a fix.

drop table if exists zz_verify;
create temp table zz_verify(id text primary key, ok boolean, detail text);
-- The role switches below apply to this table too; without the grant every
-- insert 42501s as anon/authenticated and the run dies on the first case.
grant insert on zz_verify to anon, authenticated;

do $$
declare
  member_id uuid;
  admin_id  uuid;
  got text;
begin
  select id into member_id from public.profiles where role = 'student' limit 1;
  select id into admin_id  from public.profiles where role = 'admin'   limit 1;

  if member_id is null or admin_id is null then
    insert into zz_verify values ('00 fixtures found (guard)', false,
      format('student=%s admin=%s', member_id, admin_id));
    return;
  end if;
  insert into zz_verify values ('00 fixtures found (guard)', true, '');

  ---------------------------------------------------------------------- anon
  -- 12: THE REGRESSION. Before 0076 this returned the value instead of raising.
  perform set_config('request.jwt.claims', null, true);
  set local role anon;
  begin
    got := public.get_citizen_id(member_id);
    insert into zz_verify values ('12 anon refused', false,
      format('NOT REFUSED, returned %s', coalesce(got, 'NULL')));
  exception when others then
    insert into zz_verify values ('12 anon refused', true,
      format('%s %s', sqlstate, sqlerrm));
  end;
  reset role;

  ------------------------------------------------------------ a plain member
  perform set_config('request.jwt.claims',
    json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 12b: a NULL argument. `is distinct from` is NULL-safe in BOTH directions,
  -- so this path changed too and is asserted rather than assumed.
  begin
    got := public.get_citizen_id(null);
    insert into zz_verify values ('12b null member_id refused', false,
      format('NOT REFUSED, returned %s', coalesce(got, 'NULL')));
  exception when others then
    insert into zz_verify values ('12b null member_id refused', true,
      format('%s %s', sqlstate, sqlerrm));
  end;

  -- 12c: someone else's number.
  begin
    got := public.get_citizen_id(admin_id);
    insert into zz_verify values ('12c other member refused', false,
      format('NOT REFUSED, returned %s', coalesce(got, 'NULL')));
  exception when others then
    insert into zz_verify values ('12c other member refused', true,
      format('%s %s', sqlstate, sqlerrm));
  end;

  -- 12d: own row must STILL work. Returning NULL is a pass here: it means the
  -- call was allowed and the column is empty, which it is for every profile.
  begin
    got := public.get_citizen_id(member_id);
    insert into zz_verify values ('12d own row allowed (guard)', true,
      format('returned %s', coalesce(got, 'NULL (none on file)')));
  exception when others then
    insert into zz_verify values ('12d own row allowed (guard)', false,
      format('REFUSED %s %s', sqlstate, sqlerrm));
  end;
  reset role;

  --------------------------------------------------------------------- admin
  -- 12e: the half of the rule §14 actually names -- an admin may read any.
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    got := public.get_citizen_id(member_id);
    insert into zz_verify values ('12e admin may read any (guard)', true,
      format('returned %s', coalesce(got, 'NULL (none on file)')));
  exception when others then
    insert into zz_verify values ('12e admin may read any (guard)', false,
      format('REFUSED %s %s', sqlstate, sqlerrm));
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
end $$;

-- 14: `create or replace` resets grants to PUBLIC EXECUTE (the 0011 -> 0012
-- trap). Here a broad grant is the INTENDED state, because the function
-- enforces its own authorization and case 12 is what proves it -- so this
-- asserts the grant EXISTS rather than that it is gone.
insert into zz_verify
select '14 anon+authenticated may EXECUTE', count(*) = 2, format('grants=%s', count(*))
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name = 'get_citizen_id'
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'EXECUTE';

-- 15: 0075's shape constraint is still attached (0076 must not have disturbed it).
insert into zz_verify
select '15 profiles_citizen_id_format attached', count(*) = 1,
       format('constraints=%s', count(*))
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_citizen_id_format';

-- 16: the live body is 0076's, not 0075's. Case 12 already proves the
-- behaviour; this names WHICH version is deployed when it does not.
insert into zz_verify
select '16 live body is 0076',
       def like '%is distinct from%' and def like '%uid is null%',
       case when def like '%<> (select auth.uid())%'
            then 'STILL THE 0075 BODY' else 'ok' end
from (
  select pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_citizen_id'
) s;

select id, case when ok then 'PASS' else 'FAIL' end as status, detail
from zz_verify order by id;
