-- Login switched to Google-only, with a new post-OAuth "set a password"
-- step (a real password, usable via /forgot-password later — see
-- actions/auth.ts's updatePassword). This column is what
-- app/[lang]/auth/callback/route.ts checks to decide whether a signed-in
-- Google user still needs to be sent through that step.
alter table public.profiles
  add column password_set boolean not null default false;

-- 0005 revoked the table-level SELECT grant on profiles and re-granted an
-- explicit column allow-list — a new column is unreadable by
-- `authenticated` until named here, same trap that column hit before.
grant select (password_set) on public.profiles to authenticated;

-- Backfill: anyone who already has a real password (the pre-Google-only
-- password sign-up/reset flow this replaces) shouldn't be routed through
-- the new set-password step on their next sign-in.
update public.profiles p
   set password_set = true
  from auth.users u
 where u.id = p.id
   and coalesce(u.encrypted_password, '') <> '';

-- Accepted limitation: profiles_update_own (0002) lets a user set this
-- column on their own row like any other self-editable field, so a
-- determined user could flip it to skip the step. That only costs them
-- their own password and grants no privilege — a UX gate, not a security
-- boundary — so no additional trigger is added to lock it, consistent with
-- how full_name/avatar_url are already handled (0025's header).
