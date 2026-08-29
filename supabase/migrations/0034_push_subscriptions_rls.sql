-- push_subscriptions RLS. No anon path exists or should: subscribing
-- requires a signed-in user.
alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

-- `to authenticated` alone is not enough: a `pending` signup holds a valid
-- JWT but no workspace access — same reasoning as books_insert_own (0028).
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_role() in ('student', 'teacher', 'aft_teacher', 'admin')
  );

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- Deliberately no staff/admin read policy. Nobody needs to read someone
-- else's endpoints in this phase, and the future send pipeline will run on
-- the service-role client (lib/supabase/admin.ts), which bypasses RLS
-- anyway — an admin policy here would only widen exposure for zero
-- functional gain.
