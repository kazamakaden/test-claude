-- Self-issued password-setup / password-reset links (replaces Supabase Auth's
-- own recovery email).
--
-- WHY THIS EXISTS
-- ---------------
-- Every emailed-link path in this project has depended on Supabase's mailer,
-- and that dependency has been the single most fragile thing here: the
-- built-in sender caps out around two messages an hour
-- (429 over_email_send_rate_limit), custom SMTP through Resend was cleared by
-- the dashboard when it was toggled off and its domain never finished DNS
-- verification, and -- the part no configuration fixes -- this project enables
-- Supabase's project-level CAPTCHA, so a server-initiated
-- resetPasswordForEmail() is refused outright with
-- "captcha protection: request disallowed".
--
-- So the app mints its own link and sends its own mail. The token lives here.
--
-- WHAT IS STORED, AND WHAT IS NOT
-- -------------------------------
-- Only sha256(token), as lowercase hex. The raw token exists in exactly two
-- places: the email, and (briefly) an httpOnly cookie. A database leak
-- therefore yields hashes, not working links -- the same reasoning that keeps
-- `qr_sessions.secret` unreadable in 0056, applied to a value we cannot avoid
-- handing to a user.
--
-- The raw token is 32 bytes from a CSPRNG, so it is not brute-forceable and
-- needs no per-token salt or slow KDF: a single sha256 is the right primitive
-- for a high-entropy secret, unlike a human-chosen password.
--
-- `text` rather than `bytea`, deliberately. The value is compared by the
-- PostgREST client, and bytea travels over that boundary as a backslash-x
-- escape string whose round-trip depends on URL escaping behaving exactly
-- right in both directions. Hex text has no escape path to get wrong, indexes
-- and compares identically, and the CHECK below makes a malformed write
-- impossible rather than merely unlikely.
create table public.password_setup_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  token_hash  text not null unique
                check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Serves both lookups: the throttle counts a user's recent mints, and
-- "invalidate this user's outstanding tokens" scans the same prefix.
create index password_setup_tokens_user_idx
  on public.password_setup_tokens (user_id, created_at desc);

alter table public.password_setup_tokens enable row level security;

-- No policies and no grants, deliberately -- the qr_scan_attempts (0056)
-- shape. Only the service-role client touches this table, and RLS is not the
-- boundary that matters for it: a caller who could INSERT here could mint a
-- link for anybody, and a caller who could SELECT here could not use what it
-- read (hashes only) but could see who has an outstanding reset. Neither is a
-- capability any client needs.
--
-- RLS is still enabled rather than left off: with no policies it fails closed,
-- so a future migration that grants SELECT on this table by accident (the way
-- Supabase's defaults granted UPDATE on activities.created_by until 0061
-- revoked it) still returns zero rows instead of the whole table.
revoke all on public.password_setup_tokens from anon, authenticated;
