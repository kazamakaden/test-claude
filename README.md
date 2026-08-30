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
| `TURNSTILE_SECRET_KEY` | Turnstile secret. Server-only. The app verifies tokens itself, so Supabase's project-level CAPTCHA must be OFF — see "CAPTCHA + SMTP setup" |

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

**The role split (`0010`/`0011`) and the §14 student-ID allow-list — all of
this was later undone; read it as history, not as current behaviour.**
`0046`–`0049` rebuilt the role model (`aft_teacher` and `pending` are both
unstorable now, `aft` exists instead) and `0020` had already dropped
`approved_accounts`. The paragraph is kept because the migrations are still
in the folder and run in order on a fresh database.
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

**`0053_remove_fliphtml5.sql`** removes the third-party flipbook host
entirely, superseding `0013` (AnyFlip) and `0021` (the switch to FlipHTML5).
It drops `flipbook_url` from both `books` and `documents` along with their
CHECK constraints, and replaces `books_published_needs_content` with
`books_published_needs_pdf`. Any book that was published with only a
flipbook link is returned to draft first, since there is nothing to convert
a link on someone else's server into a PDF. See "E-books: uploaded PDFs"
below.

## Sign-up rule: the email's local part decides the role

Anyone with an `@udontech.ac.th` address can sign in immediately — there is
no waiting room. `handle_new_user()` reads the local part and applies §14's
split: `^[0-9]{11,}$` is a student ID, so the account lands `student` with
its `student_id` and สาขา resolved from the programme code; any other local
part is a named staff address and lands `teacher`.

`student` is **read-only** (§6). The roles that can actually do things —
`aft` (นักศึกษา อวท.) and `teacher` — are reached afterwards: an admin
assigns an อวท. ตำแหน่ง from `/members`, and `sync_role_with_position()`
promotes `student` → `aft` automatically. `admin` is deliberately not
grantable through any form; promote in the database, out of band.

**Superseded, and mentioned only because older notes describe it:** a
`pending` role with an `/approvals` waiting room, and before that a
pre-approval roster table. `0046_four_role_model.sql` removed the first
(`profiles_role_allowed` now refuses to store `pending`, `/approvals` is a
bare redirect to `/members`, and `/pending` is deleted) and the roster table
was dropped earlier still. Nothing in the app writes `role = 'pending'`.

The `@udontech.ac.th` domain restriction itself is unchanged and still enforced
in three layers regardless of which sign-in method is used: Zod on the
client, the same Zod schema again in every auth Server Action
(`actions/auth.ts`), and a `CHECK (email like '%@udontech.ac.th')`
constraint on `profiles.email` (`0001_auth.sql`) — the last of which is what
actually protects the Google path below, since OAuth never touches any
Server Action's Zod checks at all.

### Password sign-in, sign-up, and reset

The login page (`/login`) leads with the Google button and keeps an email +
password form behind a native `<details>` disclosure — `<details>` needs no
JavaScript to open, so both paths degrade independently. `signInWithOtp` is
gone, replaced outright by `signInWithPassword` (`actions/auth.ts`), so an
address with no password set cannot use that form until it goes through the
flow below.

**`/signup` is a `redirect()` to `/login`,** kept only so an old bookmark
lands somewhere useful: registration is Google-only, and
`signUpWithPassword` no longer exists. The one way an account gets a password
without Google is an admin creating it from `/members` → "Add user", which
sets one at creation.

`/forgot-password` → `/reset-password` covers a forgotten password, and
`/set-password` covers a first-time Google account that has none. **Both
send an email this app composes and delivers itself over SMTP** — Supabase
Auth's `resetPasswordForEmail` is no longer called anywhere. See
`docs/email-setup.md` for why (short version: this project enables
Supabase's project-level CAPTCHA, which refuses a server-initiated recovery
send outright) and for the SMTP setup.

The flow is:

