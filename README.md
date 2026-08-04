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

Until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set, sign-in falls back to a dev-only role cookie (the switcher in the bottom-right corner, development mode only). The moment both are set, that switcher disappears and local dev requires a real sign-in (password sign-up, or Google) — see "Auth setup" below.

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

**`0021_documents_fliphtml5.sql`** switches the §12 e-book host from AnyFlip
to FlipHTML5: it nulls out any existing `flipbook_url` that can't match the
new pattern (there is no automatic cross-host URL translation), then
replaces `0013`'s `documents_flipbook_url_is_anyflip` CHECK constraint with
`documents_flipbook_url_is_fliphtml5`. See "E-books: FlipHTML5" below.

## Sign-up rule: every new account lands pending, an admin approves and assigns a role

`0019_add_pending_role.sql` / `0020_pending_signup_flow.sql` **replace** an
earlier pre-approval-roster design (see "Historical: the pre-approval
allow-list" below for why and what changed). Current behaviour: anyone with
an `@udontech.ac.th` address — email/password sign-up or Google — can
register freely. `handle_new_user()` gives every new signup `role =
'pending'`, which holds guest-level permissions only (public content, no
dashboard). An admin then opens `/approvals` (gated on `member:manage`),
sees everyone waiting, and assigns their real role (`student` / `teacher` /
`aft_teacher`) — granting `admin` through the UI is deliberately not
offered; promote to admin directly in the database, out of band from this
form.

A pending user who tries to reach a gated page is redirected to `/pending`
("your account is awaiting approval"), not back to `/login` — see
`deniedRedirectTarget()` in `lib/auth/require-role.ts`. The
`@udontech.ac.th` domain restriction itself is unchanged and still enforced
in three layers regardless of which sign-in method is used: Zod on the
client, the same Zod schema again in every auth Server Action
(`actions/auth.ts`), and a `CHECK (email like '%@udontech.ac.th')`
constraint on `profiles.email` (`0001_auth.sql`) — the last of which is what
actually protects the Google path below, since OAuth never touches any
Server Action's Zod checks at all.

### Password sign-in, sign-up, and reset

The login page (`/login`) takes an email + password (plus Google above it);
there is no magic-link option anymore — `signInWithOtp` was replaced
outright by `signInWithPassword` (`actions/auth.ts`), so an address with no
password set cannot sign in until it goes through the reset flow below.
`/signup` registers a new email/password account and requires clicking a
confirmation link before the account is usable (`signUp`'s
`emailRedirectTo` points at the existing `/auth/callback` route — the same
one Google already used). `/forgot-password` → `/reset-password` covers a
forgotten password: `resetPasswordForEmail` sends a recovery link to a
**new**, dedicated `app/[lang]/auth/reset/route.ts` route (kept separate
from `/auth/callback` so a recovery code can never be redirected anywhere
but `/reset-password`, preserving that both routes' redirect targets are
always hard-coded, never caller-supplied).

Every one of `signInWithPassword` / `signUpWithPassword` /
`requestPasswordReset` collapses its failure modes into one generic message
(`invalidCredentials`, or a uniform "check your email" success either way)
— never revealing whether a given `@udontech.ac.th` address is already
registered, the same account-enumeration guard `signInWithOtp` was built
around.

Two settings this depends on, both in the Supabase dashboard, neither in
this repo:

* **Authentication → Providers → Email → "Confirm email" must stay ON.**
  With it off, `signUp` hands back a usable session immediately and §19's
  email-verification requirement silently stops being met.
* **The mailer's send-rate cap now bites harder.** Whichever mailer is
  active (see "CAPTCHA + SMTP setup" below) now serves signup-confirmation
  and password-reset emails in addition to whatever it served before —
  reconfiguring custom SMTP (rather than relying on Supabase's ~2/hour
  built-in sender) matters more now than it did with magic-link-only auth.

### Google sign-in setup

Two dashboards, no credential enters this repo:

1. **Google Cloud Console** → APIs & Services → Credentials → Create OAuth
   client ID (Web application). Authorized redirect URI:
   `https://hmkciwgzbdszsgnbeakc.supabase.co/auth/v1/callback`.
2. **Supabase** → Authentication → Providers → Google → enable, paste the
   Client ID and Client Secret from step 1.

That's it on the Supabase side — no code here needs the client secret,
since Supabase's own server handles the OAuth token exchange.

**`hd=udontech.ac.th` is a hint, not enforcement.** `signInWithGoogle`
(`actions/auth.ts`) passes it so Google's account picker *suggests* a
college account, but a user can still choose a different Google account
than the one it suggests — Google does not block this. The
`profiles.email` CHECK constraint is what actually rejects a non-college
address (the `profiles` insert fails, which rolls back the whole
`auth.users` row `handle_new_user()`'s trigger fired from); the callback
route (`app/[lang]/auth/callback/route.ts`) also re-checks the signed-in
email directly and signs out + redirects with a friendly message if it
somehow gets past that, as defence in depth.

**Turnstile does not cover the Google path.** The CAPTCHA lives inside the
password sign-in/sign-up/reset Server Actions; OAuth redirects straight to
Google and back, never through it. This is an accepted trade-off, the same
shape as the already-documented JS-disabled trade-off below.

### Historical: the pre-approval allow-list

Migrations `0010`/`0011` (see `CLAUDE.md` §0 for the full narrative) added
an `approved_accounts` roster: a numeric-local-part address had to be added
by an admin *before* it could sign in at all, or `signInWithOtp` itself
failed with `"account not approved"`. `0020` drops that table and the
rejection path entirely — superseded, not deleted from history, because the
`0010`–`0012` migrations still document a real defect worth knowing about
(a `CREATE OR REPLACE FUNCTION` silently resetting `handle_new_user()`'s
`EXECUTE` grant, twice) even though the feature they were part of no longer
exists as shipped.

## E-books: FlipHTML5

The §12 e-book shelf (`/documents`) embeds books from
[FlipHTML5](https://fliphtml5.com), replacing an earlier AnyFlip-based
version (`0021_documents_fliphtml5.sql` supersedes `0013`'s AnyFlip CHECK
constraint — see `CLAUDE.md` §0). `lib/fliphtml5.ts` is the single source of
truth for what counts as a valid embed URL, shared by the write-time Zod
check (`schemas/documents.ts`) and the reader iframe
(`components/documents/flipbook-viewer.tsx`); both `fliphtml5.com/<id>/<book>`
(the share link a person copies out of their dashboard) and
`online.fliphtml5.com/<id>/<book>` (the reader host FlipHTML5's own embed
code points at) are accepted and normalized to the `online.` form on save.

Unlike the AnyFlip era, attaching a book is no longer a Table-Editor-only
step — it's a field on the owner's draft (`components/documents/document-form.tsx`)
that flows through the existing §12 draft → sign → submit → review →
approve workflow, so a book can't reach the public shelf without a reviewer
seeing it first (the document detail page renders a live preview via
`FlipbookViewer` for anyone who isn't the owner mid-edit). See
`docs/add-ebook.md` for the full walkthrough, including the Table Editor
fallback that still exists for admin-only one-off fixes.

**No verified demo book is seeded.** The previous AnyFlip-era seed carried
one row with a real, checked-reachable book; this session's outbound
network policy blocked every request to `fliphtml5.com` (proxy returned
`403` on `CONNECT`), so no replacement FlipHTML5 URL could be verified
before committing it — all three seeded rows currently have
`flipbook_url = null` ("book not attached"). Attach a real one via
`docs/add-ebook.md` once you can verify a URL by hand.

## Responsive check

`npm run check:responsive` drives the machine's own installed Chrome over the
raw DevTools Protocol (no Playwright/Puppeteer dependency — `WebSocket` is a
Node 22+ global) to verify §30.9 items 4 & 7: real viewport emulation at
375/768/1280px, both themes, with a self-test that proves the checker can
actually detect overflow before trusting any pass result.

* `BASE_URL` — target to check, defaults to `http://localhost:59500` (run
  `npm run dev` first). Also works against a deployed URL.
* Authenticated pages (`/th/dashboard`, `/th/members`, etc.) are reached via
  the Supabase Admin API using `SUPABASE_SECRET_KEY` (already in
  `.env.local`) against the admin row in the gitignored
  `.demo-accounts.local.md`, or `RESPONSIVE_CHECK_EMAIL` to target a
  different address. Without a resolvable service key, authenticated pages
  are skipped with an explicit warning — never silently reported as covered.
* Output (screenshots + `report.json`) goes to the gitignored
  `.responsive-check-out/`, excluded from both git and ESLint.

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
   JavaScript, so login/signup/reset can no longer *complete* with JS
   disabled once Turnstile is configured. Server-side Zod re-validation in
   `actions/auth.ts` still runs regardless (a `gmail.com` address is still
   rejected server-side with JS off) — only the final submit now requires
   JS. See `CLAUDE.md` §0.

   **Local development without a Cloudflare account:** for a fresh clone with
   no widget yet, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` —
   one of [Cloudflare's documented testing sitekeys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
   that always passes — renders the real widget and self-completes with no
   external calls. **Never let a test key reach production** —
   `lib/turnstile.ts`'s `assertTurnstileSafeForProduction()` throws at the
   top of every password-auth Server Action if `NODE_ENV === "production"`
   and the sitekey is either
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
   over_email_send_rate_limit` after a handful of sends per hour). Configured
   via Resend in Supabase → **Authentication → Emails → SMTP Settings**:
   host `smtp.resend.com`, port `465`, username `resend`, password the
   Resend API key (pasted directly into the dashboard — never stored in this
   repo or `.env.local`), sender `noreply@udontech.ac.th` ("AFT UDONTECH").
   Enabling custom SMTP raises Supabase's rate limit from the default to 30
   emails/hour automatically (adjustable further under **Rate Limits**).
   **The sending domain must show "Verified" in Resend → Domains before this
   works** — Resend rejects sends through an unverified domain with a `550`
   error, and Supabase does not fall back to the default mailer when that
   happens. Verification requires adding the DKIM/SPF/MX records Resend
   generates to the domain's DNS (Cloudflare, in this project's case) and can
   take minutes to hours to propagate.

## Deploying to Vercel

The Vercel project is created from a GitHub import, which does **not** copy
`.env.local`. A deploy with none of the variables below set will fail the
build outright — `lib/env-guard.ts`'s `assertDeployEnvConfigured()`, called
from `next.config.ts`, throws when `VERCEL_ENV === "production"` and any of
them are missing or the Turnstile key is a test key, listing every problem in
one combined error rather than failing once per missing var. This is a
deploy-time backstop for the same condition
`assertTurnstileSafeForProduction()` (`lib/turnstile.ts`) already catches at
runtime in every password-auth Server Action — the build guard means that
runtime throw should never actually be reached.

Required in Vercel → Settings → Environment Variables (Production **and**
Preview scope):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your Supabase publishable key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | a **real** Cloudflare Turnstile sitekey scoped to the deployment's hostname |
| `NEXT_PUBLIC_SITE_URL` | optional on Vercel — see below |

`NEXT_PUBLIC_SITE_URL` (`lib/site-url.ts`) doesn't need to be set by hand on
Vercel: when a project's "Automatically expose System Environment Variables"
setting is on (the default), Vercel injects `VERCEL_PROJECT_PRODUCTION_URL`
itself, and the build guard and auth redirect logic both fall back to it. Set
`NEXT_PUBLIC_SITE_URL` explicitly only if that setting is off, or for a custom
domain, or for the self-hosted Linux target (CLAUDE.md §2), which has no
Vercel env to fall back to.

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
   the existing `http://localhost:59500/**`). `signUpWithPassword` and
   `signInWithGoogle` both build their redirect from the request's `origin`
   header (`actions/auth.ts`), so an un-allow-listed production origin makes
   Supabase reject the confirmation/OAuth link at send time.

A third setting is easy to miss because it isn't in this repo at all:
**Supabase → Authentication → Sign In / Providers → "Allow new users to sign
up"** must be on. If it's off, every first-time sign-up — not just a broken
demo account — is rejected with `422 signup_disabled` at the `/signup` or
OAuth step, before `handle_new_user()` ever runs. This project relies on
that trigger (which lands every signup as `pending`, see "Sign-up rule"
above), not the blunt project-level toggle, to control who can actually get
a `profiles` row.

The `SUPABASE_SECRET_KEY` / `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` /
`SUPABASE_JWKS_URL` variables are for the future `@supabase/server` Edge
Functions phase — nothing in the deployed app reads them yet, so there's no
need to set them on Vercel until that phase starts.

## Auth setup (password + Google)

Login is restricted to `@udontech.ac.th`, via email/password and,
optionally, Google (see "Google sign-in setup" above). After creating the
project:

1. Supabase dashboard → **Authentication → URL Configuration** → add
   `http://localhost:59500/**` (and your production URL) to the redirect
   allow-list. Signup confirmation links, password-reset links, and OAuth
   all fail silently if the callback URL isn't allow-listed.
2. Apply all migrations above, in order.
3. Register at `/th/signup` with an `@udontech.ac.th` address (or use the
   Google button, if configured), confirm via the email link, then sign in
   at `/th/login` with the same email + password — you land on
   `/th/auth/callback`, which exchanges the code for a session and
   redirects to `/th/pending` (every fresh signup) or `/th/dashboard` (once
   an admin has approved you — see "Sign-up rule" above). A forgotten
   password is recovered at `/th/forgot-password`.

## Session timeout

Every session is force-signed-out 12 hours after sign-in (`SESSION_MAX_AGE_MS`
in `lib/auth/session-timeout.ts`), checked in `middleware.ts` against
Supabase's server-verified `last_sign_in_at` on every request — a redirect to
`/login?error=sessionTimedOut` with an explanatory message, not a silent
bounce. This is a hard cap since sign-in, not an idle timer.

For defence in depth, also set a matching **project-level** cap in Supabase
dashboard → **Authentication → Sessions → Time-box user sessions** → `12`
hours. That setting invalidates the refresh token itself at the auth server —
stronger than the app-level check, which can only act once a request reaches
this app's middleware. The app-level cap above works correctly without it;
this is a manual dashboard step, not applied by any migration here.

## Demo accounts

One account per role (`student`, `teacher`, `aft_teacher`, `admin`),
created via the Supabase Admin API with generated passwords and manually
promoted past `pending` — credentials in `.demo-accounts.local.md`
(git-ignored, never committed). Since the app's UI now supports
email/password sign-in directly, these credentials work for **both**
API/automated testing and ordinary browser login at `/login` — no admin
"Generate link" step needed anymore (that remains a fallback for an account
whose password isn't known). Teardown SQL is in that same file — run it
before any production cutover.

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
environment setup. This section covers the **app** — for connecting to and
applying migrations against the hosted Supabase **database** from a Linux
machine, see [`docs/linux-database.md`](docs/linux-database.md).

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
