-- Listing "my notifications" with a working unread filter.
--
-- Why this is an RPC rather than a PostgREST query: read state lives in
-- notification_reads (0037), so "unread" means "no related row exists" —
-- expressible in PostgREST only via the embedded-resource absence filter
-- (`notification_reads=is.null`), whose exact behaviour varies by PostgREST
-- version and could not be verified against this project from the session
-- that wrote it. A plain left join in SQL has none of that ambiguity, is
-- verifiable with a direct query, and returns the page and its total count
-- in one round trip instead of two.
--
-- Same explicit recipient scoping as 0037's two functions, for the same
-- reason: notifications_all_admin (0008) matches every row for an admin, so
-- relying on RLS alone to define "mine" would show an admin everyone else's
-- private notifications. RLS stays the security floor; this is the app-level
-- meaning.
create function public.list_notifications(
  p_unread_only boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  type public.notification_type,
  title text,
  message_key text,
  message_params jsonb,
  link text,
  created_at timestamptz,
  read boolean,
  total_count bigint
)
language sql
security invoker
stable
set search_path = ''
as $$
  with visible as (
    select
      n.id,
      n.type,
      n.title,
      n.message_key,
      n.message_params,
      n.link,
      n.created_at,
      (r.notification_id is not null) as is_read
    from public.notifications n
    -- r.user_id is pinned to the caller as well as being RLS-restricted to
    -- them: without the join condition this would mark a broadcast read for
    -- everyone as soon as any one user read it.
    left join public.notification_reads r
      on r.notification_id = n.id
     and r.user_id = auth.uid()
    where auth.uid() is not null
      and (n.recipient_id = auth.uid() or n.recipient_id is null)
  ),
  filtered as (
    select * from visible v
    where not p_unread_only or not v.is_read
  )
  select
    f.id,
    f.type,
    f.title,
    f.message_key,
    f.message_params,
    f.link,
    f.created_at,
    f.is_read,
    (select count(*) from filtered) as total_count
  from filtered f
  order by f.created_at desc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.list_notifications(boolean, integer, integer) from public, anon;
grant execute on function public.list_notifications(boolean, integer, integer) to authenticated;
