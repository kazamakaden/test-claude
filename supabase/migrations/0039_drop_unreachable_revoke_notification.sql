-- 0036's notify_member_role_change() wrote an `accountRevoked` notification to
-- the user whose role had just become `pending`. That recipient can never read
-- it, by construction:
--
--   * `pending` holds guestPermissions only (lib/auth/permissions.ts), so it
--     lacks `notification:read` — the bell is not rendered for them; and
--   * every route under app/[lang]/(app) requires `workspace:access`, which
--     `pending` also lacks, so /notifications redirects them to /pending.
--
-- So the row was unreachable by its only recipient. Worse, it does not stay
-- invisible: if that person is later re-approved they regain notification:read
-- and the stale "your access has been suspended" message surfaces in their
-- history *after* access was restored — actively misleading rather than merely
-- useless.
--
-- The /pending page is what actually tells a revoked user their status, and it
-- is reachable. An admin-side record of the revocation belongs in `audit_logs`
-- (§20, still deferred), not in a user-facing inbox.
--
-- `accountApproved` is kept: crossing pending -> a real member role restores
-- notification:read, so that one is genuinely readable by its recipient.

create or replace function public.notify_member_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if old.role = 'pending' and new.role <> 'pending' then
    insert into public.notifications (recipient_id, type, title, message_key, message_params, link)
    values (new.id, 'approval', coalesce(new.full_name, new.email),
            'accountApproved', jsonb_build_object('role', new.role::text), '/dashboard');
  end if;

  return new;
end;
$$;

-- `create or replace` resets grants to the PostgreSQL default (PUBLIC EXECUTE),
-- silently undoing 0036's revoke. This project has already been bitten by
-- exactly that twice (0011 -> 0012), so the re-revoke lives in the same
-- migration as the replace rather than a follow-up.
revoke execute on function public.notify_member_role_change() from anon, authenticated, public;
