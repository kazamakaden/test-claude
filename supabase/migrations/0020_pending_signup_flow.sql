-- Replaces the pre-approval roster with a post-signup approval queue.
--
-- Before: an admin had to add a numeric student-ID email to
-- approved_accounts BEFORE that person could sign in; handle_new_user()
-- raised 'account not approved' otherwise, and named staff addresses were
-- auto-assigned 'teacher'.
--
-- After: anyone with an @udontech.ac.th address may sign in and lands as
-- 'pending' (guest-level permissions, no workspace access). An admin then
-- approves them and assigns the real role from /approvals.

-- Least-privilege default. handle_new_user() sets the role explicitly, so
-- this only matters if some future path inserts a profile without one —
-- in which case 'pending' is the safe landing spot, not 'student'.
alter table public.profiles alter column role set default 'pending';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_part text := split_part(new.email, '@', 1);
begin
  -- Every signup starts pending, whatever the address shape. Note what is
  -- deliberately NOT here: no domain check. The @udontech.ac.th rule is
  -- enforced by the CHECK constraint on profiles.email (0001) — a
  -- non-college address fails this INSERT, which raises out of the trigger
  -- and rolls back the auth.users insert along with it, leaving no orphan
  -- account. That constraint is what actually protects the Google OAuth
  -- path, since OAuth never passes through the signIn Server Action where
  -- the Zod domain checks live.
  --
  -- student_id is still parsed from a §14 numeric local part because
  -- profiles.academic_year (0003) is a generated column derived from it —
  -- dropping this would silently null out academic_year for every new
  -- student and break the Members/Activities year filters.
  insert into public.profiles (id, email, role, student_id)
  values (
    new.id,
    new.email,
    'pending',
    case when local_part ~ '^[0-9]{11,}$' then local_part else null end
  );
  return new;
end;
$$;

-- CREATE OR REPLACE FUNCTION resets grants to PostgreSQL's PUBLIC EXECUTE
-- default. 0011 hit exactly this and silently undid 0006's revoke, which
-- 0012 had to repair — and 0012's own comment warns that any future
-- replace of a trigger-only function must repeat the revoke in the same
-- migration. Without this, handle_new_user() becomes callable over
-- /rest/v1/rpc again.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The roster only ever gated signup, and that gate is gone. Nothing else
-- reads this table, so there is no data to preserve: anyone who was on it
-- can now simply sign in and be approved through the normal queue.
-- Dropping the table drops its RLS policy and FK indexes with it.
drop table if exists public.approved_accounts;
