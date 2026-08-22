-- Google OAuth supplies a profile photo (user_metadata.avatar_url /
-- .picture) that nothing in this app has ever stored or displayed. Adding
-- it so the top nav can show it (§4 of the current work item).
alter table public.profiles add column avatar_url text;

-- raw_user_meta_data is client-writable via signUp({ options: { data } }),
-- so this column can carry attacker-controlled content on the
-- email/password path (0023 restricts the actual copy to accounts with a
-- linked Google identity, but the column itself has no way to know who
-- wrote it later via profiles_update_own). A basic scheme guard stops it
-- from ever holding a javascript:/data: URL that could land in an
-- <img src>.
--
-- NOTE: this CHECK's regex ('^https://[^\s]{1,2000}$') turned out to be
-- invalid — PostgreSQL's regex engine rejects a bounded repetition count
-- this large ("invalid regular expression: invalid repetition count(s)").
-- It was a silent no-op on this ALTER TABLE (every existing row was NULL,
-- and CHECK short-circuits on NULL), so it applied without error here, but
-- broke the moment 0023's backfill tried to write a real value. Fixed
-- forward in 0023 — see that file's header. Left exactly as originally
-- applied here rather than edited, per this project's established
-- "migrations are immutable once applied, fix forward" convention (the
-- same discipline 0006 -> 0012 and 0011 -> 0012 already established).
alter table public.profiles
  add constraint profiles_avatar_url_is_https
  check (avatar_url is null or avatar_url ~ '^https://[^\s]{1,2000}$');

-- 0005 revoked the table-level SELECT grant on profiles and re-granted an
-- explicit column allow-list instead — a new column is UNREADABLE by
-- `authenticated` until it is named here. Without this grant,
-- services/members.ts silently renders blank names for every Google user
-- rather than throwing, because getMembers() swallows query errors.
grant select (avatar_url) on public.profiles to authenticated;
