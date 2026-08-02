-- RLS for public.profiles. No exceptions per §19/§20 — every table gets RLS
-- the moment it exists.

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.current_role() = 'admin');

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- profiles_update_own alone would let a student set role = 'admin' on their
-- own row (RLS's WITH CHECK only validates the NEW row, not OLD vs NEW).
-- A trigger is the correct enforcement point for "this column may not change
-- unless the caller is already an admin".
create function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> old.role and public.current_role() <> 'admin' then
    raise exception 'insufficient privilege to change role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();
