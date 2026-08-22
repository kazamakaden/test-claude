-- Activity ownership and co-editors (a new authorization axis), plus the
-- column-grant lockdown that makes it safe.
--
-- Until now `activities` had an owner column (`created_by`, 0007) that NO policy
-- ever referenced, so any aft/teacher could edit any other teacher's activity and
-- only `admin` could delete anything -- the latter being a visible bug, since
-- calendar-day-sheet.tsx renders a Delete button for anyone holding
-- `activity:manage`, whose delete then failed with a generic "unknown" toast.
--
-- THE LOAD-BEARING PART OF THIS FILE IS THE COLUMN GRANT, NOT THE POLICY.
-- Verified live before writing this: `authenticated` (and `anon`) held UPDATE on
-- EVERY column of public.activities, including `created_by` and `id` -- Supabase's
-- default table grants, never revoked here the way 0055 revoked them for
-- `attendance` and 0005 for `profiles.citizen_id`. A co-editor could therefore run
--     update public.activities set created_by = <self> where id = <activity>
-- and become the owner. RLS cannot prevent this: WITH CHECK only ever sees the NEW
-- row, never OLD, so no policy can say "created_by must not change". A column-level
-- allow-list is the only mechanism that can.
--
-- Corollary, stated so nobody tries to solve it with a policy later: column grants
-- are per-ROLE and `authenticated` is one shared role, so "the owner may transfer
-- ownership but a co-editor may not" is INEXPRESSIBLE in RLS. Nobody writes
-- created_by over REST. If ownership transfer is ever wanted it must be its own
-- SECURITY DEFINER RPC.

-- ---------------------------------------------------------------------
-- Expected attendance, so the event dashboard's percentage has a denominator

-- `attendance` rows exist only for people who checked in, so checked-in/total is
-- always 100% and there is no enrolment table anywhere in the schema to divide by.
-- The owner states the expected headcount; the dashboard reports against it.
alter table public.activities
  add column if not exists expected_attendees integer
    check (expected_attendees is null or expected_attendees between 1 and 100000);

comment on column public.activities.expected_attendees is
  'Owner-stated expected headcount, the denominator for the event attendance %. Null = do not show a percentage.';

-- ---------------------------------------------------------------------
-- Co-editors

create table if not exists public.activity_editors (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id     uuid not null references public.profiles (id)   on delete cascade,
  granted_by  uuid          references public.profiles (id)   on delete set null,
  created_at  timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index if not exists activity_editors_user_idx on public.activity_editors (user_id);

comment on table public.activity_editors is
  'Per-row delegated edit rights on an activity. Granting is owner/admin only -- a co-editor may NOT delegate further (see activity_editors_insert_owner).';

alter table public.activity_editors enable row level security;

-- ---------------------------------------------------------------------
-- Predicates
--
-- TWO functions, deliberately, and the split is not stylistic.
--
-- is_activity_editor() reads ONLY activity_editors and is what the `activities`
-- policies call. A single helper that also read public.activities would be called
-- from inside an activities policy while itself selecting activities: that avoids
-- `infinite recursion detected in policy` only because this function's owner owns
-- the table and table owners bypass RLS. That is an unstated invariant which a
-- future one-line `alter table public.activities force row level security` would
-- break -- and it would break every select on activities, app-wide. The activities
-- policies therefore test `created_by` INLINE (the row is already in scope, so it
-- is also cheaper) and call this only for the delegation half.
--
-- can_edit_activity() is the application-facing single predicate, for callers that
-- do NOT have the activities row in scope: the manual-attendance RPC (0062) and the
-- storage policies (0063).

create or replace function public.is_activity_editor(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activity_editors e
    where e.activity_id = p_activity_id
      and e.user_id = ( select auth.uid() )
  );
$$;

create or replace function public.can_edit_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           ( select a.created_by = ( select auth.uid() )
             from public.activities a
             where a.id = p_activity_id ),
           false)
      or public.is_activity_editor(p_activity_id)
      or ( select public.current_role() ) = 'admin'::public.user_role;
$$;

-- The 0011 -> 0012 trap: `create or replace` resets a function's grants to
-- PUBLIC EXECUTE. Any future file that replaces either function must repeat these.
revoke execute on function public.is_activity_editor(uuid) from anon, public;
revoke execute on function public.can_edit_activity(uuid)  from anon, public;
grant  execute on function public.is_activity_editor(uuid) to authenticated;
grant  execute on function public.can_edit_activity(uuid)  to authenticated;

-- ---------------------------------------------------------------------
-- activity_editors RLS
--
-- INSERT tests `a.created_by` DIRECTLY rather than calling can_edit_activity().
-- Using the helper here would be the escalation bug: a co-editor could then add
-- further co-editors, or hand the grant to an accomplice.

create policy "activity_editors_insert_owner"
  on public.activity_editors for insert
  to authenticated
  with check (
    granted_by = ( select auth.uid() )          -- the trail cannot be forged
    and exists (
      select 1 from public.activities a
      where a.id = activity_id
        and ( a.created_by = ( select auth.uid() )
              or ( select public.current_role() ) = 'admin'::public.user_role )
    )
  );

