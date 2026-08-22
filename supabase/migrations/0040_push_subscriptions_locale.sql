-- Web push sending, part 1: remember which language each subscription wants.
--
-- A notification row stores `message_key` + `message_params` rather than
-- prose (0036) precisely because the writer cannot know the reader's locale.
-- The in-app UI resolves that at render time from the reader's own `[lang]`
-- segment. A push has no reader present: it is composed on the server, by a
-- background dispatch triggered from a database INSERT, long after the user
-- navigated away. So the language has to have been captured earlier — at
-- subscribe time, which is the last moment we know it.
--
-- Default 'th' matches the app's default locale (§30.3) and covers the rows
-- that already exist, which were created before this column did.
alter table public.push_subscriptions
  add column locale text not null default 'th'
    check (locale in ('th', 'en'));

comment on column public.push_subscriptions.locale is
  'Language to compose pushes to this subscription in. Set from the [lang] '
  'segment the user was on when they subscribed, server-side — never from '
  'client-supplied input. One user with two browsers may legitimately hold '
  'two subscriptions with different locales.';

-- No grant change needed, unlike 0030's `password_set` on `profiles`.
-- That table carries an explicit column-level allow-list (0005 revoked the
-- table-level SELECT and re-granted per column), so a new column there is
-- invisible until named. `push_subscriptions` never had that treatment: it
-- was created in 0033 with the ordinary table-level grants and is protected
-- purely by owner-scoped RLS (0034), so a new column inherits that. Checked
-- against information_schema rather than assumed — see this migration's
-- verification notes in the accompanying commit.
