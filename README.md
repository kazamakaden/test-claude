# AFT UDONTECH Dashboard

Dashboard for องค์การนักวิชาชีพในอนาคตแห่งประเทศไทย (อวท.) — Udon Thani Technical College.

## Requirements

- Node.js 20+
- npm

## Run locally

```bash
npm install
npm run dev
```

The app runs at **http://localhost:59500**.

> The port is fixed in `package.json` (`next dev --turbopack -p 59500`). Change the `-p` flag there if you need a different port.

## Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (public) key |
| `SUPABASE_SECRET_KEY` | Secret key — bypasses RLS, server-side only, never expose to the client |
| `SUPABASE_URL` | Same project URL, unprefixed — read by `@supabase/server` (Edge Functions) |
| `SUPABASE_PUBLISHABLE_KEY` | Same publishable key, unprefixed — read by `@supabase/server` |
| `SUPABASE_JWKS_URL` | `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` — read by `@supabase/server` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile sitekey (public by design). Login form renders no CAPTCHA widget at all when unset — see "CAPTCHA + SMTP setup" below |

Until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set, sign-in falls back to a dev-only role cookie (the switcher in the bottom-right corner, development mode only). The moment both are set, that switcher disappears and local dev requires a real magic-link sign-in — see "Auth setup" below.

**`NEXT_PUBLIC_*` variables are baked into the client bundle at build time.** They must be present before `npm run build`, not just before `npm run start` — the most common deploy failure with this app.

The dashboard (`/dashboard`) reads real data via `services/dashboard.ts` — the 6 §20 tables it queries (`activities`, `attendance`, `projects`, `documents`, `document_drafts`, `notifications`) are live. `lib/dev-fixtures.ts` no longer exists.

## Database migrations

Once you've created a Supabase project, apply the SQL migrations in `supabase/migrations/` **in order** (via the Supabase CLI, the SQL editor, or the Supabase MCP plugin), then apply `supabase/seed.sql`, then regenerate types:

```bash
supabase db push
supabase db execute -f supabase/seed.sql
supabase gen types typescript --linked > types/database.ts
```

`supabase/migrations/` currently covers the auth-critical subset of the §20
schema (`profiles`, role enum, RLS), the §9 Members module (`departments`,
`clubs`, student-ID fields), and the 6 dashboard tables (`activities`,
`attendance`, `projects`, `documents`, `document_drafts`, `notifications`,
plus the `get_activity_stats()`/`get_member_stats()` RPCs). `project_drafts`,
`qr_sessions`, `signature_records`, `audit_logs` land with their own §30.10
phases (Projects, QR attendance, Documents).

**`citizen_id` column security:** `0004_members_rls.sql` revokes column-level
`SELECT` on `profiles.citizen_id`, but Supabase grants table-level `SELECT` to
`authenticated` on every new table by default — and PostgreSQL does not let a
column-level revoke narrow a table-level grant. `0005_citizen_id_column_grants.sql`
closes that gap by revoking the table-level grant and re-granting an explicit
column allow-list (confirmed live against `hmkciwgzbdszsgnbeakc` — see
`CLAUDE.md` §0 for the full test matrix). Any new sensitive column added to
`profiles` later must be added to that allow-list explicitly, or it becomes
unreadable by `authenticated` entirely (fail-closed by design) rather than
accidentally exposed.

`0006_lock_trigger_only_functions.sql` revokes direct `EXECUTE` on four
functions that exist only to run as triggers (`handle_new_user`,
`set_updated_at`, `prevent_role_self_escalation`, `prevent_citizen_id_change`)
— Supabase's security advisor flags trigger functions left publicly callable
via `/rest/v1/rpc/<name>`.

**`attendance` column security:** same shape as `citizen_id` above.
`attendance` carries §15 sensitive fields (GPS, IP, device fingerprint);
`0008_dashboard_rls.sql` revokes the table-level `SELECT` grant and re-grants
an explicit column allow-list excluding them. `get_activity_stats()` and
`get_member_stats()` (`0009_dashboard_stat_rpcs.sql`) are `SECURITY INVOKER`
— they run with the caller's own RLS-scoped permissions, not elevated ones.

