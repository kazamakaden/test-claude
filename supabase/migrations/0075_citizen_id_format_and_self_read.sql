-- §14 เลขบัตรประชาชน: give citizen_id the two things the database lacked.
--
-- The RULE §14 asks for is already implemented and is NOT changed here:
-- prevent_citizen_id_change (0003) raises only when `old.citizen_id is not
-- null` and the actor is not admin, so anyone who may update the row sets it
-- ONCE and only an admin can change it afterwards. 0005's column allow-list
-- (which excludes citizen_id) still keeps it unreadable over PostgREST. This
-- migration adds only what was missing.
--
-- 1. A SHAPE constraint. The column has been free text since 0003, so a typo
--    or junk was storable — and because the value is set once and then
--    admin-locked, a wrong value is expensive to correct. 13 digits is the
--    whole of what SQL checks here.
--
--    The mod-11 CHECK DIGIT is deliberately NOT in this constraint. It lives in
--    lib/citizen-id.ts, shared by the client form and the Server Action, because
--    a digit-by-digit mod-11 expression in SQL is unreadable and hard to correct
--    later, while this is one regex. Stated so the split is not mistaken for an
--    oversight: shape is the database's backstop, checksum is the app's rule.
--
-- 2. SELF-READ on the accessor. 0004's get_citizen_id() is admin-only, and
--    0005 removed the column from every client's select list — so a member who
--    stored their own number could never see it again. A person may obviously
--    read their own national ID.
--
--    !! THIS CLAIM WAS WRONG AND IS FIXED BY 0076. !!
--
--    The comment below originally read "still fail-closed for anon". It was
--    reasoned, never tested, and the opposite was true: with auth.uid() NULL,
--    `member_id <> (select auth.uid())` is NULL, `NULL and true` is NULL, and
--    `if NULL then` does not fire — so the guard failed OPEN and anon could
--    read the value. This file's own test matrix caught it (case 12).
--
--    The SQL below is left exactly as it was applied — a migration that has run
--    is history. 0076 replaces the function with a NULL-safe guard; read that
--    one for the current behaviour.

alter table public.profiles
  add constraint profiles_citizen_id_format
  check (citizen_id is null or citizen_id ~ '^[0-9]{13}$');

create or replace function public.get_citizen_id(member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  -- Own row, or admin. Order matters only for readability; both are checked.
  if member_id <> (select auth.uid()) and public.current_role() <> 'admin' then
    raise exception 'insufficient privilege to read citizen_id';
  end if;

  select citizen_id into result from public.profiles where id = member_id;
  return result;
end;
$$;

-- `create or replace` RESETS grants to the PostgreSQL default (PUBLIC EXECUTE),
-- silently undoing any prior revoke — the 0011 -> 0012 trap this project has
-- already been bitten by once. Restated here rather than assumed, so the
-- function's reachable callers are whatever this migration says they are.
--
-- Deliberately left executable by anon as well as authenticated: it enforces
-- its own authorization and raises for anyone who is neither the subject nor an
-- admin, so a broad EXECUTE grant costs nothing and matches its state before
-- this migration.
grant execute on function public.get_citizen_id(uuid) to anon, authenticated;
