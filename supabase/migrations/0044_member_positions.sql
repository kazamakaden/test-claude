-- อวท. positions: a second authorization axis, orthogonal to user_role.
--
-- user_role says what tier of SYSTEM access someone has (student, teacher,
-- aft_teacher, admin). A position says what OFFICE they hold in the
-- organisation (ประธาน, นายทะเบียน, ...). They are independent: a student can
-- be ประธาน, and a teacher can hold no position at all.
--
-- Holding ANY position grants `member:approve` in the app matrix
-- (lib/auth/permissions.ts) — the existing permission for "edit an approved
-- member, approve a pending one". Permanent delete stays `member:manage`,
-- i.e. admin-only, so officers get edit rights without gaining the
-- irreversible action.
--
-- `advisor`, not `teacher`: the ครู position must not be confused with the
-- `teacher` user_role, which is a different axis entirely. Keeping the names
-- distinct in the schema keeps them distinct in every query that follows.
create type public.member_position as enum (
  'president',         -- ประธาน
  'vice_president',    -- รองประธาน
  'receptionist',      -- ปฏิคม
  'registrar',         -- นายทะเบียน
  'public_relations',  -- ประชาสัมพันธ์
  'secretary',         -- เลขานุการ
  'advisor',           -- ครู (ที่ปรึกษา)
  'committee'          -- กรรมการ
);

-- Nullable, no default, no backfill: null means "general member", so every
-- existing row stays read-only exactly as it is today. Read-only is the safe
-- default for a column that grants authority.
alter table public.profiles
  add column position public.member_position;

comment on column public.profiles.position is
  'อวท. office held, or null for a general member. Orthogonal to `role`: '
  'holding any position grants member:approve. Only an administrator may set '
  'it — enforced by prevent_position_change(), not merely by the UI.';

-- `profiles` carries a column-level SELECT allow-list: 0005 revoked the
-- table-level grant (so citizen_id could be excluded) and re-granted per
-- column. A new column is therefore INVISIBLE to anon/authenticated until
-- named here — the exact trap 0030's `password_set` documented. Both roles
-- get it: the directory is public, and a position is public information
-- (it is who the committee is), unlike email or citizen_id.
grant select (position) on public.profiles to anon, authenticated;
grant update (position) on public.profiles to authenticated;

-- Officers are a handful of rows in a table of many; a partial index is what
-- "list the committee" actually needs, and costs nothing for everyone else.
create index profiles_position_idx
  on public.profiles (position)
  where position is not null;

-- Mirrors the existing current_role() helper (0002) exactly, and for the same
-- reason: a policy that read profiles directly would re-enter profiles' own
-- policies recursively. SECURITY DEFINER + empty search_path, same as the
-- original.
create or replace function public.current_position()
returns public.member_position
language sql
stable
security definer
set search_path = ''
as $$
  select position from public.profiles where id = auth.uid();
$$;

comment on function public.current_position() is
  'The caller''s own อวท. position, or null. Safe to leave callable: it is a '
  'self-lookup that reveals nothing the caller cannot already read about '
  'themselves — same reasoning as current_role().';

-- The escalation guard. Without this, an officer holding member:approve could
-- edit any profile row (including their own colleagues'), set `position`, and
-- mint unlimited officers — turning one appointment into unbounded authority.
-- RLS cannot express this: policies are permissive and OR together, and a
-- WITH CHECK clause never sees OLD. A trigger does.
create or replace function public.prevent_position_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.position is not distinct from old.position then
    return new;
  end if;

  -- No JWT = service role / migration / SQL console, not a user-initiated
  -- request. Same carve-out 0018/0024/0025 use, for the same reason: this
  -- guard exists to constrain what a *user* may do.
  if auth.uid() is null then
    return new;
  end if;

  if public.current_role() <> 'admin' then
    raise exception 'insufficient privilege to assign an อวท. position';
  end if;

  return new;
end;
$$;

-- Named like its five siblings on this table (profiles_prevent_*).
create trigger profiles_prevent_position_change
  before update on public.profiles
  for each row
  execute function public.prevent_position_change();

-- Trigger-only: it exists to run on UPDATE, never to be called over
-- /rest/v1/rpc. 0006 had to revoke this for four sibling functions after the
-- security advisor flagged them; doing it upfront here rather than waiting to
-- be told.
-- `from public` is NOT optional: a function is created with PUBLIC EXECUTE by
-- default, so revoking from anon/authenticated alone leaves both roles holding
-- it by inheritance. Getting this wrong here is what the grant check caught.
revoke execute on function public.prevent_position_change() from anon, authenticated, public;
