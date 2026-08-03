-- §1 asks that อาจารย์ อวท. (aft_teacher) can approve pending students, not
-- just admin. Today only profiles_update_admin (0002) grants that UPDATE.

create policy "profiles_update_aft_teacher"
  on public.profiles for update to authenticated
  using  (public.current_role() = 'aft_teacher')
  with check (public.current_role() = 'aft_teacher');

-- Rewrites prevent_role_self_escalation (0002) to allow an aft_teacher to
-- change someone else's role, while still enforcing three things a plain
-- RLS policy's WITH CHECK cannot express on its own (it only ever sees the
-- NEW row, never who the actor is changing vs. who they are):
--   1. nobody changes their own role, admin included — only a trigger can
--      compare auth.uid() to the row being changed
--   2. minting or demoting an admin stays admin-only
--   3. granting aft_teacher stays admin-only, so one compromised
--      aft_teacher session cannot mint unlimited peers
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.user_role;
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- No JWT = service role / migration / SQL console, not a user-initiated
  -- request. Same carve-out 0018 added to the transition triggers, and for
  -- the same reason: this guard exists to constrain what a *user* may do.
  if auth.uid() is null then
    return new;
  end if;

  if new.id = auth.uid() then
    raise exception 'cannot change your own role';
  end if;

  actor := public.current_role();

  if new.role = 'admin' or old.role = 'admin' then
    if actor <> 'admin' then
      raise exception 'insufficient privilege to change role';
    end if;
    return new;
  end if;

  if new.role = 'aft_teacher' and actor <> 'admin' then
    raise exception 'insufficient privilege to grant aft_teacher';
  end if;

  if actor in ('admin', 'aft_teacher') then
    return new;
  end if;

  raise exception 'insufficient privilege to change role';
end;
$$;

-- MANDATORY after create-or-replace (0011 -> 0012's lesson, repeated at
-- every trigger-only function replace since).
revoke execute on function public.prevent_role_self_escalation() from public, anon, authenticated;

-- Repairs 0006: it revoked EXECUTE from anon/authenticated explicitly but
-- NOT from PUBLIC, and both roles inherit EXECUTE through PUBLIC — so 0006
-- was a no-op for these three. Confirmed live via pg_proc.proacl showing a
-- bare "=X/postgres" entry (PUBLIC EXECUTE) on all three before this
-- migration. handle_new_user was already correctly locked (0011/0012/0020
-- all revoked "from public" explicitly); these three never got that.
revoke execute on function public.set_updated_at()            from public, anon, authenticated;
revoke execute on function public.prevent_citizen_id_change() from public, anon, authenticated;

-- 0016 created sign_document with the PostgreSQL default (PUBLIC EXECUTE)
-- and only explicitly GRANTed to authenticated — it was never revoked from
-- anon/public. SECURITY INVOKER means an anon call fails harmlessly
-- ("document not signable", since auth.uid() is null), but it should not be
-- reachable at all.
revoke execute on function public.sign_document(uuid, text) from public, anon;
