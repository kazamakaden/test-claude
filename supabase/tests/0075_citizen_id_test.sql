-- Matrix for 0075: §14 เลขบัตรประชาชน.
--
-- Self-rolling-back and re-runnable. Asserts BOTH directions throughout: a
-- test that only checks the second write is refused would also pass against a
-- column nobody can write at all, and a test that only checks the owner can
-- read would pass against an accessor that returns everyone's.
--
-- The two boundaries this migration must NOT have moved are re-proven here
-- rather than assumed: 0005's column allow-list (citizen_id unreadable over
-- PostgREST) and get_citizen_id()'s refusal for anyone who is neither the
-- subject nor an admin — including anon, whose auth.uid() is null and so
-- matches no branch.
--
-- 1101700234568 and 3101001122333 are valid mod-11 numbers built for this file,
-- not real ones.

begin;

create temp table zz_results(id text, ok boolean, detail text) on commit drop;
-- The role switches below apply to this table too; without the grant every
-- insert 42501s as authenticated/anon and the run dies on case 01.
grant insert on zz_results to authenticated, anon;

do $$
declare
  member_id uuid;
  admin_id uuid;
  got text;
  affected int;
begin
  select id into member_id from public.profiles where role = 'student' limit 1;
  select id into admin_id  from public.profiles where role = 'admin'   limit 1;

  ------------------------------------------------------------ as the member
  perform set_config('request.jwt.claims',
    json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 01: the owner may set it ONCE. Load-bearing guard: if this ever fails, the
  -- refusals below prove nothing, because the column would be unwritable.
  update public.profiles set citizen_id = '1101700234568' where id = member_id;
  get diagnostics affected = row_count;
  insert into zz_results values ('01 owner can set it once (guard)',
    affected = 1, format('rows=%s', affected));

  -- 02: and only once. prevent_citizen_id_change (0003) raises P0001 — a
  -- trigger, so this raises rather than filtering to zero rows.
  begin
    update public.profiles set citizen_id = '3101001122333' where id = member_id;
    insert into zz_results values ('02 owner cannot change it again', false, 'NOT refused');
  exception when others then
    insert into zz_results values ('02 owner cannot change it again',
      sqlstate = 'P0001', format('sqlstate=%s %s', sqlstate, sqlerrm));
  end;

  -- 03/04/05: the shape constraint (0075). Nulling first, because the set-once
  -- trigger would mask the CHECK for an already-set row.
  perform set_config('request.jwt.claims', null, true);
  reset role;
  update public.profiles set citizen_id = null where id = member_id;
  perform set_config('request.jwt.claims',
    json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    update public.profiles set citizen_id = '110170023456' where id = member_id;
    insert into zz_results values ('03 12 digits refused', false, 'NOT refused');
  exception when others then
    insert into zz_results values ('03 12 digits refused',
      sqlstate = '23514', format('sqlstate=%s', sqlstate));
  end;

  begin
    update public.profiles set citizen_id = '11017002345678' where id = member_id;
    insert into zz_results values ('04 14 digits refused', false, 'NOT refused');
  exception when others then
    insert into zz_results values ('04 14 digits refused',
      sqlstate = '23514', format('sqlstate=%s', sqlstate));
  end;

  begin
    update public.profiles set citizen_id = 'abcdefghijklm' where id = member_id;
    insert into zz_results values ('05 non-numeric refused', false, 'NOT refused');
  exception when others then
    insert into zz_results values ('05 non-numeric refused',
      sqlstate = '23514', format('sqlstate=%s', sqlstate));
  end;

  -- 06: the other direction of 03-05 — a well-formed value is still accepted.
  update public.profiles set citizen_id = '1101700234568' where id = member_id;
  get diagnostics affected = row_count;
  insert into zz_results values ('06 valid 13 digits accepted',
    affected = 1, format('rows=%s', affected));

  -- 07: self-read, the whole reason 0075 touched the accessor.
  select public.get_citizen_id(member_id) into got;
  insert into zz_results values ('07 owner reads their own',
    got = '1101700234568', format('got=%s', coalesce(got, 'NULL')));

  -- 08: and nobody else's.
  begin
    select public.get_citizen_id(admin_id) into got;
    insert into zz_results values ('08 member cannot read another', false, format('got=%s', got));
  exception when others then
    insert into zz_results values ('08 member cannot read another',
      sqlstate = 'P0001', format('sqlstate=%s', sqlstate));
  end;

  -- 09: the 0005 boundary is unchanged — the column itself stays unreadable.
  begin
    perform citizen_id from public.profiles where id = member_id;
    insert into zz_results values ('09 direct select still refused', false, 'NOT refused');
  exception when others then
    insert into zz_results values ('09 direct select still refused',
      sqlstate = '42501', format('sqlstate=%s %s', sqlstate, sqlerrm));
  end;

  ------------------------------------------------------------------ as admin
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);

  -- 10: an admin reads anyone's — the other direction of 08.
  select public.get_citizen_id(member_id) into got;
  insert into zz_results values ('10 admin reads another',
    got = '1101700234568', format('got=%s', coalesce(got, 'NULL')));

  -- 11: and an admin CAN change it — the other direction of 02, and the half
  -- §14 actually names ("cannot be changed without Administrator permission").
  update public.profiles set citizen_id = '3101001122333' where id = member_id;
  get diagnostics affected = row_count;
  insert into zz_results values ('11 admin can change it',
    affected = 1, format('rows=%s', affected));

  -- 12b: a NULL argument from a non-admin. `is distinct from` (0076) changes
  -- this path too — with plain `<>` it would have gone three-valued and fallen
  -- through, the same shape as the anon bug.
  perform set_config('request.jwt.claims',
    json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    select public.get_citizen_id(null) into got;
    insert into zz_results values ('12b null member_id refused', false, format('got=%s', coalesce(got, 'NULL')));
  exception when others then
    insert into zz_results values ('12b null member_id refused',
      sqlstate = 'P0001', format('sqlstate=%s', sqlstate));
  end;

  ------------------------------------------------------------------ as anon
  perform set_config('request.jwt.claims', null, true);
  reset role;
  set local role anon;

  -- 12: still fail-closed. auth.uid() is null for anon, so neither branch of
  -- the accessor matches and it raises exactly as before 0075.
  begin
    select public.get_citizen_id(member_id) into got;
    insert into zz_results values ('12 anon refused', false, format('got=%s', got));
  exception when others then
    insert into zz_results values ('12 anon refused',
      sqlstate = 'P0001', format('sqlstate=%s', sqlstate));
  end;

  ------------------------------------------------------------------- cleanup
  perform set_config('request.jwt.claims', null, true);
  reset role;
  update public.profiles set citizen_id = null where id = member_id;

  insert into zz_results values ('13 cleanup: column back to null',
    (select count(*) from public.profiles where citizen_id is not null) = 0, '');
end $$;

-- 14: `create or replace` resets grants to PUBLIC EXECUTE, silently undoing a
-- prior revoke — the 0011 -> 0012 trap. Here a broad grant is the INTENDED
-- state (the function enforces its own authorization and case 12 proves it
-- refuses anon), so this asserts the grant exists rather than that it is gone.
insert into zz_results
select '14 get_citizen_id executable by anon+authenticated',
       count(*) = 2, format('grants=%s', count(*))
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name = 'get_citizen_id'
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'EXECUTE';

-- 15: the constraint is actually attached, not merely written in a file.
insert into zz_results
select '15 profiles_citizen_id_format exists',
       count(*) = 1, format('constraints=%s', count(*))
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_citizen_id_format';

select id, case when ok then 'PASS' else 'FAIL' end as status, detail
from zz_results order by id;

rollback;