**The role split (`0010`/`0011`) and the §14 student-ID allow-list:**
`user_role` gained a fourth value, `aft_teacher` (อาจารย์ อวท. — the AFT
advisor teacher), added in its own migration (`0010`) because PostgreSQL
forbids using a new enum value in the same transaction it was added in.
`0011_account_approvals.sql` adds `approved_accounts` (admin-only RLS, a
roster of who may sign up — not app data) and rewrites `handle_new_user()`
to be the actual enforcement point for the rule below. It also extends every
`0008` reviewer policy to include `aft_teacher` and adds new approve-level
policies (`projects`/`documents` UPDATE, `activities` INSERT/UPDATE) for it.
`0012` re-locks `handle_new_user()`'s `EXECUTE` grant, which `0011`'s
`create or replace function` silently reset to the PostgreSQL default —
confirmed live via `information_schema.role_routine_grants` immediately
after applying `0011`, and worth knowing if you ever `CREATE OR REPLACE` a
function that `0006` locked down: the revoke does not survive the replace.

## Sign-up rule: numeric student-ID emails need admin approval

An `@udontech.ac.th` address whose local part is **all digits** (§14 student
ID, e.g. `69319010015@udontech.ac.th`) must be pre-approved by an admin —
add it via `/approvals` (admin-only, gated on `member:manage`) before that
person can request a magic link at all. A **named** staff address
(`somchai.j@udontech.ac.th`) signs up freely and lands as `teacher`.

This is enforced in `handle_new_user()`, not in the Server Action — §19
forbids trusting an app-layer check alone. Rejection surfaces from
`signInWithOtp` itself (the OTP request creates the `auth.users` row
immediately, which is when the trigger fires) as a Postgres exception
containing `"account not approved"`; `actions/auth.ts` matches on that string
to show a friendlier message than the generic send-failure one.

## CAPTCHA + SMTP setup

Two things you must configure in external dashboards — neither credential
enters this repo:

1. **Cloudflare Turnstile** — create a widget at the
   [Cloudflare dashboard](https://dash.cloudflare.com/login), add `localhost`
   to its allowed hostnames for local dev, copy the **Sitekey** into
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Then paste the **Secret Key** into
   Supabase → **Authentication → Bot and Abuse Protection** → Enable CAPTCHA
   protection → provider Turnstile. Supabase Auth verifies the token itself;
   there is no separate verify endpoint or Edge Function in this app. The
   login form renders no widget at all when the sitekey env var is unset —
   same dev-fallback pattern as `isSupabaseConfigured`, centralized in
   `lib/turnstile.ts`.

   **Trade-off, not a bug:** a CAPTCHA token cannot be produced without
   JavaScript, so login can no longer *complete* with JS disabled once
   Turnstile is configured. Server-side Zod re-validation in `signIn` still
   runs regardless (a `gmail.com` address is still rejected server-side with
   JS off) — only the final submit now requires JS. See `CLAUDE.md` §0.

   **Local development without a Cloudflare account:** for a fresh clone with
   no widget yet, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` —
   one of [Cloudflare's documented testing sitekeys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
   that always passes — renders the real widget and self-completes with no
   external calls. **Never let a test key reach production** —
   `lib/turnstile.ts`'s `assertTurnstileSafeForProduction()` throws at the
   top of `signIn` if `NODE_ENV === "production"` and the sitekey is either
   unset or a known test key, and `lib/env-guard.ts`'s
   `assertDeployEnvConfigured()` fails the Vercel Production build outright
   for the same condition (see "Deploying to Vercel" below) — so
   misconfiguration is caught at deploy time, not just at the first login
   attempt.

   Supabase Auth has exactly one CAPTCHA setting per project — there is no
   per-environment split on a single project. **This project's CAPTCHA
   protection is enabled with a real Turnstile secret**, so the test sitekey
   no longer validates:

   | Supabase CAPTCHA protection | Result with the test sitekey |
   |---|---|
   | Disabled | Token ignored, login works |
   | Enabled with a real Turnstile secret (current state) | Test token fails validation, local login breaks |

   `.env.local` accordingly holds the real sitekey, scoped to both
   `localhost` and the production Vercel hostname.

2. **Custom SMTP** — the default Supabase sender (`noreply@mail.app.supabase.io`)
   has a very low rate limit meant for dev, not real traffic (`429
   over_email_send_rate_limit` after a handful of sends per hour). Create an
   account with an email provider (Resend's free tier is the simplest),
   paste the SMTP host/port/user/password into Supabase → **Authentication →
   SMTP Settings**, set a sender name/address on your domain.

## Deploying to Vercel

The Vercel project is created from a GitHub import, which does **not** copy
`.env.local`. A deploy with none of the variables below set will fail the
build outright — `lib/env-guard.ts`'s `assertDeployEnvConfigured()`, called
from `next.config.ts`, throws when `VERCEL_ENV === "production"` and any of
them are missing or the Turnstile key is a test key, listing every problem in
one combined error rather than failing once per missing var. This is a
deploy-time backstop for the same condition
`assertTurnstileSafeForProduction()` (`lib/turnstile.ts`) already catches at
runtime in `signIn` — the build guard means that runtime throw should never
actually be reached.

Required in Vercel → Settings → Environment Variables (Production **and**
Preview scope):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your Supabase publishable key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | a **real** Cloudflare Turnstile sitekey scoped to the deployment's hostname |

**Never put a Cloudflare testing sitekey (e.g. `1x00000000000000000000AA`) in
a production environment.** It is a documented always-pass key; both the
build guard and `assertTurnstileSafeForProduction()` detect and reject it.

Two more things, or the deploy still fails at the same step:

1. **Redeploy after saving env vars, without the build cache.**
   `NEXT_PUBLIC_*` values are inlined into the client bundle at build time
   (see above) — saving them in the dashboard changes nothing until the next
   build actually runs.
2. **Add the production URL to Supabase → Authentication → URL
   Configuration** (a `https://<your-domain>/**` redirect entry, alongside
   the existing `http://localhost:59500/**`). `signIn` builds
   `emailRedirectTo` from the request's `origin` header (`actions/auth.ts`),
   so an un-allow-listed production origin makes Supabase reject the magic
   link at send time.

