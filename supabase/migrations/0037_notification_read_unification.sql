-- Read state unifies on notification_reads (0036), for targeted *and*
-- broadcast rows.
--
-- Why the `read` boolean has to go rather than coexist with the join table:
-- notifications_update_own_read (0008) is `recipient_id = auth.uid()`, and a
-- broadcast row has recipient_id null — so today no user can mark a broadcast
-- notification read at all. Widening that policy to cover broadcasts would be
-- worse, not better: the row is shared by everyone, so one user marking it
-- read would mark it read for all of them. Per-(notification, user) is the
-- only shape that works for both kinds of row.
--
-- Dropping the UPDATE policy is a bonus: with read state in its own table,
-- users need no UPDATE privilege on notifications at all.

drop policy if exists "notifications_update_own_read" on public.notifications;

alter table public.notifications drop column read;

-- IMPORTANT — why these two functions filter on recipient_id explicitly
-- instead of leaning on RLS to scope the rows:
-- notifications_all_admin (0008) grants an admin ALL/USING (current_role() =
-- 'admin'), which is permissive and OR's with the own-or-broadcast policy. So
-- for an admin, RLS alone matches *every* row in the table — including other
-- users' private targeted notifications. RLS is the security floor here, not
-- the definition of "my notifications"; the app-level meaning is always
-- "addressed to me, or broadcast", so it is spelled out in the query.

-- security invoker (not definer), matching get_activity_stats() /
-- get_member_stats() (0009): the caller's own RLS is exactly the ceiling we
-- want, and there is no privilege to escalate here.
create function public.get_unread_notification_count()
returns integer
language sql
security invoker
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications n
  where auth.uid() is not null
    and (n.recipient_id = auth.uid() or n.recipient_id is null)
    and not exists (
      select 1
      from public.notification_reads r
      where r.notification_id = n.id
        and r.user_id = auth.uid()
    );
$$;

-- `insert ... select` cannot be expressed through PostgREST, so "mark all
-- read" needs an RPC rather than a client-built statement. security invoker
-- again: every inserted row is still checked by notification_reads_insert_own
-- (0036), so this can only ever write read-marks for the caller.
create function public.mark_all_notifications_read()
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.notification_reads (notification_id, user_id)
  select n.id, auth.uid()
  from public.notifications n
  where auth.uid() is not null
    and (n.recipient_id = auth.uid() or n.recipient_id is null)
  on conflict (notification_id, user_id) do nothing;
$$;

-- Grants pinned down in the same migration that creates the functions.
-- CLAUDE.md records this project being bitten twice (0011 → 0012) by function
-- grants silently reverting to PUBLIC EXECUTE.
revoke execute on function public.get_unread_notification_count() from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.get_unread_notification_count() to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