```
request form (Turnstile)
  → mint a token, store only its SHA-256 (0064), email the link
  → GET /[lang]/auth/set-password?token=…   VALIDATES, never consumes
  → token moves into an httpOnly cookie, redirect
  → /[lang]/reset-password  → submit password
  → ONE atomic UPDATE spends the token → admin API sets the password
  → /login?notice=…
```

Three properties carry the security of that, and none is incidental:

* **The GET does not consume the token.** Gmail, Outlook and corporate
  antivirus all fetch links in mail before a human does; a token spent by
  that fetch would be dead by the time the recipient clicks, intermittently
  and undiagnosably. Consuming happens on the POST. Single-use is intact —
  "use" means setting a password.
* **The cookie carries the raw token, not the token row's id.** A row id in
  a cookie is a bearer credential anyone who can guess one could use; the
  token is 256 bits minted for exactly this job.
* **Consumption is a single `UPDATE … WHERE token_hash = … AND used_at IS
  NULL AND expires_at > now() RETURNING user_id`,** so two concurrent
  submissions cannot both win, and the account acted on is the one that
  statement returned — never a form field, cookie or query parameter.

Both `signInWithPassword` and `requestPasswordReset` collapse their failure
modes into one generic message
(`invalidCredentials`, or a uniform "check your email" success either way)
— never revealing whether a given `@udontech.ac.th` address is already
registered, the same account-enumeration guard `signInWithOtp` was built
around.

Two settings this depends on, both in the Supabase dashboard, neither in
this repo:

* **Authentication → Sign In / Providers → "Allow new users to sign up" must
  stay ON.** `signInWithIdToken` creates the `auth.users` row on a first
  Google sign-in; with the toggle off it is rejected with `422
  signup_disabled` before `handle_new_user()` runs. The real gate is that
  trigger plus the `CHECK` on `profiles.email`, not this switch.
* **Supabase's mailer is out of the path entirely.** Password setup and
  reset are sent by this app (above), magic link is gone, and a Google
  identity needs no confirmation — so nothing in normal operation depends on
  Supabase's built-in sender or its ~2/hour cap.

### Google sign-in setup

Google sign-in runs entirely through **this app's own OAuth flow**. Supabase's
hosted flow (`signInWithOAuth`, `/{lang}/auth/callback`) is gone — it was kept
alongside the new one only until a real browser proved the new path, which it
did.

#### How it works

```
/{lang}/auth/google/start   our route: PKCE + state + nonce, our client id
      → Google consent
      → /th/auth/google/callback   our route, our domain, our client secret
      → verify id_token against Google's JWKS
      → supabase.auth.signInWithIdToken(...)  → normal Supabase session
```

Supabase still **issues** the session, which is the point: `auth.uid()` and all
83 RLS policies behave exactly as before, and this app owns no signing key. (An
earlier design had the app mint its own JWTs; the project moved to ECC signing,
so the private key never leaves Supabase — and that responsibility was the wrong
one to take on regardless, since it fails *open* when wrong.)

What the app enforces itself, in `lib/google-oauth.ts`:

* **`state`** in an httpOnly cookie, compared on return — CSRF on the callback
* **`nonce`** we generate, asserted inside the returned `id_token` — this is
  what stops a token obtained elsewhere being replayed into our callback
* **PKCE S256** — the verifier never leaves our server
* **signature, issuer, audience and expiry** against Google's JWKS
* **`email_verified === true` and the `@udontech.ac.th` suffix**, server-side,
  before any row is touched. `hd` is only a hint to Google's account picker —
  a user can pick any account, and Google does not enforce it.

Setup, both dashboards:

1. **Google Cloud Console** → Credentials → your OAuth client → Authorised
   redirect URIs, one per domain: `https://<domain>/th/auth/google/callback`
   (plus `http://localhost:59500/th/auth/google/callback` for dev). The `/th`
   is fixed — Google matches `redirect_uri` exactly, so the viewer's real
   locale travels in a cookie rather than the path.
