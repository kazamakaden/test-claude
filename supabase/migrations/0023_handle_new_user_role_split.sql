-- 0022's profiles_avatar_url_is_https CHECK used a bounded regex repetition
-- {1,2000}, which exceeds PostgreSQL's regex engine repetition-count limit
-- ("invalid regular expression: invalid repetition count(s)") — caught here
-- because this migration is the first thing that ever writes a non-null
-- avatar_url, which is when the CHECK actually gets evaluated (it was a
-- silent no-op on 0022's own ALTER TABLE, since every existing row was
-- NULL and CHECK short-circuits on NULL). Fixed forward: drop and recreate
-- without a bounded repetition, using char_length for the size cap instead.
alter table public.profiles drop constraint profiles_avatar_url_is_https;
alter table public.profiles
  add constraint profiles_avatar_url_is_https
  check (avatar_url is null or (avatar_url ~ '^https://\S+$' and char_length(avatar_url) <= 2000));

-- Supersedes 0020's "every signup lands pending regardless of address
-- shape". Splits by local-part per §14/§19:
--   numeric local part (student id)  -> role 'pending', needs approval
--   named local part (staff address) -> role 'teacher' immediately
--
-- The @udontech.ac.th domain rule is still enforced only by profiles.email's
-- CHECK (0001), not here — that constraint is what actually protects the
-- Google OAuth path, since OAuth never touches signIn's Zod checks.
--
-- full_name/avatar_url are copied from Google's identity data, gated on the
-- account having a linked Google identity — checked via
-- raw_app_meta_data->'providers', NOT raw_app_meta_data->>'provider'.
-- Verified live against a real linked account (69319010015@udontech.ac.th,
-- password-first signup + later Google link): raw_app_meta_data.provider
-- stays 'email' (the ORIGINAL signup method) even after linking, while
-- raw_app_meta_data.providers becomes ["email","google"] and
-- raw_user_meta_data gains Google's full_name/avatar_url/picture. Gating on
-- ->>'provider' alone would have silently skipped exactly this account.
--
-- raw_user_meta_data is otherwise client-writable via
-- signUp({ options: { data } }) — trusting it unconditionally would let
-- anyone display a fabricated name in the public member directory, or
-- plant a javascript:/data: URL that lands in an <img src>. Restricting the
-- copy to accounts with a real linked Google identity, plus the CHECK
-- above, closes both.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_part  text := split_part(new.email, '@', 1);
  is_student  boolean := local_part ~ '^[0-9]{11,}$';
  from_google boolean := coalesce(new.raw_app_meta_data -> 'providers' ? 'google', false);
begin
  insert into public.profiles (id, email, role, student_id, full_name, avatar_url)
  values (
    new.id,
    new.email,
    case when is_student then 'pending'::public.user_role
                          else 'teacher'::public.user_role end,
    case when is_student then local_part else null end,
    case when from_google
      then left(coalesce(new.raw_user_meta_data ->> 'full_name',
                          new.raw_user_meta_data ->> 'name'), 100)
      else null end,
    case when from_google
         and coalesce(new.raw_user_meta_data ->> 'avatar_url',
                       new.raw_user_meta_data ->> 'picture') ~ '^https://'
      then coalesce(new.raw_user_meta_data ->> 'avatar_url',
                     new.raw_user_meta_data ->> 'picture')
      else null end
  );
  return new;
end;
$$;

-- MANDATORY: create or replace resets grants to PostgreSQL's PUBLIC EXECUTE
-- default. This exact bug already shipped once (0011, repaired by 0012) and
-- again would have shipped a second time here without this line.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- One-time backfill of the 5 existing rows, same google-linked gate as the
-- trigger above, so a pre-existing password-only signup can't have stray
-- client-supplied metadata copied in. Confirmed live before running: only
-- 69319010015@udontech.ac.th (the one real linked Google account) has any
-- full_name/avatar_url in raw_user_meta_data at all — the four demo
-- accounts' raw_user_meta_data carries neither key, so this is a no-op for
-- them regardless of the gate. Deliberately does NOT touch student_id: the
-- admin row has it NULL today, and setting it would populate the generated
-- academic_year and list an admin among year-69 students.
update public.profiles p
   set full_name  = coalesce(
                       p.full_name,
                       case when coalesce(u.raw_app_meta_data -> 'providers' ? 'google', false)
                            then coalesce(u.raw_user_meta_data ->> 'full_name',
                                          u.raw_user_meta_data ->> 'name')
                            else null end
                     ),
       avatar_url = coalesce(
                       p.avatar_url,
                       case when coalesce(u.raw_app_meta_data -> 'providers' ? 'google', false)
                                 and coalesce(u.raw_user_meta_data ->> 'avatar_url',
                                              u.raw_user_meta_data ->> 'picture') ~ '^https://'
                            then coalesce(u.raw_user_meta_data ->> 'avatar_url',
                                          u.raw_user_meta_data ->> 'picture')
                            else null end
                     )
  from auth.users u
 where u.id = p.id
   and (p.full_name is null or p.avatar_url is null);