create policy "activity_editors_delete_owner"
  on public.activity_editors for delete
  to authenticated
  using (
    exists (
      select 1 from public.activities a
      where a.id = activity_id
        and ( a.created_by = ( select auth.uid() )
              or ( select public.current_role() ) = 'admin'::public.user_role )
    )
    or user_id = ( select auth.uid() )          -- anyone may resign their own grant
  );

create policy "activity_editors_select"
  on public.activity_editors for select
  to authenticated
  using (
    user_id = ( select auth.uid() )
    or exists (
      select 1 from public.activities a
      where a.id = activity_id
        and ( a.created_by = ( select auth.uid() )
              or ( select public.current_role() ) = 'admin'::public.user_role )
    )
  );

-- No UPDATE policy and no UPDATE grant: a grant row is add/remove only. Allowing
-- UPDATE would let a row be re-pointed at a different user_id, which is the same
-- escalation the INSERT policy exists to stop.
revoke all on public.activity_editors from authenticated, anon;
grant select (activity_id, user_id, granted_by, created_at) on public.activity_editors to authenticated;
grant insert (activity_id, user_id, granted_by)             on public.activity_editors to authenticated;
grant delete on public.activity_editors to authenticated;

-- These policies read public.activities as the INVOKER (RLS applies), while the
-- activities policies reach activity_editors only through the DEFINER helper above.
-- That one-directional shape is what keeps the two tables from forming a policy
-- cycle. Do not "simplify" is_activity_editor() to security invoker.

-- ---------------------------------------------------------------------
-- A co-editor must be staff
--
-- Not cosmetic: attendance_select_reviewer (0008/0049) is staff-only and
-- qr_sessions_select_staff likewise, so a non-staff co-editor would see an empty
-- attendee table and could not open a QR session -- a half-working grant that
-- reads as a bug. Enforced here rather than in the picker UI so it holds over REST.

create or replace function public.activity_editors_require_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(
       ( select p.role from public.profiles p where p.id = new.user_id )
         = any (array['aft','teacher','admin']::public.user_role[]),
       false) then
    raise exception 'a co-editor must hold a staff role' using errcode = '42501';
  end if;

  if new.user_id = ( select a.created_by from public.activities a where a.id = new.activity_id ) then
    raise exception 'the owner already has edit rights' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.activity_editors_require_staff() from anon, authenticated, public;

drop trigger if exists activity_editors_require_staff on public.activity_editors;
create trigger activity_editors_require_staff
  before insert on public.activity_editors
  for each row execute function public.activity_editors_require_staff();

-- ---------------------------------------------------------------------
-- Re-point the activities policies
--
-- `alter policy`, never drop+create: if a new UPDATE policy were added while
-- activities_update_staff still existed, permissive policies OR together and the
-- old "any staff edits anything" rule would still hold -- the whole feature would
-- be cosmetic while appearing to work.

alter policy activities_update_staff on public.activities
  using (
        created_by = ( select auth.uid() )
     or public.is_activity_editor(id)
     or ( select public.current_role() ) = 'admin'::public.user_role
  )
  with check (
        created_by = ( select auth.uid() )
     or public.is_activity_editor(id)
     or ( select public.current_role() ) = 'admin'::public.user_role
  );

alter policy activities_update_staff on public.activities rename to activities_update_editor;

-- INSERT must pin created_by, or a staff member can plant an activity owned by
-- somebody else -- an ownership-planting primitive that only matters now that
-- ownership confers authority.
alter policy activities_write_staff on public.activities
  with check (
    created_by = ( select auth.uid() )
    and ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

-- DELETE: owner and admin ONLY -- deliberately NOT co-editors.
-- public.attendance.activity_id is ON DELETE CASCADE (verified), so deleting an
-- activity destroys its entire attendance record, and a cascade bypasses both RLS
-- and the fact that DELETE has never been granted on `attendance` to anyone. A
-- co-editor with this would hold a one-click, unrecoverable wipe of verified
-- check-ins. This still fixes the reported Delete-button bug for the owner.
create policy "activities_delete_owner"
  on public.activities for delete
  to authenticated
  using (
        created_by = ( select auth.uid() )
     or ( select public.current_role() ) = 'admin'::public.user_role
  );

-- ---------------------------------------------------------------------
-- THE COLUMN LOCKDOWN (see this file's header)
--
-- Table-level revoke FIRST: a column-level revoke cannot narrow a table-level
-- grant -- that was 0005's finding, confirmed live back then by reading
-- citizen_id in plain text through a revoke that had done nothing.

revoke insert, update, references on public.activities from authenticated, anon;

-- Excluded from UPDATE: id, created_by, created_at, updated_at.
grant update (title, description, department_id, club_id, academic_year, status,
              starts_at, ends_at, location, is_public, expected_attendees)
  on public.activities to authenticated;

-- created_by IS insertable -- services/activities.ts#createActivity passes it --
-- but activities_write_staff above pins it to auth.uid(), so it can only ever be
-- set to yourself. id stays out: the default is fine and a caller-chosen primary
-- key is a needless collision surface.
grant insert (title, description, department_id, club_id, academic_year, status,
              starts_at, ends_at, location, is_public, expected_attendees, created_by)
  on public.activities to authenticated;

-- Defence in depth for any future writer that forgets to pass it.
alter table public.activities alter column created_by set default auth.uid();