2. **Supabase** → Authentication → Providers → Google → **enabled**, with the
   same client id under *Authorized Client IDs* so `signInWithIdToken` accepts
   our tokens.

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (see `.env.example`).
Both are **required in production** — `lib/env-guard.ts` fails the build without
them, same tier as the SMTP and Turnstile secrets. This is the only way into the
app, so a missing value is a locked front door, not a degraded feature.

#### History: the Supabase-hosted flow

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

## E-books: uploaded PDFs

The shelf at `/documents` serves plain PDF files. Clicking a book opens its
PDF in a new tab, handed to the browser's own viewer — no flipbook, no
iframe, no third-party origin. This replaced a FlipHTML5 integration
(itself preceded by AnyFlip) in `0053_remove_fliphtml5.sql`, because the
hosted flipbook did not meet the project's technical requirements or Thai
government web compliance.

Files live in the **private** `books` Storage bucket (`0029_books_storage.sql`),
never a public one: a public bucket makes every object readable by path
regardless of publish status, which would put a draft's PDF one URL guess
away from the world. Reads go through a short-lived signed URL minted per
request (`services/books.ts#getSignedPdfUrl`), and the shelf signs a whole
page of them in one call (`getSignedUrlMap`) rather than one per card.

Two guards decide who can open a file, and neither lives in the UI:

* `books_select_published` / `books_select_own` / `books_select_staff`
  (`0028`) decide whether the row is visible at all — a guest only ever
  sees published books.
* `books_published_needs_pdf` (`0053`) makes "published implies a PDF
  exists" a database invariant, so the shelf can never render a card with
  nothing behind it.

`lib/books.ts#canOpenBookPdf` is the app-layer consequence of those two: a
published book opens for anyone, and a draft opens only for its owner or
staff, so a file can be checked before it goes public.

Uploading is a field on the owner's own book (`components/books/book-edit-form.tsx`),
flowing through the existing draft → publish workflow. **Publishing requires
`document:approve`, which only `admin` holds** — `aft` and `teacher` can
create and edit their own books but cannot publish one, so a book is always
seen by someone else before it reaches the public shelf. See
`docs/add-ebook.md` for the walkthrough.

**No demo PDF is seeded.** The six existing books are demo rows and none
has a file attached, so the shelf is empty until someone uploads one.

## สาขา and education levels

A student's college email local part is their student ID, and the middle
5 digits are the **รหัสสาขา** — matched against `departments.code` at sign-in
so สาขา fills itself in. The first of those digits is the qualification:
`2` ปวช., `3` ปวส., `4` ทล.บ.

**Adding a new สาขา needs no code change** — an admin does it in
**สมาชิก → กรอกอัตโนมัติ**, which pre-fills the code from a student's email.
**Adding a new education level** (a รหัสสาขา starting with an unnamed digit) is
a small, compiler-guided change in `lib/student-id.ts` plus one dictionary key.
An unnamed digit never blocks a sign-in — it just displays as
"ไม่ทราบระดับชั้น" until named.