A third setting is easy to miss because it isn't in this repo at all:
**Supabase → Authentication → Sign In / Providers → "Allow new users to sign
up"** must be on. If it's off, every first-time magic-link sign-in — not just
a broken demo account — is rejected with `422 signup_disabled` at the
`/otp` step, before `handle_new_user()`'s own `approved_accounts` gate (§19)
ever runs. This project relies on that trigger, not the blunt project-level
toggle, to control who can actually get a `profiles` row.

The `SUPABASE_SECRET_KEY` / `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` /
`SUPABASE_JWKS_URL` variables are for the future `@supabase/server` Edge
Functions phase — nothing in the deployed app reads them yet, so there's no
need to set them on Vercel until that phase starts.

## Auth setup (magic link)

Login is email-only, restricted to `@udontech.ac.th`, via Supabase's magic
link. After creating the project:

1. Supabase dashboard → **Authentication → URL Configuration** → add
   `http://localhost:59500/**` (and your production URL) to the redirect
   allow-list. Magic links fail silently if the callback URL isn't allow-listed.
2. Apply all migrations above, in order.
3. Sign in at `/th/login` with an `@udontech.ac.th` address — a link arrives
   by email and lands on `/th/auth/callback`, which exchanges it for a session
   and redirects to `/th/dashboard`. A numeric student-ID address must be
   approved first (see above) or the request fails at step 1.

## Demo accounts

One account per role (`student` via the allow-list, `teacher`, `aft_teacher`,
`admin`), created via the Supabase Admin API with generated passwords —
credentials in `.demo-accounts.local.md` (git-ignored, never committed). The
passwords work for API/automated testing only; the app's UI is magic-link
only, so browser login for a demo account needs Supabase dashboard →
Authentication → Users → **Generate link**, pasted directly into a browser.
Teardown SQL is in that same file — run it before any production cutover.

## Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
npx tsc --noEmit  # type-check
```

## Running on Linux

Nothing in the codebase is Windows-specific (no backslash paths, no
`path.win32`, all asset filenames lowercase). Deploying to Linux is just
environment setup:

1. **Env file location is identical to Windows** — `.env.local` at the project
   root, e.g. `/srv/aft-dashboard/.env.local`:

   ```bash
   cp .env.example .env.local
   chmod 600 .env.local   # restrict to the app's own user; no Windows ACL equivalent
   ```

2. **For production**, prefer real environment variables over a checked-in file:
   - systemd: `EnvironmentFile=/etc/aft-dashboard.env` in the service unit
   - a process manager (pm2, Docker `--env-file`, or your host's env UI)
   - or `.env.production.local`, which Next.js also loads automatically

3. **Node.js 20+ required.** Use `npm ci` (not `npm install`) in CI/deploy —
   it installs exactly what `package-lock.json` pins.

4. **`NEXT_PUBLIC_*` vars must be set before `npm run build`**, not just
   `npm run start` — they're inlined into the client bundle at build time.

5. **ext4 is case-sensitive; NTFS (Windows) is not.** An import that
   resolves on Windows despite a case mismatch will 404 on Linux. `.gitattributes`
   in this repo also forces LF line endings on checkout so a Windows clone
   never introduces CRLF into files a Linux deploy reads.

6. Never commit `.env.local` or `.env.production.local`. If a real key ever
   lands in git history, rotate it in the Supabase dashboard immediately.
