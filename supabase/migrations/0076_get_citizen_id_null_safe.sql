-- Fixes a fail-OPEN guard that 0075 introduced into get_citizen_id().
--
-- 0075 rewrote the check as:
--
--   if member_id <> (select auth.uid()) and public.current_role() <> 'admin'
--
-- For `anon`, auth.uid() is NULL, so `member_id <> NULL` is NULL — not true.
-- `NULL and true` is NULL, `if NULL then` does not fire, and the function
-- RETURNED THE VALUE instead of raising. Three-valued logic turned an
-- authorization check into a no-op for exactly the caller it was meant to stop.
--
-- 0004's original was `if public.current_role() <> 'admin'`, which is plainly
-- true for anon and raised correctly. 0075's own comment claimed the new
-- version was "still fail-closed for anon" — reasoned, never tested. Its test
-- matrix caught it (case 12), which is the only reason this is a same-day fix
-- rather than a leak.
--
-- Nothing was exposed in practice: citizen_id was NULL for every profile while
-- the flaw existed. That is luck about timing, not a mitigation.
--
-- THE GENERAL RULE, worth more than this one function: in a SECURITY DEFINER
-- guard, never compare against auth.uid() with `=` or `<>`. It is NULL for
-- anon, and every such comparison yields NULL, which `if` treats as false — so
-- the guard fails OPEN. Require a session explicitly, then use `is distinct
-- from`, which is NULL-safe in both directions.

create or replace function public.get_citizen_id(member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result text;
begin
  -- No session at all: refuse before any comparison can go three-valued.
  if uid is null then
    raise exception 'insufficient privilege to read citizen_id';
  end if;

  -- `is distinct from`, not `<>`: a NULL member_id, or a current_role() that
  -- somehow returns NULL, both land on "refuse" rather than on NULL.
  if member_id is distinct from uid
     and public.current_role() is distinct from 'admin' then
    raise exception 'insufficient privilege to read citizen_id';
  end if;

  select citizen_id into result from public.profiles where id = member_id;
  return result;
end;
$$;

-- `create or replace` resets grants to PUBLIC EXECUTE (the 0011 -> 0012 trap),
-- so they are restated rather than assumed. A broad grant is intentional and
-- now actually safe: the function enforces its own authorization, and the
-- matrix asserts anon is refused for every argument.
grant execute on function public.get_citizen_id(uuid) to anon, authenticated;