See [`docs/add-education-level.md`](docs/add-education-level.md) for both.

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
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the **Secret Key** into
   `TURNSTILE_SECRET_KEY`. Both go in the app's own environment; the secret is
   server-only and never `NEXT_PUBLIC_`.

   **This app verifies the token itself** — `lib/turnstile-server.ts` calls
   Cloudflare's `siteverify` — so **Supabase's project-level CAPTCHA must be
   turned OFF** (Authentication → Bot and Abuse Protection). This is not
   optional: a Turnstile token is single-use, so verifying it here *and*
   forwarding it to Supabase makes Supabase's check fail and every sign-in
   break.

   **Order matters when changing this.** Disable Supabase's CAPTCHA *first*,
   then deploy. The other way round sends no token to a Supabase that still
   demands one, and sign-in fails for everyone in between.

   Why it moved: a project-level CAPTCHA applies to every public auth
   endpoint, which is why server-initiated calls were refused with
   `captcha protection: request disallowed` and why `/set-password` had to
   exist as an interstitial page. It also meant the app itself never checked
   anything — before this change `readCaptchaToken()` only tested that the
   field was non-empty, so a `POST` with `cf-turnstile-response=x` passed.

   Verification **fails closed**: a non-200, malformed JSON, a network error
   or a timeout all refuse the submission, and the `error-codes` array is
   logged server-side. The reported `hostname` is checked against the current
   request's own host (not a hardcoded list — this project has lost sign-in
   twice to stale hostname allow-lists); `TURNSTILE_ALLOWED_HOSTNAMES` adds
   exceptions if a proxy makes those differ.

   The login form renders no widget at all when the sitekey env var is unset —
   same dev-fallback pattern as `isSupabaseConfigured`, centralized in
   `lib/turnstile.ts`. With a sitekey but no secret, verification is skipped
   **in development only** (logged); in production it refuses everything.

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
   external calls. Pair it with a
   [test **secret** key](https://developers.cloudflare.com/turnstile/troubleshooting/testing/),
   `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`, so the
   server-side check has something to verify against. **Never let a test key reach production** —
   `lib/turnstile.ts`'s `assertTurnstileSafeForProduction()` throws at the
   top of every password-auth Server Action if `NODE_ENV === "production"`
   and the sitekey is either
   unset or a known test key, and `lib/env-guard.ts`'s
   `assertDeployEnvConfigured()` fails the Vercel Production build outright
   for the same condition (see "Deploying to Vercel" below) — so
   misconfiguration is caught at deploy time, not just at the first login
   attempt.

   Supabase Auth has exactly one CAPTCHA setting per project — there is no
   per-environment split on a single project. That used to matter here,
   because the setting was **on** and a Cloudflare test sitekey therefore
   broke local login. It no longer does: with Supabase's CAPTCHA off (above),
   the only thing that validates a token is this app, so a test sitekey
   paired with its matching test secret works locally exactly as documented
   two paragraphs up.

   If you find that setting switched back on, local login will start failing
   with a token this app has already spent. Turn it off rather than working
   around it.

2. **SMTP, in this app rather than in Supabase.** Migration `0064` moved the
   password-setup and password-reset mail out of Supabase Auth entirely:
   `lib/mailer.ts` composes and sends it over plain SMTP via nodemailer, and
   nothing in the codebase calls `resetPasswordForEmail` any more. Set
   `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` (host and port default to
   `smtp.gmail.com:465`) — see `docs/email-setup.md`, which also names the
   exact server log line for each failure mode, because the Server Action
   deliberately reports the same success either way to avoid account
   enumeration.

   Three consequences worth knowing:

   * Supabase's own mailer and its ~2/hour built-in cap are **out of the
     path**. Configuring custom SMTP inside Supabase does nothing for these
     emails.
   * A missing `SMTP_*` is not a degraded feature, it is a locked front door
     — setting a password is the only route into an account that has none —
     so `lib/env-guard.ts` fails the production build without them.
   * An earlier revision of this file described a Resend-through-Supabase
     setup. That is historical: the credentials were cleared by Supabase's own
     dashboard when the toggle was switched off, and the sending domain never
     completed DNS verification. Neither matters now, because the mail no
     longer goes that way.

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
| `TURNSTILE_SECRET_KEY` | the matching Turnstile **secret**; this app runs `siteverify` itself (`lib/turnstile-server.ts`), so without it every submission is refused |
| `GOOGLE_CLIENT_ID` | Google OAuth client id — Google sign-in runs through this app's own flow, so this is the only way in |
| `GOOGLE_CLIENT_SECRET` | the matching client secret |
| `SMTP_USER` | the sending mailbox; this app composes and delivers the password-setup / reset mail itself (`lib/mailer.ts`) |
| `SMTP_PASSWORD` | its app password — see `docs/email-setup.md` |
| `SMTP_FROM` | the envelope sender, which must be the authenticated account or one of its verified aliases |
| `NEXT_PUBLIC_SITE_URL` | optional on Vercel — see below |

That is the full set the build guard enforces; a deploy missing any of them
fails at `next build`, not at first use. `SMTP_HOST` / `SMTP_PORT` are
**not** in the table because `lib/mailer.ts` defaults them to
`smtp.gmail.com:465` — set them only for a different provider. The push
(`VAPID_*`, `PUSH_DISPATCH_SECRET`) and Facebook-banner (`FACEBOOK_*`,
`CRON_SECRET`) variables are deliberately not build-required either: unset
means the feature hides itself rather than failing, and `lib/env-guard.ts`
explains that distinction where it declines to check them.

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
2. **Register the callback in Google Cloud Console**, as an Authorized
   redirect URI: `https://<your-domain>/th/auth/google/callback`. Note the
   **`/th`** — `lib/google-oauth.ts` fixes the locale segment there on
   purpose, because Google matches the URI exactly and a per-locale path
   would mean one registration per language; the viewer's real locale travels
   in a cookie instead. A domain missing from that list fails with
   `redirect_uri_mismatch`, and this project has lost sign-in to a
   forgotten hostname allow-list twice already (Cloudflare's widget list, and
   Supabase's redirect list) — so register **every** hostname the app answers
   on, including any team-scoped `*.vercel.app` alias.

   Supabase → Authentication → URL Configuration is **no longer part of this
   path**: sign-in goes Google → this app's own callback →
   `signInWithIdToken`, which performs no redirect of its own. Older
   revisions of this file told you to add a redirect entry there; that was
   true of the Supabase-hosted OAuth flow, which is gone.

A third setting is easy to miss because it isn't in this repo at all:
**Supabase → Authentication → Sign In / Providers → "Allow new users to sign
up"** must be on. If it's off, a first-time sign-in is rejected with `422
signup_disabled` before `handle_new_user()` ever runs. That trigger — not
the blunt project-level toggle — is what decides who gets a `profiles` row
and with which role (§14: a numeric local part is a student ID and lands
`student`; a named address lands `teacher`). The `@udontech.ac.th`
restriction is enforced separately, and the `CHECK` on `profiles.email` is
the layer that actually holds for the OAuth path.

The `SUPABASE_SECRET_KEY` / `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` /
`SUPABASE_JWKS_URL` variables are for the future `@supabase/server` Edge
Functions phase — nothing in the deployed app reads them yet, so there's no
need to set them on Vercel until that phase starts.

## Auth setup (password + Google)

Login is restricted to `@udontech.ac.th`, via email/password and,
optionally, Google (see "Google sign-in setup" above). After creating the
project:

1. Google Cloud Console → add `http://localhost:59500/th/auth/google/callback`
   as an Authorized redirect URI (note the fixed `/th`, see "Google sign-in
   setup"). Supabase's own **URL Configuration** redirect allow-list is not
   part of this path any more — `signInWithIdToken` performs no redirect —
   though leaving existing entries there is harmless.
2. Apply all migrations above, in order.
3. Sign in at `/th/login` with the Google button, using an `@udontech.ac.th`
   address. There is no separate registration step and no waiting room: the
   first sign-in creates the account and `handle_new_user()` assigns the role
   from the email's local part (see "Sign-up rule" above). You land on
   `/th` — the §8 dashboard grid renders on `/th/calendar` for a signed-in
   viewer, and `/th/dashboard` is kept only as a redirect for old links.
4. A first-time Google account has no password, so it is sent to
   `/th/set-password`, which emails a link through this app's own SMTP. A
   forgotten password is recovered the same way at `/th/forgot-password`.
   Both need `SMTP_*` set, or the mail is logged as unsent and never arrives.

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

One account per role — the current set is `student`, `aft`, `teacher`,
`admin` (`aft_teacher` and `pending` no longer exist; see "Sign-up rule") —
created via the Supabase Admin API with generated passwords, with `aft`
reached by assigning an อวท. ตำแหน่ง rather than by writing the role
directly. Credentials are in `.demo-accounts.local.md`
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
