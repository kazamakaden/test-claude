-- RLS for the §9 Members directory. Guests (anon) get nothing — the
-- directory is not §6 "official public content".

alter table public.departments enable row level security;
alter table public.clubs enable row level security;

create policy "departments_select_authenticated"
  on public.departments for select
  to authenticated
  using (true);

create policy "clubs_select_authenticated"
  on public.clubs for select
  to authenticated
  using (true);

-- A member directory needs every signed-in user to read OTHER people's rows,
-- not just their own — profiles_select_own (0002) doesn't cover this.
create policy "profiles_select_directory"
  on public.profiles for select
  to authenticated
  using (true);

-- Row policies can't hide a single column. citizen_id is sensitive (§15) and
-- must stay admin-only even though every signed-in user shares the
-- "authenticated" Postgres role — a column revoke here would lock admins out
-- too, so admin access goes through get_citizen_id() instead.
revoke select (citizen_id) on public.profiles from authenticated, anon;

create function public.get_citizen_id(member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  if public.current_role() <> 'admin' then
    raise exception 'insufficient privilege to read citizen_id';
  end if;

  select citizen_id into result from public.profiles where id = member_id;
  return result;
end;
$$;
