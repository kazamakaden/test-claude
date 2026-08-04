# CLAUDE.md — AFT UDONTECH Dashboard

## 0. Phase 1 Status (as of 2026-08-01)

Tracked against the §30 build plan. Grouped by done vs. remaining so status is
scannable at a glance — each item still tags its §30.x subsection for detail.

### ✔ Done

**Scaffold (§30.1)** — Next.js 15 App Router, React 19, TS strict, Tailwind v4,
ESLint, git init, shadcn/ui (on `@base-ui/react`, not Radix), Phase-1 deps
installed (`@supabase/ssr`, RHF, Zod, next-themes, framer-motion, lucide-react,
recharts, date-fns). Deferred deps (TanStack Table/Query, Zustand, QR Scanner,
Signature Canvas) correctly not installed yet.

**Design system (§30.2, §30.7)** — Palette retoned to a monochrome desaturated
steel navy + platinum silver, matched to `Picture/tone color dark.jpg`
(`#0C121C` / `#3E6D9C` / `#CFD8E3`); mustard `#FFB800` and blue `#002583` fully
removed from the UI palette (logo crest excepted — see §3). Typography (IBM
Plex Sans Thai + Inter). Logo assets wired for light/dark. Recharts confined
to 2 Client Components, monochrome-safe by bar length not hue.

**Internationalization (§30.3)** — `app/[lang]/...` (`th`/`en`, `th` default),
key-aligned dictionaries with `types/i18n.ts` deriving the type from `th.json`
so a missing English key is a compile error, cookie-based locale
detection/redirect, language toggle, invalid locale 404s.

**Supabase auth layer (§30.4, §30.5)** — `lib/supabase/{client,server,middleware,env}.ts`,
`types/database.ts`, migrations for the auth-critical subset (`profiles`,
`user_role` enum, `handle_new_user`/`updated_at` triggers, `current_role()`
helper, RLS with role-escalation guard). `getRole()` reads the real session
and fails closed to `"guest"`; falls back to a dev-cookie stub only when
Supabase isn't configured **and** `NODE_ENV=development`. Magic-link sign-in
(`schemas/auth.ts` + `actions/auth.ts`) enforces `@udontech.ac.th` with a
friendlier message for personal domains (§7), re-validated server-side.
Login form posts via native `<form action>` + `useActionState` (works with JS
disabled). `auth/callback` route exchanges the code, hard-codes the redirect
target (no open-redirect). Sign-out wired to a real Server Action.

**Layout (§30.6)** — Top nav only (no sidebar), sticky, role-filtered nav,
mobile `Sheet`, footer, theme/language toggles, keyboard support (skip-link,
focus rings, Escape closes sheet), correctly labeled landmarks.

**Dashboard (§30.7)** — All 10 §8 sections built (Welcome, Notifications,
Upcoming Meetings, Calendar, Activity Statistics, Draft Documents, Recent
Projects, Recent Activities, Member Statistics, Quick Actions) in
`components/dashboard/`. `services/dashboard.ts` — one typed fetcher per
section, returning fixture data **unconditionally** (not gated on Supabase
config — the §20 dashboard tables don't exist yet, so gating on env presence
would break the dashboard the moment credentials land; each function carries
a `// → §20 <table>` note for its later swap). `lib/dev-fixtures.ts` includes
one deliberately empty array so every empty state is exercisable. Role-aware
via the existing `can()` matrix (no second source of truth). Every card wraps
in `<Suspense>` + a matching skeleton + its own `CardBoundary` so one failing
card can't take down the grid; route-level `error.tsx` is the last resort.

**Folder structure (§30.8)** — `app/`, `components/{ui,layout,dashboard}/`,
`lib/`, `types/`, `actions/`, `schemas/`, `supabase/`, `services/` all exist.

**Automated verification (§30.9)** — `npx tsc --noEmit`, `npm run lint`,
`npm run build` all pass clean.

**Other fixes** — orphaned `/announcements` linked from the footer; nav logo
blur/dark-mode/aspect-ratio fixed (regenerated crop, correct dimensions,
dark-mode variant); homepage hero vertically centered below the sticky nav.

**Members (§9, §30.10 — 1st of 7 post-Phase-1 phases)** — Real member
directory at `/members`: search (300ms debounced), sort, 10-rows/page
pagination, and Department/Year/Class/Club filters, all driven by URL search
params (`schemas/members.ts` whitelists the sort column and clamps page size —
server-side + URL state, deferring TanStack Query per the §30.10 deviation
recorded below) rather than a client-side table. `supabase/migrations/0003_members.sql`
adds `departments`/`clubs` and extends `profiles` with `student_id` (§14
format), `department_id`, `class_name`, `club_id`, and a **generated**
`academic_year` column so it can never drift from `student_id`.
`0004_members_rls.sql` adds a directory read policy plus a **column-level**
revoke on `citizen_id` — RLS is row-level and can't hide one column, and since
Supabase admins share the `authenticated` Postgres role with everyone else, a
plain revoke would lock them out too; admin reads go through the
`get_citizen_id()` `SECURITY DEFINER` accessor instead. `supabase/seed.sql`
(§30.4, previously unstarted) now seeds real departments/clubs.
`services/members.ts` never `select("*")` and gates the live query on an
explicit `MEMBERS_TABLES_READY` constant — not `isSupabaseConfigured`, same
lesson as the dashboard. `components/ui/{table,select}.tsx` added via shadcn
and verified to resolve against `@base-ui/react`, not Radix.

**`components/ui/form.tsx` (§30.2)** — built on `@base-ui/react/field`
(`Field.Root/Label/Description/Error`), not the stock Radix + react-hook-form
recipe (Radix isn't installed; RHF/`@hookform/resolvers` stay installed but
unused). `Field.Root`'s `invalid` prop and `Field.Error`'s `match={true}` let
external state (a `useActionState` result) drive validity display, so
`login-form.tsx` now gets `id`/`htmlFor`/`aria-invalid`/`aria-describedby`
wired automatically instead of by hand — verified in-browser via the DOM
(matching `id`/`for`, `aria-describedby` pointing at the rendered error's
`id`). The `<form action={formAction}>` + `useActionState` binding, hidden
`lang` field, and `useFormStatus` submit button are unchanged — the
JS-disabled guarantee (§30.9) still holds. `components/forms/` stays
uncreated: nothing composed exists to put there (the login form is correctly
colocated with its route; `MembersFilters` lives in `components/members/`).

**`components/charts/`, `hooks/` (§30.8)** — `chart-frame.tsx` extracts the
`ResponsiveContainer` wrapper, tooltip style, and axis/grid props duplicated
between the two dashboard charts; `activity-bar-chart.tsx` and
`department-bar-chart.tsx` hold the recharts bodies. Both dashboard card
shells (`activity-stats-card.tsx`, `member-stats-card.tsx`) dropped
`"use client"` as a result — they use no hooks, so they're Server Components
again, with only the chart leaf crossing the client boundary.
`hooks/use-debounced-value.ts` extracts the debounce timer out of
`members-filters.tsx` (same guard against redundant `router.replace`
preserved); §18 global search is its next consumer.

**Manual browser checklist (§30.9 + Members-specific)** — run against
`npm run dev` with no `.env.local` (fixtures, `dev_role` cookie). Routing/i18n,
theme toggle (light/dark, no clipped Thai tone marks), language toggle
(path-preserving, `/th`↔`/en`), dashboard (all 10 sections, both extracted
charts render), Members (25 fixtures / 3 pages, search debounce, all 4
filters, sort toggle + persistence across pages, URL round-trip, zero-result
empty state), and role gating (guest redirected from `/members`, nav filtered)
all passed. Auth: `gmail.com` correctly rejected with the friendly Thai
message; `@udontech.ac.th` correctly passes validation and reaches the
Supabase call (which then fails — expected, no live project, see Remaining).
JS-disabled server-enforcement (§30.9 item 3) and the 375/768/1280px
responsive pass were **not verified this pass** — the browser tool used
can't toggle JS or resize the actual rendering viewport in this environment;
the code-level guarantee (Zod re-validated in `signIn`, Tailwind responsive
classes already in `page-shell.tsx`/dashboard grid) stands but is unproven
in-browser. Two real defects found and fixed:
1. `schemas/members.ts`'s `z.uuid()` on `dept`/`club` was correct (matches
   the `uuid` PK in `0003_members.sql`) but `lib/dev-fixtures.ts` used
   non-UUID ids (`"dept-1"`), so `.catch(null)` silently dropped both
   filters. Fixed by giving the fixtures stable UUIDs.
2. `components/ui/select.tsx`'s `SelectValue` had no `children` render
   function, so Base UI displayed the raw stored value (`"__all__"`) instead
   of the matched option's label — every "all" filter showed literal
   `__all__` text. Fixed by adding a `children` function to each
   `MembersFilters` `SelectValue` that maps the value to its label.
`fixtureEmptyMeetings` was also removed: it was unused (dead code) and its
"exercises the empty state" comment was false — no dashboard fixture array
was actually wired empty.

**Live Supabase database (§30.4/§30.5/Members, `citizen_id` guard proven)** —
project `hmkciwgzbdszsgnbeakc` created; migrations `0001`–`0004` applied via
the Supabase MCP plugin, followed by two migrations this pass added and
applied:
1. `0005_citizen_id_column_grants.sql` — **a real defect, confirmed live and
   fixed.** `0004`'s `revoke select (citizen_id) on public.profiles from
   authenticated` was a no-op: PostgreSQL does not let a column-level revoke
   narrow a table-level grant, and Supabase grants table-level `SELECT` to
   `authenticated` on every new table by default. Verified by creating a real
   student user, signing in for a genuine JWT, and calling
   `profiles?select=*` — `citizen_id` came back in plain text. `0005` revokes
   the table-level grant and re-grants an explicit column allow-list
   (`citizen_id` excluded). Re-ran the same call after — `42501 permission
   denied for table profiles`, confirmed fixed. Full 8-case matrix (student
   `select=citizen_id`/`select=*`/`select=id,full_name`, student and admin
   `rpc/get_citizen_id`, anon `select=id`, student `PATCH role='admin'`,
   student `PATCH citizen_id`) passed after the fix; a legitimate own-row
   `full_name` update was re-verified unaffected. Both a temporary student and
   admin test user were deleted afterward; `profiles` confirmed back to 0 rows.
2. `0006_lock_trigger_only_functions.sql` — Supabase's security advisor
   flagged `handle_new_user`, `set_updated_at`, `prevent_role_self_escalation`,
   and `prevent_citizen_id_change` as directly callable via
   `/rest/v1/rpc/<name>` by `anon`/`authenticated`, despite existing only to
   run as triggers. Revoked `EXECUTE` from both roles on all four; re-verified
   the signup trigger still fires correctly (a fresh test user still got its
   `profiles` row auto-created). `current_role()` and `get_citizen_id()` were
   left callable — the former is a harmless self-lookup, the latter already
   fails closed to non-admins.

`types/database.ts` regenerated from the live schema (was hand-written
before). `NEXT_PUBLIC_SUPABASE_ANON_KEY` renamed to
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` across `lib/supabase/*.ts` to match
Supabase's current key format; `.env.local` holds the real project
credentials (git-ignored). `@supabase/server` (v1.4.1) installed for the
future Edge Functions phase, plus its agent skill — not wired into any
handler yet, so it is a temporarily-unused dependency by design (§21
trade-off, noted here rather than left unexplained).

**Real dashboard data (§30.7, corrected count)** — the ❌ item previously said
"12 remaining §20 tables"; the real count is **10** (`roles` was folded into
the `user_role` enum, and `departments`/`clubs` already existed). Of those 10,
the dashboard reads exactly 6 — `activities`, `attendance`, `projects`,
`documents`, `document_drafts`, `notifications` — created in
`0007_dashboard_tables.sql`, RLS'd in `0008_dashboard_rls.sql` (transcribing
the contract already stated in `lib/auth/permissions.ts:108-127`), with two
`SECURITY INVOKER` aggregate RPCs (`get_activity_stats()`,
`get_member_stats()`) in `0009_dashboard_stat_rpcs.sql`. `project_drafts`,
`qr_sessions`, `signature_records`, `audit_logs` are the other 4 — deferred to
their own §30.10 phases, not created here.

`attendance` carries §15 sensitive columns (GPS, IP, device fingerprint) and
got the same column-allow-list treatment `0005` gave `citizen_id` — verified
live: a real student JWT hitting `attendance?select=*` gets `42501 permission
denied`, `select=id,status` succeeds. `notifications.recipient_id` is
nullable for broadcast/announcement rows (§16); verified a student session
sees the 3 seeded broadcast notifications via `select=*`. Anon visibility
verified too: `activities?select=*` returns only `is_public = true` rows,
`projects?select=*` returns only `status = 'official'` rows. Both RPCs
verified callable over REST by an authenticated student.

`services/dashboard.ts` and `services/members.ts` rewritten to real Supabase
queries — no fixture path remains, `lib/dev-fixtures.ts` deleted entirely.
`services/members.ts` lost its `MEMBERS_TABLES_READY` flag and `throw` stubs.
`getMemberStats` gates reviewers via `can(role, "project:draft:review")`
(updated again in the role-split phase below — was a direct
`role === "teacher" || role === "admin"` comparison until then, which the
role split would have silently broken) and lets `requirePermission`'s
`redirect()` propagate uncaught, since it is a Next.js control-flow signal
that must not be swallowed by a `.catch()` — an early draft of this got that
wrong and was caught before shipping.

`supabase/seed.sql` extended with demo activities/projects/documents/
notifications. `attendance` was **deliberately left unseeded** — every row
has a `NOT NULL` FK to `profiles`, and no real student accounts exist outside
transient test users created and torn down during verification; attendance
rows arrive naturally once §13 QR attendance is live. `document_drafts` was
also deliberately left empty, to exercise a genuine empty state — the old
`lib/dev-fixtures.ts` comment claiming this had never actually been true (see
the Members section above).

**End-to-end magic-link sign-in, proven in the browser** — confirmed via the
Supabase auth logs (`get_logs(service: "auth")`), not just asserted:
`mail.send` (magic_link) → `/verify` `303` → `"action":"login",
"login_method":"pkce","provider":"magiclink"` for a real `@udontech.ac.th`
address, landing through `/th/auth/callback`. The redirect URL
(`http://localhost:59500/**`) is confirmed added to Auth → URL Configuration
since this succeeded.

Also surfaced by the same logs: Supabase's default built-in email sender
(`noreply@mail.app.supabase.io`) has a very low rate limit — repeated
`/otp` calls in a short window return `429 over_email_send_rate_limit`. This
is expected dev-mode behavior, not a bug; it resets roughly hourly. Before
any real user traffic, configure a custom SMTP provider (Authentication →
Email → SMTP Settings) — the shared mailer is not meant to serve production
volume.

**Login hardening: Turnstile, SMTP, the §14 allow-list, the อวท. role split
(migrations `0010`–`0012`)** — `user_role` gained `aft_teacher` (อาจารย์
อวท.), added as its own migration (`0010`) since PostgreSQL forbids using a
new enum value in the same transaction it was added in. `0011` adds
`approved_accounts` (admin-only RLS — a signup roster, not app data) and
rewrites `handle_new_user()` to enforce the rule directly, not just in the
Server Action (§19): a numeric-local-part `@udontech.ac.th` address (§14
student ID) must have a matching `approved_accounts` row or the trigger
raises and the whole `auth.users` insert rolls back; a named staff address
signs up freely as `teacher`. Verified live: an unapproved numeric address
(`69319010001@…`) got `500 P0001 "account not approved: …"` from
`signInWithOtp` itself (the OTP request creates `auth.users` immediately,
firing the trigger — rejection is not deferred to magic-link verification),
and confirmed **zero** `profiles` row resulted. The pre-approved demo
student (`69319010099@…`) succeeded and its `profiles` row got the correct
role, `student_id`, and generated `academic_year` automatically.

Every `0008` reviewer policy (`attendance`/`projects`/`documents`/
`document_drafts` SELECT) extended to include `aft_teacher`; new UPDATE
policies added for `aft_teacher` on `projects`/`documents` (approval
authority) and INSERT/UPDATE on `activities`. All verified live with a real
`aft_teacher` JWT: reviewer SELECT works, an actual project approval
(`teacher_review` → `official`) succeeded and was reverted after, role
self-escalation still blocked, and `approved_accounts` correctly returns
empty (RLS has no policy granting it anything — not even a permission
error, just zero rows, which is correct RLS behavior for "no applicable
policy" vs. an outright SQL-level deny).

**A second self-caused regression, caught the same way as the first:**
`0011`'s `create or replace function handle_new_user()` silently reset the
function's grants to the PostgreSQL default (`PUBLIC EXECUTE`), undoing
`0006`'s revoke — confirmed via `information_schema.role_routine_grants`
immediately after applying `0011`, and independently by the security
advisor re-flagging `handle_new_user` the moment it ran. `CREATE OR REPLACE`
does not preserve prior `REVOKE`/`GRANT` state the way one might assume.
Fixed in `0012`; re-verified the advisor no longer flags it and a fresh
signup still fires the trigger correctly.

`lib/auth/permissions.ts` gained `aftTeacherPermissions` (teacher's list +
`project:approve` + `document:approve` + `activity:manage`) between teacher
and admin. The three hard-coded `role === "teacher" || role === "admin"`
reviewer checks (`services/dashboard.ts`, `draft-documents-card.tsx`,
`dashboard/page.tsx`) — which the new role would have silently broken, since
an `aft_teacher` is not literally `"teacher"` — replaced with
`can(role, "project:draft:review")`, the existing predicate every role above
student already holds.

New admin-only `/approvals` page (`app/[lang]/(app)/approvals/`) to manage
`approved_accounts` — add/revoke, gated on `member:manage` both in the nav
filter and re-checked server-side in the page and every Server Action (§19).
Four demo accounts (one per role, `student` via the allow-list to exercise
the full §14 path) created via the Admin API; credentials in
`.demo-accounts.local.md` (git-ignored) with a documented teardown snippet —
those passwords work for API testing only, since the app is magic-link-only
and the demo addresses have no real inbox.

Turnstile wired into the login form (`@marsidev/react-turnstile`), gated on
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` being set — renders no widget at all
locally until Cloudflare is configured, same dev-fallback pattern as
`isSupabaseConfigured`. **Accepted regression, not fixed:** a CAPTCHA token
cannot be produced without JavaScript, so §30.9 item 3 ("submit with JS
disabled, still rejected") now only holds for the *validation* half — a
`gmail.com` address is still rejected server-side via `signIn`'s Zod
re-validation with JS off, but the submission can no longer *complete* with
JS off once Turnstile is live, because the token itself requires it. This is
inherent to CAPTCHA and was not engineered around.

**Local dev now shows the real widget**, via `lib/turnstile.ts` and
Cloudflare's documented always-pass testing sitekey in `.env.local`
(`1x00000000000000000000AA`) — no Cloudflare account needed to see or test
the login form's CAPTCHA step. This introduced a new risk that didn't exist
when the sitekey was simply unset: a test key reaching production would
defeat the CAPTCHA more convincingly than a missing one. Closed with
`assertTurnstileSafeForProduction()`, called at the top of `signIn`, which
throws when `NODE_ENV === "production"` and the sitekey is either unset or a
known Cloudflare test key — deliberately placed in the Server Action rather
than at render time, since `next build` runs with `NODE_ENV=production` and
would otherwise fail local production builds the moment the test key is
present.

**Deploy-time guard for this class of misconfiguration** —
`lib/env-guard.ts`'s `assertDeployEnvConfigured()`, called from
`next.config.ts`, fails `next build` outright when `VERCEL_ENV ===
"production"` and either Supabase `NEXT_PUBLIC_*` var is missing, or
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is missing or a Cloudflare test key (reusing
`lib/turnstile.ts`'s `isTurnstileTestKeyValue()`, exported for this purpose).
Gated on `VERCEL_ENV`, not `NODE_ENV`, since `next build` runs locally with
`NODE_ENV=production` against `.env.local`'s test key and must keep
succeeding — verified by running the guard against both a Vercel-shaped
production build (throws, combined message listing every missing/invalid
var) and the local build (passes). `assertTurnstileSafeForProduction()`'s
runtime throw in `signIn` stays as the fail-closed last resort; the guard
means it should now never be reached.

**Live Vercel deployment login fixed and verified end-to-end** — project
`test-claude` (Vercel team `ka-600a`), domain
`test-claude-swart-delta.vercel.app`. The three external-dashboard blockers
this section previously described as unfixable without browser access were
closed this pass using Chrome automation:

1. **Vercel env vars + redeploy** — `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   (a real Cloudflare sitekey, not a test key), plus the four unprefixed
   `SUPABASE_*` vars for the future Edge Functions phase, are set on
   Production + Preview, and a cache-free redeploy picked them up — confirmed
   by the Turnstile widget actually rendering on `/th/login` in production
   (previously absent) and `gmail.com` now getting the friendly Thai
   rejection message with **no 500** (previously digest `3705566263`).
2. **Supabase → Authentication → URL Configuration** — the production
   redirect URL (`https://test-claude-swart-delta.vercel.app/**`) was already
   present alongside `http://localhost:59500/**`.
3. **A second, previously-undiscovered blocker** — Supabase → Authentication
   → Sign In / Providers → "Allow new users to sign up" was toggled **off**
   at the project level. This blocks every first-time magic-link sign-in
   (student, teacher, or admin) before the app's own `handle_new_user()` /
   `approved_accounts` gating logic ever runs, independent of the
   `signInWithOtp` captcha token or redirect URL being correct — confirmed
   live via `get_logs(service: "auth")`: `422 signup_disabled "Signups not
   allowed for this instance"` on `POST /otp` from the production origin.
   Re-enabled after explicit user confirmation, since it's a real
   security-relevant Supabase setting, not a code change; safe to enable
   because the actual gate is the app's own trigger (§19), which already
   enforces the §14 numeric-local-part → `approved_accounts` rule.

**Send path proven once, cleanly, immediately after both fixes.**
`69319010099@udontech.ac.th` (previously deleted per the demo-accounts
teardown script, so this exercised a genuine new-signup path): `POST /otp`
returned `200`, `mail.send` (`confirmation` — a fresh signup needs
re-confirmation) fired from the production referer, and the login form showed
its "check your email" success panel. This is the evidence that both fixes
above actually work, not just that the build stopped 500ing.

**A later pass pushed a separate build-guard commit and tried to close the
last gap — the full click-through — against the resulting new deployment
(`bc21a28`), but did not complete it.** `auth.one_time_tokens` is readable
via the Supabase MCP, and the pending row after a genuine production
submission carries the real PKCE hash Supabase would have emailed —
rebuilding `.../auth/v1/verify?token=<hash>&type=...
&redirect_to=.../th/auth/callback` and opening it in the *same browser* that
submitted the form (the `code_verifier` cookie must match) exercises the
actual deployed code path, unlike an admin-generated link (implicit flow, no
`?code=`, which `route.ts` rejects) — a workable technique, but three things
went wrong in the same session, none of them a deployment bug:

1. A fresh send to `demo.admin@udontech.ac.th` failed outright with
   `400 email_address_invalid` — the address has accumulated enough failed
   deliveries (no real inbox, reused across sessions) to be flagged
   undeliverable by Supabase. No token was created to replay.
2. Replaying the one available token — the `69319010099` one from the
   send-path proof above, by then ~44 minutes old — got partway: `/verify`
   itself succeeded (`303`, `user_signedup`), but the callback's
   `exchangeCodeForSession` failed with `422 flow_state_expired`. Supabase's
   server-side PKCE flow state has a much shorter TTL than the emailed token
   itself; the technique only works within roughly a minute of the token's
   creation, not saved for later.
3. A fresh attempt with `demo.teacher@udontech.ac.th`, meant to get a
   same-session token to replay immediately, instead hit
   `429 over_email_send_rate_limit` — the documented default-mailer ceiling
   (see ❌ Remaining), exhausted by this session's own testing on top of the
   proof above.

Net effect: the send path has **not** been re-confirmed on this specific
`bc21a28` build — only on the immediately preceding one — though nothing in
the guard commit touches runtime auth logic, so there's no specific reason to
expect it behaves differently.

**The build guard itself did get a live production test in the process** —
`bc21a28`'s Vercel build passed `assertDeployEnvConfigured()` against the
real production env vars, its first real run outside the two simulated local
ones.

**§30.9 item 3 (JS-disabled server enforcement) proven by exact HTTP replay** —
production's login form genuinely server-renders a no-JS-compatible form
(`curl` on `/th/login` returns `<form action="" encType="multipart/form-data"
method="POST">` with hidden `$ACTION_REF_1`/`$ACTION_1:0`/`$ACTION_1:1`/
`$ACTION_KEY`/`lang` fields — exactly what a JS-disabled browser posts, no
Turnstile token possible since the widget never renders without JS). Replayed
that exact multipart POST twice against the live deployment: `email=
student@gmail.com` returned `{"ok":false,"messageKey":"personalDomain"}` (the
Thai "use your college email" message); `email=someone@udontech.ac.th` with no
captcha token returned `{"ok":false,"messageKey":"captchaFailed"}` — confirming
`actions/auth.ts` validates the domain (L57-62) before the captcha check
(L64-70), so the domain rule survives Turnstile with JS off. Corroborated via
`get_logs(service: "auth")`: zero auth events in the 5 minutes spanning both
POSTs, proving neither request reached Supabase's `/otp` — the rejection
happened entirely in the Server Action. The accepted regression from the
Turnstile section above still holds precisely: validation-with-JS-off works,
*completion* (an approved address, past the captcha gate) does not, since a
token cannot be produced without JavaScript.

**Custom SMTP configured (Resend), pending domain verification** — Supabase →
Authentication → Emails → SMTP Settings now points at
`smtp.resend.com:465`, sender `noreply@udontech.ac.th` ("AFT UDONTECH"),
username `resend`; the API key was pasted directly into the dashboard by the
user, never handled by this session or written to any file. Saved and
confirmed persisted. `udontech.ac.th` was added as a domain in Resend
(DNS host detected as Cloudflare) but is **not yet verified** — a live send
attempt through it failed with `550 "The udontech.ac.th domain is not
verified. Please, add and verify your domain on
https://resend.com/domains"`, confirmed via `get_logs(service: "auth")`. The
required DKIM/SPF/MX DNS records were generated and the domain is in
Resend's "Pending" / "Looking for DNS records" state, which per Resend's own
UI can take minutes to hours depending on Cloudflare propagation. Until it
verifies, custom SMTP is misconfigured from Supabase's perspective — every
send attempt through it fails outright with a 500, it does **not** silently
fall back to the default mailer.

**§30.9 items 4 & 7 (375/768/1280px responsive, Thai heading check) proven —
`resize_window` replaced with real viewport emulation.** The prior pass's
plan to close this with `resize_window` was itself wrong: confirmed
`window.innerWidth` ignored every resize request (stayed 1920, then read
2400 on a fresh tab), so this pass built `scripts/responsive-check.mjs`
instead — zero new dependencies, driving the machine's already-installed
Chrome directly over the raw DevTools Protocol (`WebSocket` is a Node 22+
global). `Emulation.setDeviceMetricsOverride` performs genuine viewport
emulation, unlike the extension-based resize: `window.innerWidth` is
asserted against the requested width on every single measurement, so a
future silent-no-op is a hard failure, not a false pass. A self-test proves
the checker can actually detect a defect — it injects a deliberate
3000px-wide element before the real run and fails loudly if that isn't
caught. Authenticated pages (`/th/dashboard`, `/th/members`, `/th/projects`,
`/th/reports`, `/th/notifications`, `/th/profile`, `/th/approvals`) are
reached via the Supabase Admin API (`auth.admin.generateLink` +
`verifyOtp`, using `SUPABASE_SECRET_KEY`) rather than a password —
`signInWithPassword` was tried first and rejected with `captcha protection:
request disallowed`, since the project-level Turnstile requirement applies
to every public auth endpoint, not just the ones the app sends a token on;
the Admin API is exempt by design, which is what a service-role key is for.

Full matrix run: 3 widths (375/768/1280) × 2 themes (light/dark, via
`Emulation.setEmulatedMedia`) × 14 pages (7 public + 7 authenticated) = 84
combinations. **Found and fixed one real defect on the first run**: `/en`
(English locale) overflowed horizontally at 768px in both themes
(`scrollWidth=900 > clientWidth=768`) — `/th` passed at the same width,
since Thai nav labels are narrower than their English equivalents. Root
cause: `components/layout/top-nav.tsx` and `mobile-nav.tsx` switched
between the desktop nav and the mobile hamburger at Tailwind's `md`
breakpoint (768px) — the exact width where English labels no longer fit.
Fixed by moving both switch points to `lg` (1024px), so the compact
hamburger nav covers the tight 768–1023px range in either language. Re-ran
after the fix: all 84 combinations pass. Screenshots captured at 375px both
themes for every page confirm Thai tone marks and vowels render without
clipping at heading sizes (§30.9 item 7) — verified visually, e.g. the
dashboard's "สวัสดีตอนเย็น" / "ปฏิทิน" headings. `npm run check:responsive`
re-runs this against `BASE_URL` (defaults to the dev server); output is
gitignored (`.responsive-check-out/`), and `eslint.config.mjs` was extended
to exclude that directory too — its first run pulled in Chrome's own
throwaway-profile extension internals as 5000+ false lint warnings before
the ignore was added.

**Login was completely broken on a second live production URL — found and
fixed.** The Vercel project has two working production domains:
`test-claude-swart-delta.vercel.app` (the one every previous pass tested)
and `test-claude-ka-600a.vercel.app` (Vercel's automatic team-scoped alias —
not something explicitly added in Vercel → Domains, but a fully public,
always-live URL for the same deployment). Checked the second domain in the
browser: the homepage renders fine, but `/th/login` failed outright —
Cloudflare Turnstile logged `[Cloudflare Turnstile] Error: 110200` (domain
not allowed for this sitekey) and rendered "Unable to connect to website"
instead of the widget, so `isTurnstileConfigured` was true but no token
could ever be produced — every submission hit `captchaFailed`
unconditionally, on every address, with no way around it. Root cause:
Cloudflare Turnstile → the `claude` widget's Hostname Management had only
`test-claude-swart-delta.vercel.app` registered — 1 of the 10 hostname
slots available. Fixed by adding `test-claude-ka-600a.vercel.app` and
`localhost` (also previously missing, needed for local dev testing)
directly in the Cloudflare dashboard. Verified live: reloaded `/th/login` on
`test-claude-ka-600a.vercel.app` after the change propagated (~10s) and the
widget now shows "Success!" with no console errors. This was a pure
Cloudflare-dashboard fix — no code or env var changed, `.env.local`'s
sitekey was already correct since both domains share the one widget.

**`/calendar`, `/activities`, `/documents` — real pages, no longer "coming soon"
placeholders.** All three were 23-line `PageShell` stubs linked from the top
nav for every role including guest; now each is a real, RLS-backed page.

`supabase/migrations/0013_documents_ebook.sql` adds `description`,
`flipbook_url`, `cover_url`, `published_at` to `public.documents`, plus a
`CHECK` constraint restricting `flipbook_url` to the AnyFlip host pattern —
the third of the three validation layers §19 asks for (Zod in
`schemas/documents.ts` / `lib/anyflip.ts` on the app side, this constraint as
the database backstop). Verified live, not just written: attempted
`update documents set flipbook_url = 'https://evil.example.com/x'` directly
via SQL and got `23514 violates check constraint` — the guard actually
refuses, not merely exists. No RLS change needed; `documents_select_official`
(`0008_dashboard_rls.sql`) already scopes anon/authenticated correctly, and
the new columns are public book metadata, not sensitive.

**Documents e-books come from AnyFlip embed links**, confirmed by the user
during planning rather than self-hosted PDFs. `lib/anyflip.ts` is the single
source of truth for what counts as a valid embed URL
(`isAnyFlipEmbedUrl`/`toAnyFlipEmbedUrl`), imported by both the write-time
Zod schema and the reader's iframe component — a URL that fails the check
renders the "book not attached" empty state, never reaches an iframe `src`.
Three demo `documents` rows were seeded as `official` (`supabase/seed.sql`
and applied live): one carries a **real AnyFlip book URL, verified reachable
via `WebFetch` at authoring time** (`https://anyflip.com/aasdd/luel/`, a
public "calendar 2026-example" flipbook) so the reader is provably rendering
a real, live third-party embed end-to-end, not a placeholder; the other two
have no `flipbook_url`, deliberately exercising the "book not attached" empty
state. Cover images are schema-ready (`cover_url` column exists) but **not
rendered this pass** — no real thumbnail URL scheme for AnyFlip covers is
documented, so every book on the shelf shows a designed placeholder cover
instead (gradient card, book icon, title — gradient angle deterministic per
title so a shelf of several books doesn't look like one card repeated, colors
drawn only from existing `--primary`/`--brand-ink` tokens, no new hues per
§3). `docs/add-ebook.md` documents how to attach a real book via the Table
Editor, since there is no admin upload form this pass — not asked for.

**`/activities` got the full §10 treatment**: search (300ms debounced, reusing
`hooks/use-debounced-value.ts`), Department/Club/Academic-Year filters,
sortable columns, 10-rows/page pagination, and an
Attendance/Completed/Pending statistics strip — built as a near-exact mirror
of the already-proven Members module (`schemas/activities.ts`,
`services/activities.ts`, `components/activities/`), reusing
`getDepartments()`/`getClubs()` from `services/members.ts` rather than
redefining them. Each filter `Select`'s `SelectValue` was given the
`children` render function from the start — the exact Base UI defect
(`__all__` displayed literally) that bit the Members filters earlier in this
project was checked for directly in a screenshot and confirmed absent
("ทุกแผนก"/"ทุกชมรม"/"ทุกปี" render correctly). Completed/Pending stat tiles
double as filters (`<Link>`s setting `?status=`), so no fourth dropdown was
needed and it still works with JS disabled.

**Guest vs. signed-in visibility verified live via REST, not assumed from
reading the RLS policy.** Anon `activities?select=id` returns exactly the 3
`is_public = true` rows (of 6 total); anon `documents?select=id,status`
returns exactly the 3 seeded `official` rows. The `/activities` page itself
was checked the same way with `curl` (no cookies = genuine guest): the stats
strip reads `0 / 1 / 2` (attendance / completed / pending) and the table
shows exactly those 3 public activities — `attendance` reading 0 is correct
and by design (empty table, see existing ❌ item below), not a bug, and the
UI copy says so. `?status=completed` correctly narrows to the 1 public
completed row; `?sort=title&dir=desc` correctly reverses table order; an
invalid `dept=` UUID falls back to "no filter applied" (200, all 3 rows) via
the same `.catch(null)` pattern as Members, rather than erroring — the exact
`z.uuid()` trap recorded earlier in this file was checked for directly this
time. `/en/activities` renders "Activities" correctly.

**`/calendar`** is a real, URL-driven (`?month=YYYY-MM`) month view —
`MonthNav`'s prev/today/next are plain `<Link>`s, so navigation works with JS
disabled, verified with `curl`: `?month=2026-09` renders "กันยายน 2026", and a
garbage `?month=` value falls back to the current month ("สิงหาคม 2026")
rather than erroring. `MonthGrid` extends the existing dashboard
`calendar-card.tsx` pattern into a full 7-column grid with per-day event
chips, hidden below `md` in favor of `MonthEventList` — a linear date/time/
title/location list — since a 7-column grid has no usable room at 375px.

**`components/table/pagination.tsx`** — `members-pagination.tsx` was moved
here (not copied) since Activities needed the identical control; its three
dictionary keys moved from `members.*` to `common.pagination.*` in both
`th.json`/`en.json`. Members' own pagination behavior is unchanged, verified
by the responsive-check pass below still covering `/th/members` cleanly.

**A real, previously-undetected production bug was found and fixed while
verifying this work: the app has never had a `<meta name="viewport">` tag.**
Discovered because `scripts/responsive-check.mjs`'s 375px mobile-emulation
pass, which had been recorded as 84/84 passing in an earlier pass of this
file, suddenly failed on every single page in both themes with
`window.innerWidth` reporting `981` instead of `375`. Isolated with a minimal
standalone CDP script: `screen.width`/`outerWidth` correctly reported the
overridden `375`, but `innerWidth` stayed at `981` — the classic ~980px
"desktop site on mobile" fallback layout viewport that real mobile browsers
apply to any page lacking a viewport meta tag. `curl`-ing the live dev server
confirmed it: zero `<meta ... viewport ...>` tags in the rendered `<head>`.
This is not a Chrome DevTools artifact — it means every real phone visiting
this site has been rendering the whole page at a fixed 980px width and
scaling it down, the entire time, on every route. Fixed by adding
`export const viewport: Viewport = { width: "device-width", initialScale: 1
}` to `app/[lang]/layout.tsx` (Next.js does not inject this automatically —
a common assumption checked and found false here). Re-verified: `curl`
against the dev server now shows the tag; the full responsive-check matrix —
**3 breakpoints × 2 themes × 15 pages (90 combinations, including the four
new/changed pages and the new `/th/documents/<id>` reader route) — passed
clean**, and 375px screenshots for all three new pages were visually
inspected in both themes (Thai tone marks/vowels render without clipping,
matching §30.9 item 7's existing bar).

`npx tsc --noEmit && npm run lint && npm run build` all pass clean, including
the new dynamic `/[lang]/documents/[id]` route. `types/database.ts`
regenerated live from the schema after `0013` (was previously stale by one
migration).

**Full magic-link round trip on the live Vercel deployment — finally
observed, end to end, after four prior passes fell short.** Resend's DNS
verification is still not finished (`resend._domainkey.udontech.ac.th`
returns no record at all, confirmed via direct DNS lookup this pass — not
inferred from a dashboard screenshot), so custom SMTP would still fail exactly
as before. Two things were tried first and ruled out on the record, not
assumed: (1) `auth.admin.generateLink()` (bypasses email entirely) — opening
the resulting `action_link` in a real browser landed on `/th/login?error=auth`
with tokens stuck in the URL fragment, because Admin-API links use Supabase's
**implicit** flow while `/th/auth/callback` only handles **PKCE** (`?code=`),
which requires a `code_verifier` cookie only a genuine form submission can
set — this is the same limitation the previous pass already suspected, now
directly reproduced rather than assumed true. With user confirmation, (2)
custom SMTP was temporarily disabled (Authentication → Emails → SMTP
Settings), falling back to Supabase's built-in mailer — the Magic Link
template was confirmed to be Supabase's unmodified default before doing this,
so nothing custom was at risk of being lost by the switch.

With that in place, the real login form was submitted on
`test-claude-swart-delta.vercel.app/th/login` for `demo.teacher@udontech.ac.th`
— real Turnstile pass, real "check your email" panel. `auth.one_time_tokens`
was read immediately after (`token_hash` carries a `pkce_`-prefixed value;
the full prefixed string, not the hash alone, is what `/auth/v1/verify`'s
`token=` param expects — a first attempt stripping the prefix got
`403 otp_expired`, corrected on the second attempt) and the reconstructed
`.../auth/v1/verify?token=pkce_...&type=magiclink&redirect_to=.../th/auth/callback`
URL was opened in the *same* browser tab that submitted the form, so its
`code_verifier` cookie matched. Landed on `/th/dashboard`, authenticated,
correct role rendering ("อาจารย์" / Teacher) in the welcome card and nav.
Corroborated three independent ways, not just the page render: `auth.users`/
`profiles` show `last_sign_in_at = 2026-08-02T16:52:54Z` for `demo.teacher`
(previously `NULL`); `get_logs(service: "auth")` shows the full sequence —
`mail.send` (`mail_from: noreply@mail.app.supabase.io`, `mail_type:
magic_link`) at `16:51:42`, a `403 Email link is invalid or has expired` on
the first (wrong-token) `/verify` attempt at `16:52:22`, then a successful
`login` auth_event and `200` on `/user` at `16:52:54`; and a subsequent
`logout` event once signed out in-browser to leave no lingering session.

**Known side effect, current state, not yet reversed:** disabling custom
SMTP in the Supabase dashboard did not just pause it — it **cleared the
saved Resend host/sender/port and password from the form entirely**.
Re-enabling the toggle now shows blank placeholders, not the prior values.
The Resend SMTP password was originally typed directly into the dashboard by
the user and was never available to this session (per the standing
credential-handling rule), so it cannot be restored here. **Production is
currently sending through Supabase's default built-in mailer** (rate-limited
to ~2 emails/hour) rather than Resend — functionally this is a wash, not a
regression, since Resend still can't send until its domain verifies anyway;
the default mailer at least lets a real user complete a real sign-in today,
which Resend's broken config did not. Re-entering the Resend credentials and
re-enabling custom SMTP is a manual step for whenever the user is ready — see
❌ Remaining.

**Security/performance/bug-hunt pass over the whole app** — a systematic
check, not a single fix. What was checked and found clean, so it isn't
re-litigated next time someone asks "is this secure": no `dangerouslySetInnerHTML`/
`eval`/`new Function` anywhere in `app`/`components`/`lib`/`services`; no
`select("*")` anywhere (grep-verified, not just convention-by-comment); every
file in `services/` carries `server-only`; no Client Component in the new
`components/activities|calendar|documents/` trees except the one that
genuinely needs interactivity (`activities-filters.tsx`) — `calendar/` and
`documents/` are 100% Server Components, matching §21/§23; the AnyFlip
`<iframe sandbox>` flags (`allow-scripts allow-same-origin allow-popups`,
deliberately no `allow-top-navigation`/`allow-forms`/`allow-modals`/
`allow-downloads`) were checked against the actual threat model rather than
pattern-matched against "scripts+same-origin is always bad" — that combo is
a real escape risk only when the sandboxed content shares an origin with the
host page, which AnyFlip does not, so it was left as-is rather than
weakened on a false alarm; the `search` inputs on both Members and Activities
already escape `%`/`_` before `.ilike()`, so no wildcard-injection path
exists. Two real, small issues were found and fixed: `schemas/documents.ts`
exported an unused `flipbookUrlSchema` (dead code — no admin write form
exists yet to call it) — removed. `public.activities.club_id` had no index
despite `department_id` (the same kind of FK, same table, same filter
pattern) having one since `0007` — added
(`0014_activities_club_index.sql`).

Ran Supabase's own advisors (`get_advisors`, both `security` and
`performance`) rather than relying on manual review alone. Most SECURITY
DEFINER-function warnings (`prevent_role_self_escalation`, `set_updated_at`,
`prevent_citizen_id_change` flagged as anon/authenticated-executable) turned
out to be a **stale advisor cache, not a live regression** — verified
directly against `information_schema.role_routine_grants`, which returned
zero rows for `anon`/`authenticated`/`public` on those three functions,
confirming `0012`'s revoke is still correctly in effect. Worth knowing: the
advisor output can lag behind reality, so a finding from it should be
confirmed against the actual grant/policy state before acting on it, exactly
as done here. Four more `unindexed_foreign_keys` findings were real and cheap
to fix, so they were (`activities.created_by`, `approved_accounts.approved_by`,
`approved_accounts.department_id`, `document_drafts.created_by` —
`0015_missing_fk_indexes.sql`). "Leaked password protection" (checks new
passwords against HaveIBeenPwned) is flagged and genuinely disabled, but is
**Pro-plan-gated on this project's Free tier** — confirmed in the dashboard,
not assumed; not fixable without a paid-plan upgrade, which is a billing
decision for the user, not something to change unilaterally.

Two categories of finding were deliberately **not** acted on this pass,
documented below rather than either silently skipped or rushed: rewriting
~10 RLS policies for the `auth_rls_initplan`/`multiple_permissive_policies`
advisories, and adding CSP headers. Both are real, but both are the kind of
change where a rushed, unverified attempt is worse than the problem it
fixes — see ❌ Remaining for why and what a correct fix would need.

**§11 Projects workflow and §12/§17 Documents digital-signature workflow —
both fully built (commits `03f19e4`/`8260e14`), documented here only now
because this file was never updated alongside that pass. Recovered by
reading the actual code/migrations/git history in this pass, not because it
was built in this pass — flagging that distinction plainly rather than
implying otherwise.**

**Projects (§11)**: `Draft → Teacher Review → Admin Approval → Official`,
built directly on the existing `projects` table's `status` enum rather than
a separate `project_drafts` table — a deliberate deviation from §20's literal
table list, the same "one table, a status column, not a second draft table"
shape `document_drafts` already uses for the parallel half of this pattern.
`/projects/new` (create), `/projects/[id]` (detail), `/projects` (the
owner's own list), and `/projects/review` (the reviewer queues) are real
pages, not `PageShell` stubs — `services/projects.ts`, `actions/projects.ts`,
`schemas/projects.ts`, `components/projects/*`. `/projects/review` shows two
independently-paginated/sorted queues (teacher-review, admin-approval),
gated per-queue on `project:recommend`/`project:approve` respectively via
`requireAnyPermission`. `0016_project_document_workflow_tables.sql` adds a
`rejected_reason` column; `0017_project_document_workflow_rls.sql` adds the
owner/teacher RLS policies this needed (previously only admin/aft_teacher
could touch these tables at all). Illegal status jumps (e.g. `draft` straight
to `admin_approval`, skipping review) are blocked by a dedicated trigger,
`enforce_project_status_transition()` (0016) — RLS policies alone cannot
express "the OLD status must have been X" (a `WITH CHECK` clause only ever
sees the NEW row, and Postgres OR-combines multiple permissive policies'
`USING`/`WITH CHECK` clauses independently of each other), so a caller could
otherwise mix one policy's permissive `USING` with a different policy's
permissive `WITH CHECK` to skip a stage even though no single policy
actually allows that exact transition — the trigger is what actually closes
that gap, not RLS.

**Documents (§12/§17)** additionally gets the full digital-signature step:
`Draft → Sign → Pending Approval → Official`. Signing is
`components/documents/signature-flow.tsx` + `signature-pad.tsx`
(`react-signature-canvas`, the Phase-1-deferred dependency finally landing
here) implementing the exact §17 sequence — draw → preview → confirm → type
"ยืนยัน" → save — at `/documents/manage/[id]/sign`, re-checking server-side
that the caller is the document's owner and it's still `status = 'draft'`
before rendering the form at all. The save itself calls a new
`sign_document()` Postgres function (0016, `security invoker` — explicitly
not `security definer`, since this is a transaction wrapper around two
statements that must still run under the caller's own RLS privileges, not a
privilege escalation) that atomically inserts into a new `signature_records`
table (one of the four tables §20/§30.10 had deferred; `document_id`,
`signer_id`, `signature_data` as a plain text column holding the canvas's
`toDataURL()` PNG — no Supabase Storage bucket needed for a value this
small) and flips `documents.status` from `draft` to `signed`, in that
order specifically (inserting the signature first is required by
`signature_records`'s own RLS insert policy, which requires the parent
document to still read `status = 'draft'` at insert time — updating status
first would make the insert fail its own check). The same
old-status-vs-new-status trigger pattern as Projects
(`enforce_document_status_transition()`, 0016) blocks skipping the sign step
by combining `documents_update_own_draft`'s permissive `USING` with a
different policy's permissive `WITH CHECK` for `pending_approval`.

**Live-verification status unknown, not re-verified in this pass**: because
this work was never logged here, there is no record of whether the original
pass ran this project's usual live-proof discipline (role-matrix RLS checks,
a real signature round-trip against the hosted Supabase project) against it.
Treat it as code-reviewed-and-present, not as proven live, until a pass
confirms it against the real database the way `0005`/`0008`/`0011` are
already proven above.

**Sign-up flow replaced: `pending` role + post-signup admin approval,
superseding the `0010`–`0012` pre-approval allow-list above.** The old
design required a numeric-local-part (§14 student-ID) address to already be
on `approved_accounts` *before* it could sign in at all, rejected otherwise
with `"account not approved"`. `0019_add_pending_role.sql` adds `'pending'`
to `user_role` (its own migration — same PostgreSQL constraint that made
`0010` add `aft_teacher` separately: a new enum value can't be used in the
transaction that adds it). `0020_pending_signup_flow.sql` rewrites
`handle_new_user()` so every signup — numeric student ID or named staff,
magic link or Google — lands `role = 'pending'` unconditionally, drops the
`approved_accounts` lookup and rejection path, re-revokes `EXECUTE` on the
replaced function in the same migration (the exact `0011`→`0012` trap
documented above — `create or replace` resets grants to `PUBLIC EXECUTE`,
and skipping the re-revoke would silently reopen it), and drops the
`approved_accounts` table itself, since nothing else read it.

`pending` sits at guest-level permissions (`lib/auth/permissions.ts`) —
public content only, no `workspace:access` — so every existing
`requirePermission()` guard already excludes it with no new policy needed.
What *did* need a change: `requirePermission`/`requireAnyPermission`
(`lib/auth/require-role.ts`) previously redirected anyone lacking a
permission to `/login`; a `pending` user hitting that would have bounced
back to a login they just used, an obvious broken-loop. Added
`deniedRedirectTarget()` to send `pending` to a new `/pending` page instead
— "your account is awaiting approval" — while every other role still goes
to `/login` as before. `app/[lang]/auth/callback/route.ts` makes the same
distinction right after exchanging the session, so a fresh signup lands on
`/pending` immediately rather than bouncing through `/dashboard` first.

`/approvals` (still gated on `member:manage`, unchanged) is repurposed from
"add a pre-approved email" to "here is everyone waiting, assign their
role": `services/profiles.ts` replaces `services/approvals.ts`
(deleted, along with `types/approvals.ts` and the two components built
around the old add/revoke form), reading `profiles` directly rather than
the now-dropped `approved_accounts` table. No new RLS was needed for this
either — `profiles_select_admin`/`profiles_update_admin` (`0002`) already
grant an admin unconditional read/update on any profile, and
`prevent_role_self_escalation` (`0002`) already permits an admin-initiated
role change through the same trigger that blocks everyone else's.
Assigning `admin` through this UI is still deliberately not offered, same
reasoning as the old form: promote to admin directly in the database, out
of band.

**Google OAuth sign-in added, alongside magic link, same domain
restriction.** `signInWithGoogle` (`actions/auth.ts`) calls
`signInWithOAuth` with `queryParams: { hd: "udontech.ac.th" }` — explicitly
documented in that file as a UI hint only, not enforcement, since a user
can pick a different Google account than the one it suggests and Google
does not block that. The actual boundary is unchanged from magic-link
sign-in: `profiles.email`'s `CHECK (email like '%@udontech.ac.th')`
constraint (`0001_auth.sql`) rejects the `profiles` insert for a
non-college address, which rolls back the whole `auth.users` row
`handle_new_user()`'s trigger fired from — this is what actually protects
the OAuth path, since it never touches `signIn`'s Zod checks at all. The
callback route additionally re-checks the signed-in email directly and
signs out + redirects with the existing `wrongDomain` message if it somehow
gets past that, as defence in depth rather than the sole guard. Turnstile
does not cover this path — the CAPTCHA lives inside the `signIn` Server
Action, and OAuth redirects straight to Google and back, never through it;
recorded as an accepted trade-off in README.md, the same shape as the
already-documented JS-disabled trade-off.

Not verified live: this session had no Supabase credentials, Postgres, or
Docker access (same constraint noted for `0016`–`0018` above). The
`0019`/`0020` migrations, the RLS/permission reasoning, and the OAuth
domain-rejection path are reasoned through and internally consistent with
the schema, but none of it has been run against a real project. Needs the
same live proof pass this project already has a precedent for (`0005`
citizen_id, `0008` attendance, `0011` role split) before being trusted:
confirm a fresh signup — both magic-link and Google — actually lands
`pending`; confirm a non-college Google account is rejected and leaves
*no* `auth.users` row behind, not just a generic error; confirm an
admin-approved role sticks and reaches the dashboard.

**Magic link replaced with password sign-in; sign-up and reset pages
added; e-book host switched AnyFlip → FlipHTML5, attaching a book moved
into the §12 draft workflow.** `signInWithOtp` (`actions/auth.ts`) is gone
— `/login` now takes email + password (`signInWithPassword`), `/signup`
registers a new account with email confirmation required
(`signUpWithPassword`), and `/forgot-password` → `/reset-password` recovers
a forgotten one (`requestPasswordReset` / `updatePassword`), the latter via
a new `app/[lang]/auth/reset/route.ts` kept deliberately separate from the
existing `/auth/callback` so a recovery code can never land anywhere but
`/reset-password` — preserving both routes' "redirect target is never
caller-supplied" property. Every action collapses its failures into one
generic message (`invalidCredentials`, or a uniform "check your email" panel
regardless of whether the address exists) — the same account-enumeration
guard `signInWithOtp` was already built around. `handle_new_user()` needed
no changes: it fires on any `auth.users` insert regardless of provider, so
password signups still land `pending` and still fail the `profiles.email`
CHECK for a non-college address. Google sign-in is now offered on both
`/login` and `/signup`, via a new shared `components/auth/google-sign-in.tsx`
extracted from the login form. Not verified live, same constraint as above —
password signup landing `pending`, the confirmation/reset email round-trip,
and an existing account being able to set a password via the reset flow all
still need the live proof pass.

`lib/anyflip.ts` → `lib/fliphtml5.ts` (`0021_documents_fliphtml5.sql`
replaces `0013`'s AnyFlip CHECK constraint with a FlipHTML5 one, nulling any
existing non-matching `flipbook_url` first since there's no cross-host URL
translation). More significant than the host rename: attaching a book is no
longer Table-Editor-only — `flipbook_url` and `description` are now fields
on the owner's draft (`schemas/documents.ts`'s `saveDocumentDraftSchema`,
`components/documents/document-form.tsx`), so a book flows through the
existing draft → sign → submit → review → approve workflow instead of being
pasted straight onto a published row; the document detail page renders a
live `FlipbookViewer` preview for anyone who isn't the owner mid-edit, so a
reviewer can check the book before approving it. No new RLS was needed —
the owner's existing draft-UPDATE policy (`0017`) already covers the two
new columns, and only `document:approve` can reach `official`. **No
verified demo book is seeded**: this session's outbound network policy
blocked every request to `fliphtml5.com` (proxy returned `403` on
`CONNECT`), so — unlike the AnyFlip-era seed, which carried one row with a
real, checked-reachable book — all three seeded documents now have
`flipbook_url = null`. `docs/add-ebook.md` was rewritten around the in-app
flow, demoting the Table Editor to an admin-only fallback.

**Vercel production build was broken since `d6143a7` — found and fixed.**
That commit's `lib/env-guard.ts` started requiring `NEXT_PUBLIC_SITE_URL` at
`next.config.ts` load time whenever `VERCEL_ENV === "production"`, but
README's "Deploying to Vercel" table and this file's own record of the
project's env vars both still listed only the original three
`NEXT_PUBLIC_*` vars — nothing ever told anyone to set the fourth. Every
Production build since has thrown `Production deploy is missing required
configuration: - NEXT_PUBLIC_SITE_URL is not set …` at the config-load step,
before a single page could render. Not verified against the live Vercel
dashboard this pass (no dashboard/CLI access from this session) — inferred
from the guard's own logic plus CLAUDE.md's existing env-var record, not
observed as a live failed deploy.

Fixed with a fallback instead of a docs-only patch, so a stock Vercel import
works with zero hand-set vars: new `lib/site-url.ts`'s
`resolveConfiguredSiteUrl()` tries `NEXT_PUBLIC_SITE_URL` first, then
Vercel's auto-injected `VERCEL_PROJECT_PRODUCTION_URL` (not `VERCEL_URL` —
that's the ephemeral per-deployment hostname, not in Supabase's Auth
URL-Configuration allow-list). Both `lib/env-guard.ts`'s build guard and
`actions/auth.ts`'s `resolveOrigin()` now call it instead of reading
`NEXT_PUBLIC_SITE_URL` directly, so the guard still fails closed if a
project has "Automatically expose System Environment Variables" turned off
and no explicit override set — it just stopped requiring a var Vercel
already provides by default. README and `.env.example` updated to describe
both accepted sources. `npx tsc --noEmit && npm run lint && npm run build`
all pass clean; the guard's three branches (no source → throws,
`VERCEL_PROJECT_PRODUCTION_URL` set → passes, explicit override → passes)
were exercised directly against the compiled module rather than assumed.

**Signed-in landing redirect, 12-hour hard session cap, and name beside the
desktop avatar.** Three small UX/security fixes to the auth layer:

1. A signed-in user hitting `/`, `/login`, or `/signup` used to see the
   guest-facing page (marketing hero, login form) instead of being sent to
   where they actually belong. New `signedInLandingTarget(role, lang)` in
   `lib/auth/require-role.ts` (mirrors the existing `deniedRedirectTarget()`)
   is now called from all three pages plus `app/[lang]/auth/callback/route.ts`,
   which previously duplicated the same `pending`/`dashboard` branch inline.
   Deliberately left untouched: `/forgot-password` and `/reset-password` — the
   recovery route establishes a real session before landing on
   `/reset-password`, so redirecting signed-in viewers away from it would
   break password recovery outright. Verified via the `dev_role` cookie stub
   (no live Supabase project in this session): student/admin → `/dashboard`,
   `pending` → `/pending`, guest → hero still renders, `/forgot-password` and
   `/reset-password` both still reachable while "signed in."
2. Sessions never expired. New `lib/auth/session-timeout.ts` defines a
   12-hour hard cap since sign-in (not an idle timer), checked against
   Supabase's server-verified `user.last_sign_in_at` — not bumped by token
   refresh, so it's a true session start, and it comes from the auth server
   rather than a client-writable cookie. Enforced in
   `lib/supabase/middleware.ts`'s `updateSession()` (now returns
   `{ response, sessionExpired }` instead of a bare response — its one caller,
   `middleware.ts`, was updated to match) and `middleware.ts` redirects to
   `/login?error=sessionTimedOut` on expiry, copying `response.cookies` from
   the sign-out onto the redirect response — skipping that copy would leave
   the expired cookie in place and loop forever, the same trap
   `updateSession`'s own doc comment already warns about for its normal
   cookie-refresh path. New `auth.errors.sessionTimedOut` dictionary key in
   both `th.json`/`en.json` (deliberately not a reuse of the existing
   `sessionExpired` key, which is worded about an expired *password-reset
   link*, not a timed-out session). README documents Supabase dashboard →
   Authentication → Sessions → time-box user sessions (12h) as a defence-in-depth
   backstop that invalidates the refresh token at the auth server — a manual
   step, not applied here, and not required for the app-level cap to work.
   Verified: `isSessionExpired()`'s boundary cases (just signed in, 11h59m,
   12h01m, missing/garbage timestamp) exercised directly against the compiled
   module — no live Supabase project in this session to observe the real
   redirect, so the 12-hour boundary itself was proven in isolation, not
   end-to-end.
3. The desktop top bar showed an icon-only avatar button; the user's name was
   one click away in the dropdown, while the mobile sheet already showed both
   together. `components/layout/user-menu.tsx`'s dropdown trigger now shows
   avatar + name (falling back to the email local part when `full_name` is
   null — a password-only signup has no Google name — and to nothing when
   neither exists), `max-w-[10rem] truncate` so a long Thai name can't repeat
   the nav's existing 768px overflow regression (§0, "Login was completely
   broken on a second live production URL" section has the responsive-check
   history). Also: `0023`'s `handle_new_user()` only copies Google's
   name/photo at signup INSERT time, so an account that signed up with a
   password and linked Google *later* would never get one — the callback
   route now re-syncs `full_name`/`avatar_url` from Google's identity data on
   every Google sign-in, best-effort, under the user's own session (already
   permitted by `profiles_update_own`, no new RLS). Verified: layout at
   1280px/1024px in light/dark shows no horizontal overflow
   (`scrollWidth === clientWidth` in both themes, checked directly via CDP
   `Emulation.setDeviceMetricsOverride` — the same real-viewport-emulation
   technique `scripts/responsive-check.mjs` uses); with no real profile data
   available in this session, the empty-name case (dev-cookie stub) was
   confirmed to render identically to before (icon only, no stray padding).
   The actual name-populated rendering was not observed live.

`npx tsc --noEmit && npm run lint && npm run build` all pass clean for all
three changes together.

**Sign-in switched to Google OAuth only, with an emailed set-password step.**
`/login` and `/signup` no longer carry an email/password form — `/login` is a
single Google button, `/signup` is now just a `redirect()` to `/login`
(dropped rather than deleted outright, so an old bookmark still lands
somewhere useful). `actions/auth.ts` lost `signInWithPassword` and
`signUpWithPassword` entirely, and `schemas/auth.ts` lost `signInSchema`/
`signUpSchema` with them; `emailSchema`/`newPasswordField`/
`resetRequestSchema`/`newPasswordSchema` all stay, still used by the reset/
set-password path. Dead dictionary keys that only those two removed forms
ever read (`passwordLabel`, `signUp`, `signingUp`, `signingIn`, `noAccount`,
`haveAccount`, `checkEmailSignupDescription`, and the error keys
`passwordRequired`/`invalidCredentials`/`signUpFailed`) were removed from
both `th.json`/`en.json` rather than left orphaned.

Two real constraints shaped the design, both found before writing any code
rather than discovered mid-implementation:

1. **Supabase sends no email after a Google sign-in** — Google already
   proved the identity, so `email_confirmed_at` is set immediately and
   nothing is mailed. The requested "send email → click link → set
   password" step has to be triggered by the app itself, so it reuses the
   *existing* password-recovery email (`requestPasswordReset` →
   `/auth/reset` → `/reset-password`) rather than inventing a new one —
   `/reset-password` already *is* the requested password+confirm screen.
2. **This project's Turnstile is enforced at the Supabase project level**,
   so a server-initiated `resetPasswordForEmail()` call with no captcha
   token would be rejected outright (`captcha protection: request
   disallowed` — the same failure already documented earlier in this file
   for `signInWithPassword`). A token can only come from a real browser, so
   the flow needs a small interstitial page, not a fully silent trigger.

New `profiles.password_set boolean not null default false` column
(`supabase/migrations/0030_profiles_password_set.sql`), backfilled `true`
for any existing `auth.users` row with a real `encrypted_password` so
pre-existing password accounts aren't routed through the new flow on their
next sign-in. Given the explicit column-grant allow-list `0005` established
for `profiles` (a table-level SELECT revoke, re-granted per-column), the
migration re-grants `select (password_set)` in the same file — the exact
trap that column-grant pattern exists to catch, checked for directly this
time rather than found by a later live 403. **Accepted, not closed**:
`profiles_update_own` (0002) lets a user flip their own `password_set`
like any other self-editable column — the same trade-off already made for
`full_name`/`avatar_url` (0025's header) — since doing so only costs that
user their own password step and grants no privilege, it's a UX gate, not
a security boundary, so no additional trigger was added.

`app/[lang]/auth/callback/route.ts` now selects `password_set` alongside
`role` and checks it ahead of the normal `pending`/`dashboard` landing:
`password_set = false` sends a freshly-signed-in Google user to the new
`/set-password` page instead. That page (`app/[lang]/(public)/set-password/`)
reads the caller's own verified session email server-side — never a URL
param — and its form is a thin wrapper around the *existing*
`requestPasswordReset` Server Action (real captcha widget, hidden
server-known email field, same uniform "check your email" response
already used to guard against enumeration) rather than a new endpoint.
`updatePassword` (`actions/auth.ts`) now reads `password_set` before
updating it — to tell a first-time completion of this flow apart from an
ordinary later password reset — sets it `true`, signs the session out, and
redirects to `/login?notice=signupComplete` or `?notice=passwordUpdated`
rather than straight into the app; `login/page.tsx` parses `?notice=` the
same defensively-checked-against-dictionary-keys way it already parsed
`?error=`. `redirectByRole()` (the helper both removed password actions
used to call) was deleted as dead code once nothing called it anymore.

**One trade-off stated plainly rather than silently accepted**: with
`/login` reduced to a Google button only, the password set through this
flow has no working sign-in path that consumes it — `/forgot-password` is
its only consumer today (recovering a password that already can't log
anyone in). Built this way because Google-only login *and* a real
set-password step were both explicitly requested together; flagging it
here so it isn't rediscovered as a surprise later.

`npx tsc --noEmit && npm run lint && npm run build` all pass clean, plus a
grep sweep confirming no leftover reference to any removed
export/schema/dictionary key. Verified via `dev_role` cookie stub and
`curl` (no live Supabase project in this session): `/login` renders no
email/password inputs; `/signup` redirects to `/login`; a signed-in
`/signup` hit chains `/signup → /login → /dashboard` without looping;
`?notice=signupComplete` renders the Thai success text, an unknown
`?notice=` value renders nothing; `/forgot-password` and `/reset-password`
are unaffected. **Not verified live** (no Supabase credentials in this
session, same limitation as the section above): a real Google sign-in
actually reaching `/set-password` on a fresh account, the emailed link
completing the round trip, and — the biggest real risk — whether the
project's email volume can support this at all, since custom SMTP is still
unconfigured per the ❌ Remaining item below and the default Supabase mailer
caps out around 2 messages/hour.

**Member management: add, edit, delete users from `/members`, plus password
sign-in restored alongside Google.** `/members` previously offered exactly one
management affordance — an icon-only pencil opening `MemberEditSheet`, gated
on `member:approve`. Added: labelled **Edit**/**Delete** buttons per row, and
an **Add user** button above the table — the last one specifically for
someone who can't use Google OAuth.

That collided directly with the just-shipped Google-only login above: an
admin-created account would have had no way to sign in. Resolved by
**restoring password sign-in alongside Google** rather than choosing one or
the other — `signInWithPassword`/`signInSchema` (removed in the Google-only
pass) came back in `actions/auth.ts`/`schemas/auth.ts`, but `redirectByRole()`
did not; both call sites now end with the shared `signedInLandingTarget()`
instead. The password form lives inside a native `<details>` disclosure on
`/login` ("sign in with a password instead"), below the primary Google
button — `<details>` needs no JavaScript to open, so the §30.9 JS-disabled
guarantee holds for both paths independently. This also gives the
set-password flow built for Google sign-in a second real purpose: an
admin-added account already ships with a usable password from creation, no
email round-trip needed for it specifically.

New `lib/supabase/admin.ts` — the first service-role (`SUPABASE_SECRET_KEY`)
client in application code (previously only `scripts/responsive-check.mjs`
read that var). `server-only`, never `NEXT_PUBLIC_`-prefixed, exports
`isSupabaseAdminConfigured` so the UI hides Add/Delete entirely rather than
rendering buttons that can only fail when the key is absent.

`services/members.ts#createMember` deliberately spans **two** clients: the
admin client only for `auth.admin.createUser()` (RLS has no authority over
the `auth` schema — there is no way to do this without it), then the
**caller's own** cookie-scoped client for the `profiles` UPDATE, so
`prevent_role_self_escalation` (0024) and `prevent_member_identity_change`
(0025) — the same triggers that already govern `updateMember` — govern
account creation too, rather than bypassing them with the admin client for
that part as well. `handle_new_user()` (0023) already auto-inserts a
`profiles` row for any new `auth.users` row, including one made via the
Admin API, guessing a role/`student_id` from the email's local part with
`password_set` defaulting false (0030); the UPDATE overwrites that guess
with what the caller actually chose and sets `password_set = true`, since
the account ships with a real password. **If the profile UPDATE fails, the
just-created `auth.users` row is deleted** — a half-made account that could
still sign in with a guessed role is worse than no account at all.

`deleteMember` is **permanent** — `auth.admin.deleteUser()`, relying on
`profiles.id`'s existing `on delete cascade` (`0001_auth.sql`) rather than a
separate profiles delete. Two guards enforced **server-side** in
`actions/members.ts#deleteMemberAction`, never trusting the confirm dialog:
refuse to delete the caller's own account (compared against
`supabase.auth.getUser()`, not anything the form sent), and refuse an admin
target by re-reading that row's actual role from the database. Both checks
run before the Admin API is ever touched.

Both new actions gate on `member:manage` (admin-only), not `member:approve`
(which `aft_teacher` also holds) — the same distinction
`lib/auth/permissions.ts` already draws between editing an already-approved
member and account-level management. Verified directly: `can(role,
"member:manage")` is `true` only for `admin`, `can(role, "member:approve")`
is `true` for `aft_teacher`/`admin`, exercised against the compiled
permissions module for all six roles.

One accessibility detail carried forward correctly this time: the edit
trigger gained visible "Edit" text (previously icon-only) and its
`aria-label` was updated to `"Edit {name}"` — the visible label text stays a
prefix of the accessible name, avoiding the exact WCAG 2.5.3 "Label in Name"
mismatch flagged in review of an earlier, unrelated change in this project
(icon+name buttons where the visible text and `aria-label` diverged). The
new delete trigger was built with the same rule from the start.

`npx tsc --noEmit && npm run lint && npm run build` all pass clean.
**Live-verification gap found and worth recording rather than hidden**:
`/members` currently 500s in this dev session with no live Supabase
project — `services/members.ts#getDepartments/getClubs/getFilterOptions`
call `createClient()` unconditionally in a top-level `Promise.all()` with no
Suspense/error boundary around it, and `createServerClient()` throws
synchronously (not a caught query error) when the env vars are absent. This
is **pre-existing** — confirmed via diff that this session's changes never
touched those three functions' bodies — but it fully blocked live curl-based
verification of the new role-gated buttons on this page, for every role,
not just the ones added here. Not fixed in this pass (out of scope for
member-management CRUD; the dashboard's per-card Suspense/`CardBoundary`
pattern is the template a real fix should follow). Verified instead via
`can()` exercised directly against the compiled permissions module (above)
and careful reading of the gating JSX; the actual rendered page — Add
button placement, Edit/Delete side-by-side, admin-row hiding — was **not**
observed live and needs the same proof pass once a Supabase project is
reachable. `/login`'s new `<details>` disclosure *was* verified live via
curl: real `name="email"`/`name="password"` inputs present in the raw HTML,
not just embedded dictionary JSON. **Fixed in the next pass, see below.**

**`/documents` and `/members` no longer die on a failing dependency; the app
gained its first route-level error boundaries.** Reported live: the
Documents page "no go page" after the site loads. Reproduced locally rather
than guessed — with Supabase env vars unset (the exact live-network
constraint this session has always had), `curl`-ing `/th/documents` returned
a bare **500**, traced to `getBookYears()` → `createClient()` →
`createServerClient()` throwing *synchronously* from inside the page's
top-level `Promise.all()`, above its own `<Suspense>` boundary — so nothing
downstream ever got a chance to catch it. Same shape, same root cause as the
`/members` defect this file already flagged above. A second finding while
tracing it: the whole app had exactly **one** error boundary anywhere
(`(app)/dashboard/error.tsx`) — no `[lang]/error.tsx`, no
`app/global-error.tsx`, no `[lang]/not-found.tsx` — so any uncaught server
throw on any other route rendered Next's bare, unstyled "Application error"
screen with zero indication of what broke.

Fixed two ways, not one, since a route boundary alone would only stop the
crash from looking broken, not stop it from happening:

1. **New `lib/supabase/server.ts#tryCreateClient()`** — same client as
   `createClient()`, but returns `null` instead of throwing when
   `isSupabaseConfigured` is false, so a read-only "list" service can
   actually reach its own `if (error || !data) return []` guard instead of
   dying before the query ever runs. Applied to the functions that already
   *intended* to fail soft and just couldn't: `services/books.ts`'s
   `listBooks`/`getBookYears` and `services/members.ts`'s
   `getMembers`/`getDepartments`/`getClubs`/`getFilterOptions` (closing the
   `/members` ❌ item above — not a separate future pass). Write paths
   (`createBook`, `updateMember`, etc.) deliberately keep using
   `createClient()` unchanged — a write with no real client *should* throw.
2. **`app/[lang]/(public)/documents/page.tsx`** — `getBookYears()` moved out
   of the page's fatal top-level `Promise.all` into its own async child
   (`BooksFiltersSection`), wrapped in `<Suspense>` + the existing
   `components/dashboard/card-boundary.tsx` (`CardBoundary`) — the same
   §30.7 pattern the dashboard already established, reused rather than
   reinvented. The existing `BooksResults` (which also calls `createClient()`
   directly and `supabase.auth.getUser()`) got the same `CardBoundary`
   treatment. New `components/books/books-filters-skeleton.tsx` gives that
   boundary's own loading state, matching the existing
   `BooksShelfSkeleton`. New shared `dict.common.errorTitle`/`errorRetry` keys
   (both `th.json`/`en.json`) feed `CardBoundary`, rather than duplicating
   `dashboard.errorTitle`/`errorRetry` into a second dictionary section.

Three new route-level boundaries close the gap the investigation found, all
intentionally untranslated for the same documented reason
`(app)/dashboard/error.tsx` already is — `error.tsx`/`not-found.tsx`/
`global-error.tsx` receive no route params, so there's no `lang` to load a
dictionary with: `app/[lang]/error.tsx` (every localized route),
`app/global-error.tsx` (root-layout throws, which `[lang]/error.tsx` can't
reach — must render its own `<html>`/`<body>`), `app/[lang]/not-found.tsx`
(styled 404, replacing Next's default — `notFound()` is already called by
the book-detail page). `[lang]/error.tsx` also surfaces `error.digest` in
small muted text — the one handle Vercel's production logs give back onto a
stripped client-side error message, so the next live occurrence is
diagnosable by digest instead of re-derived from scratch the way this one
was.

**Regression-tested against the exact failure captured above**: with
Supabase env vars unset, `curl`-ing `/th/documents`, `/en/documents`,
`/th/members`, `/en/members` now all return **200** (was 500 for documents;
`/members` was already the known ❌ 500 above) — page heading and filter bar
render for real (checked in the raw HTML, not just inferred from the status
code), with an error card in place of the shelf/table. No dev-server error
log entry at all — `services/members.ts`'s three functions now fail soft to
empty results as they always intended to, rather than throwing. Re-checked
with Supabase env vars *set* (this session's live network policy blocks the
real project, so a syntactically-valid placeholder URL/key was used to
reach `createServerClient()`'s own connection-time behavior, not an actual
query result) across three ways: `next dev`, a real `next build` + `next
start` (closer to the Vercel runtime than dev mode), and a direct RSC
client-navigation fetch (`curl -H 'RSC: 1' '.../th/documents?_rsc=...'`) —
all 200, zero new error-log entries, confirming no behavior change for the
configured case. `npm run check:responsive` (72 combinations: 3 breakpoints
× 2 themes × 12 public pages, run against the unset-env-vars condition so
the new error-card markup itself gets checked) passed clean, including both
changed pages. `npx tsc --noEmit && npm run lint && npm run build` all pass.

**Not closed by this pass, stated plainly rather than assumed**: this fix
guarantees the page renders and names what broke — it does not by itself
prove *which* dependency was actually failing on the live site, since this
session cannot reach either the live deployment or the live Supabase project
(both blocked by this session's network policy, confirmed via a `403` on
`CONNECT` to the Vercel domain and a timeout to the Supabase one, not
assumed). Once deployed, the error card's presence or absence — and the
`error.digest` shown when it does appear, cross-referenced against Vercel's
runtime logs — is what actually answers that. Two concrete candidates worth
checking directly, both consistent with the reported "happens while signed
in": migrations `0022`–`0030` (this file's own live-application record stops
at `0021`, and `books`/`0027`-`0029` is exactly what `/documents` reads) may
never have been applied to the live project; separately, the 12-hour session
cap (`lib/auth/session-timeout.ts`) redirects an expired signed-in session to
`/login?error=sessionTimedOut` on every navigation, which can read as "the
page won't open" if not recognized as that specific redirect. **Confirmed
live, same pass**: the user hit production `test-claude-swart-delta.vercel.app/th/documents`
directly and got Next's bare "Application error" screen with `Digest:
2646013012` — this is the exact failure mode this fix targets, observed
from the live site rather than assumed. Since this fix was not yet merged
to `master` at the time (Vercel deploys production from `master`, and this
work landed on `claude/check-updates-naming-brczuk` first), that digest is
expected to be the *old* crash, not a new one — merging is what actually
puts the fix in front of it.

**A second, unrelated bug found and fixed in the same pass: intermittent
Google sign-in failure, `flow_state_already_used`.** Reported live: signing
in sometimes works, sometimes lands on `/?error=invalid_request&error_code=flow_state_already_used`.
That query-param shape is Supabase's own GoTrue server redirecting to its
configured Site URL — meaning the request never reached this app's
`app/[lang]/auth/callback/route.ts` at all; Supabase itself rejected a
second attempt to redeem an already-consumed one-time PKCE code before
handing control back. `exchangeCodeForSession(code)` can only succeed once
per `code`; a second delivery of the same callback request — a slow network
or an intermediary retrying a slow GET, a stale/replayed navigation — fails
with exactly this error even though the *first* delivery already succeeded
and set a valid session cookie.

Fixed by checking for an existing session (`supabase.auth.getUser()`)
*before* ever touching `code`: if the request already carries a valid
session (the retry/replay case), the exchange is skipped entirely and the
handler falls straight through to the same profile-lookup/redirect logic a
fresh exchange would have reached — turning a visible error into a silent
no-op success. The domain check, the Google name/avatar re-sync, and the
`password_set` → `/set-password` branch are all unchanged, just no longer
nested inside the old `if (!error) { ... }` block now that `user` is
resolved once up front. Not verified against the live failure directly —
this session cannot reach the live Supabase project (see above) — but the
fix directly closes the one-time-code-reuse mechanism `flow_state_already_used`
names, `npx tsc --noEmit && npm run lint && npm run build` all pass clean,
and no other code path calls `exchangeCodeForSession` a second time for the
same request.

**Real root cause of the live sign-in failure identified afterward — a
second live Vercel domain missing from Supabase's own redirect allow-list,
not the retry-race the code fix above targets.** Follow-up live report:
signing in from `https://test-claude-ka-600a.vercel.app` (this project's
second working production URL — see "Login was completely broken on a
second live production URL" above, previously fixed for Cloudflare
Turnstile only) landed on `http://localhost:3000/?code=<uuid>` — a dead
local address with a stranded, never-exchanged code. That query shape (no
`/th/auth/callback` in the path at all) is Supabase's Auth server falling
back to its configured **Site URL** because the requested `redirectTo`
(`https://test-claude-ka-600a.vercel.app/th/auth/callback`, correctly built
by `resolveOrigin()` from the request's own `Origin` header) didn't match
anything in Authentication → URL Configuration → Redirect URLs — only
`https://test-claude-swart-delta.vercel.app/**` had ever been confirmed
registered there (the Turnstile-domain fix only touched Cloudflare's
hostname list, a completely separate allow-list, never Supabase's). Site
URL itself was still Supabase's out-of-the-box default,
`http://localhost:3000`, never updated to a real domain — explaining the
exact dead address observed. Fixed by the user directly in the Supabase
dashboard (not a code change, not something this session could do without
dashboard access): added `https://test-claude-ka-600a.vercel.app/**` to
Redirect URLs alongside the existing entries, and updated Site URL off its
`localhost:3000` default. Confirmed working by the user afterward. The
`exchangeCodeForSession` retry-guard fix above is still correct and worth
keeping — it closes a real, distinct failure mode (a genuinely retried
callback request) — but it was not what caused *this* particular reported
failure, and is still unverified against a live retry specifically, only
against the mechanism the error name describes.

### ❌ Remaining

* **RLS policy performance (`auth_rls_initplan`, `multiple_permissive_policies`)**
  — ~10 policies across `profiles`/`attendance`/`projects`/`documents`/
  `document_drafts`/`notifications` call `auth.uid()`/`current_role()`
  directly instead of `(select auth.uid())`, causing Postgres to
  re-evaluate the function per row instead of once per query; several
  tables also stack multiple permissive policies for the same role+action
  (an inherent side effect of this project's additive "role gets its own
  policy on top of the base ones" RLS design). Both are real at scale, both
  are currently harmless (every table here has single-digit-to-low-hundreds
  rows). Not fixed this pass because both require rewriting the
  security-critical access-control layer itself — the risk of introducing an
  actual RLS gap while chasing a query-planner optimization outweighs the
  current benefit. A correct fix needs its own pass: rewrite each policy,
  then re-run the full guest/student/teacher/aft_teacher/admin × table
  verification matrix this project has already established the pattern for
  (see the `0005`/`0008` citizen_id and attendance column-grant proofs
  above) before trusting it.
* **No Content-Security-Policy headers** — §19 asks for XSS protection,
  achieved today via React's default escaping and the absence of any
  `dangerouslySetInnerHTML` (verified this pass, see Done above), but a CSP
  would add defense-in-depth against any future regression. Not added this
  pass because a naive CSP would likely break the app: `book-cover.tsx`'s
  gradient uses an inline `style` attribute (React's `style` prop always
  renders as `style="..."`, which a strict `style-src` without
  `'unsafe-inline'` blocks), Turnstile needs `challenges.cloudflare.com` in
  both `script-src` and `frame-src`, and the flipbook viewer needs
  `fliphtml5.com` (and its `online.` reader subdomain) in `frame-src` — was
  `anyflip.com` before the §12 e-book host switch. A correct policy needs to
  be built with all
  three allowances and then verified live on every page/theme (login
  especially, since a misconfigured CSP silently breaking Turnstile would be
  worse than having no CSP at all) — not assembled from a generic template
  and shipped unverified.
* **Leaked password protection is off, Pro-plan-gated** — Supabase
  Authentication → Attack Protection confirms it, greyed out under "Only
  available on Pro plan and above." **This entry's earlier claim that
  "password sign-in is never exposed in the UI" is now false and has been
  corrected here rather than silently left wrong**: a password field is live
  at `/login` (behind a `<details>` disclosure, alongside Google — added when
  password sign-in was restored so admin-created accounts have a way in) and
  every account an admin creates via `/members`'s "Add user" ships with a
  real, immediately-usable password from creation. Real-world exposure is
  therefore higher than when this bullet was first written, not the same.
  Still not fixable without a paid-plan upgrade, which is a billing decision
  for the user, not something to change unilaterally.
* **Custom SMTP (Resend) needs to be manually reconfigured** — cleared as a
  side effect of the round-trip proof above (Authentication → Emails → SMTP
  Settings → toggle "Enable custom SMTP" → re-enter host `smtp.resend.com`,
  port `465`, sender `noreply@udontech.ac.th` / "AFT UDONTECH", username
  `resend`, and the Resend API key as the password → Save). Not urgent: it
  won't actually send until `udontech.ac.th` also finishes Resend's DNS
  verification, which is still pending — check `resend._domainkey.udontech.ac.th`
  resolves before expecting it to work.
* **Correction to this section's own prior claim**: it used to say
  "`project_drafts` (Projects workflow) ... Plus Documents digital-signature
  ... none of those phases started." That was wrong by the time it was
  read for this pass — both shipped in commits `03f19e4`/`8260e14`, just
  never reflected here (see the Done-section entry above, added this pass
  specifically to close that gap). Audited every remaining §30.10 phase
  against the actual codebase (routes, migrations, package.json) rather than
  trusting this file's own prior bullets, since one of them had already gone
  stale silently:
  * **QR attendance (§13)** — genuinely not started. No `qr_sessions`
    migration, no `react-qr-scanner`-equivalent usage anywhere in the
    codebase, no scan/confirm page. This is §30.10's own documented
    most-security-sensitive phase (GPS, device fingerprint, duplicate
    protection) — start here, not later, per that ordering.
  * **`audit_logs`** — genuinely not started. No migration creates it, and
    grepping the codebase for any write to a table by that name finds
    nothing.
  * **Reports & global search (§18/§30.10)** — genuinely not started.
    `/reports` is still a bare `PageShell` with `emptyTitle={dict.common.comingSoon}`
    and nothing else; there is no search input anywhere in `top-nav.tsx` and
    no cross-entity (Members/Activities/Projects/Documents) query path. The
    debounced-search pattern already proven on `/members` and `/activities`
    (`hooks/use-debounced-value.ts`) is the natural building block once this
    phase starts.
  * **Notifications/web push (§16/§30.10)** — genuinely not started.
    `/notifications` is the same bare `PageShell` placeholder; no service
    worker, no `web-push` usage, nothing beyond the nav bell icon that
    already exists for the in-app unread-dot UI.
  * **`/profile` — a fifth placeholder page, not previously listed here at
    all.** Also a bare `PageShell` "coming soon", despite being linked from
    every signed-in role's top nav and avatar-menu dropdown. Found while
    auditing routes for this correction — worth calling out on its own since
    it wasn't a documented phase like the four above, just an overlooked
    gap. The only profile-*adjacent* work that exists is the self-editable
    `full_name`/`avatar_url` sync described earlier in this file (a
    background sync on Google sign-in, not a page a user can visit to see
    or edit their own data).
  * **Projects workflow (§11) and Documents digital-signature (§12/§17) —
    already done**, see the Done-section entry above. Not a remaining item;
    listed here only to make the correction to this bullet's history
    explicit rather than just quietly disappearing.
  * **§30.10's Activities phase remains partially consumed** — unaffected by
    this correction: the full §10 UI (search/filters/sort/pagination/
    statistics) already shipped, built directly against the existing
    `activities` table; only **realtime** (the other half of that phase)
    remains outstanding. No realtime/`supabase.channel` usage found anywhere
    in the codebase.
* **`attendance` has zero rows** — by design (see Done above), but it means
  the §10 activity-statistics chart's "attendance" series will show 0 for
  every month until either real QR check-ins land or a future pass seeds it
  against real test-user accounts created and torn down for that purpose.
  This now also applies to `/activities`' own Attendance stat tile, for the
  same reason.
* **`documents.cover_url` is schema-ready but not rendered** — every book on
  the `/documents` shelf shows a designed placeholder cover instead of a real
  thumbnail; wiring a real cover image is a follow-up, not started.

## 1. Mission

Build a **production-ready, premium SaaS dashboard** for
**องค์การนักวิชาชีพในอนาคตแห่งประเทศไทย (อวท.) — Udon Thani Technical College**.

Users:

* Guest
* Student / Member
* Teacher
* Administrator

UX target: **Vercel + Linear + Stripe + Notion + shadcn/ui**.
Do NOT make it look like an old government website.

---

## 2. Tech Stack — MUST USE

### Frontend

* Next.js 15 App Router
* React 19
* TypeScript strict
* TailwindCSS
* shadcn/ui ONLY
* Lucide Icons
* `@animateicons/react`
* Framer Motion
* React Hook Form + Zod
* TanStack Table + Query
* Zustand
* date-fns
* React QR Scanner
* React Signature Canvas
* Recharts

### Backend

Supabase:

* Auth
* PostgreSQL
* Storage
* Edge Functions
* Realtime
* RLS

### Environment

* Windows development
* Linux production
* Docker compatible
* Never use Windows-specific code

---

## 3. DESIGN — MUST FOLLOW

### Colors — desaturated steel navy + platinum silver (rebrand, see §0)

Monochrome luxury palette, matched to `Picture/tone color dark.jpg`
(sampled: hue ≈ 213°, saturation ≈ 30%). **No blue `#002583` and no mustard
`#FFB800` anywhere in the UI palette** — both are fully removed, including
the `--gold` token and every `bg-gold`/`text-gold-*` class. The organization
crest in the logo PNGs keeps its own red/gold, since it is the institution's
official identity, not a theme color — it is the one deliberate exception.

Light (cool steel white):

* Background `#F6F8FA`
* Card `#FFFFFF`
* Border / silver `#DDE3EA`
* Text `#0C121C`
* Muted text `#5A6B80`
* Primary / brand ink / accent-glow `#1F4A75`
* Ring `#3E6D9C`

Dark:

* Background `#0C121C`
* Card `#192330`
* Border `#2A3A4D`
* Text / silver `#CFD8E3`
* Muted text `#8A9BB0`
* Primary `#3E6D9C`
* Ring / brand ink `#7FA8D4`
* Accent-glow (platinum highlight, status/attention) `#DDE5EE`

Contrast guard: silver/platinum (`#8A9BB0`, `#CFD8E3`, `#DDE5EE`) is never
*text* or an indicator in light mode — `#8A9BB0` on white is ~2.6:1. Light
mode uses `#5A6B80` for muted text and `#1F4A75` for the accent-glow instead.
The `.text-gradient-brand` platinum-gradient heading treatment is dark-mode
only — its light-mode counterpart is a steel-blue gradient
(`#1F4A75 → #0C121C`), which stays AA-safe.

### UI

Use:

* `rounded-xl`
* soft shadows
* whitespace
* clean typography
* responsive layouts
* smooth 200–300ms transitions
* keyboard accessibility
* WCAG AA

Avoid:

* Bootstrap
* Material UI
* Ant Design
* excessive gradients
* excessive animation
* clutter

Gradients are restrained and decorative only: hero background, `h1` headings
(`.text-gradient-brand`), hairline dividers (`.divider-metal`), and a subtle
silver card top-edge. Nav, buttons, and card bodies stay flat — no gradient
ever sits behind body copy.

Use **shadcn/ui components** whenever applicable.

---

## 4. LAYOUT

### IMPORTANT: NO LEFT SIDEBAR

Use a **TOP NAVIGATION BAR**.

Desktop:

```text
Logo | Home | Calendar | Projects | Activities | Documents | Members | Reports

                                      Notifications | Settings | Avatar
```

Content below navigation.

Footer at bottom.

Mobile:

* Collapse navigation into hamburger/menu.
* Keep important actions accessible.

---

## 5. ROUTES

### Public

* Home
* Announcements
* Documents
* Activities
* Calendar
* Login

Guest = read-only official content.

### Authenticated

* Dashboard
* Profile
* Notifications
* Members
* Activities
* Projects
* Documents
* Reports
* Calendar

---

## 6. AUTHORIZATION

### Guest

Read official/public content only.

### Student

Can:

* submit project drafts
* view activities
* QR attendance
* digital signature
* notifications
* profile

Cannot:

* approve
* delete
* manage users

### Teacher

Student permissions +

* review drafts
* comment
* recommend

Cannot manage system.

### Administrator

Full management access.

Always enforce permissions with **Supabase RLS**, not only UI checks.

---

## 7. LOGIN

Allow only:

```text
@udontech.ac.th
```

Reject common personal email domains such as:

* gmail.com
* yahoo.com
* hotmail.com

Show a friendly validation message.

Use Zod validation.

---

## 8. DASHBOARD

Include:

* Welcome
* Notifications
* Upcoming Meetings
* Calendar
* Activity Statistics
* Draft Documents
* Recent Projects
* Recent Activities
* Member Statistics
* Quick Actions

Dashboard must be responsive and visually balanced.

---

## 9. MEMBERS

Features:

* search
* pagination
* sorting
* filtering

Filters:

* Department
* Year
* Class
* Club

Default: **10 rows/page**.

---

## 10. ACTIVITIES

Features:

* search
* filters
* realtime updates
* statistics

Filters:

* Department
* Club
* Academic Year

Statistics:

* Attendance
* Completed
* Pending

---

## 11. PROJECT WORKFLOW

```text
Student
 ↓
Create Draft
 ↓
Save Draft
 ↓
Teacher Review
 ↓
Admin Approval
 ↓
Official Project
```

Only **Official** projects are public.

Drafts remain private.

---

## 12. DOCUMENT WORKFLOW

```text
Draft
 ↓
Digital Signature
 ↓
Confirmation
 ↓
Admin Approval
 ↓
Official
```

---

## 13. QR ATTENDANCE

Admin creates dynamic QR sessions.

Fields:

* Event ID
* Expiration
* GPS radius

Student:

```text
Scan QR
 ↓
Open Website
 ↓
Confirm Attendance
 ↓
Type "ยืนยัน"
 ↓
Submit
```

Rules:

* one attendance per student/event
* GPS required
* time validation
* dynamic QR
* duplicate protection
* device fingerprint
* regex validation

Do not trust client-side validation alone.

---

## 14. STUDENT ID

Example:

```text
69319010015
```

Validation:

```regex
^[0-9]{11,}$
```

Parse:

* Year = `69`
* Department = `3190100`
* Number = `15`

Citizen ID:

* store once
* cannot be changed without Administrator permission

---

## 15. ATTENDANCE DATA

Store:

```text
date
time
student_id
department
class
room
activity
status
gps
device_fingerprint
browser
ip
created_at
```

Protect sensitive data with RLS and least-privilege access.

---

## 16. NOTIFICATIONS

Support:

* Web Push
* Browser notifications
* In-app notifications

Types:

* Meeting
* Activity
* Deadline
* Approval
* Announcement

---

## 17. DIGITAL SIGNATURE

Support desktop, tablet and mobile.

```text
Open PDF
 ↓
Sign
 ↓
Preview
 ↓
Confirm
 ↓
Type "ยืนยัน"
 ↓
Save
```

Use React Signature Canvas.

---

## 18. SEARCH

Global search:

* Members
* Activities
* Projects
* Documents

Requirements:

* realtime
* debounce 300ms
* server-side filtering where appropriate

---

## 19. SECURITY

Required:

* Supabase Auth
* RLS
* Zod validation
* XSS protection
* CSRF protection where applicable
* rate limiting
* audit logs
* secure cookies
* email verification
* HTTPS
* server-side authorization
* input validation

Never expose secrets in client code.

Never rely on UI permission checks for security.

---

## 20. DATABASE

Core tables:

```text
profiles
roles
departments
clubs
activities
attendance
projects
project_drafts
documents
document_drafts
notifications
audit_logs
qr_sessions
signature_records
```

Use foreign keys, indexes and RLS appropriately.

---

## 21. CODE RULES

MUST:

* TypeScript strict
* reusable components
* Server Components by default
* Client Components only when needed
* Server Actions where appropriate
* Zod validation
* meaningful types
* clean separation of concerns

NEVER:

* use `any`
* disable TypeScript
* disable ESLint
* duplicate components unnecessarily
* put secrets in client code
* bypass RLS
* create unnecessary dependencies

---

## 22. COMPONENT STATES

Reusable components should handle when applicable:

```text
loading
skeleton
empty
error
success
```

Do not add unnecessary states to static components.

---

## 23. PERFORMANCE

Prefer:

* Server Components
* server-side data fetching
* pagination
* lazy loading
* Next.js Image optimization
* memoization only when useful
* virtualization for large tables
* TanStack Query caching where appropriate

Avoid premature optimization.

---

## 24. ACCESSIBILITY

Target **WCAG AA**.

Include:

* keyboard navigation
* visible focus states
* semantic HTML
* ARIA labels when necessary
* screen-reader support
* sufficient contrast

---

## 25. ANIMATION

Use:

* Framer Motion
* `@animateicons/react`
* CSS transitions

Default duration: **200–300ms**.

Animation should communicate state or interaction.

Never animate excessively.

Respect `prefers-reduced-motion`.

---

## 26. FOLDER STRUCTURE

```text
app/
components/
  ui/
  dashboard/
  forms/
  table/
  charts/
  layout/
lib/
hooks/
actions/
types/
schemas/
utils/
services/
supabase/
public/
styles/
```

---

## 27. DEVELOPMENT BEHAVIOR

Before coding:

1. Inspect existing project structure.
2. Reuse existing components/utilities.
3. Do not replace working code unnecessarily.
4. Follow this file as the source of project rules.

When implementing:

1. Build the smallest correct solution.
2. Keep code modular.
3. Validate inputs.
4. Handle loading/error/empty states.
5. Check responsive behavior.
6. Check accessibility.
7. Check TypeScript and ESLint.

When finished:

* run relevant checks
* fix errors
* avoid unrelated refactors

---

## 28. PRIORITY RULE

When requirements conflict, use this order:

```text
1. Security
2. Correctness
3. Existing project architecture
4. UX / Accessibility
5. Performance
6. Visual polish
```

---

## 29. FINAL QUALITY BAR

The application must feel:

* premium
* modern
* clean
* fast
* responsive
* intuitive
* maintainable
* scalable
* production-ready

Target: **10/10 UI/UX + enterprise-quality architecture**.

Do not over-engineer.

**Prefer simple, reusable, secure solutions.**

---

## 30. BUILD PLAN — PHASE 1: FOUNDATION

The project starts empty. Build in phases so the design direction can be
reviewed early instead of all at once. **Phase 1 covers only the foundation**
— everything every later feature depends on, plus a fully built Dashboard.

Out of scope for Phase 1 (later phases): Members table, Activities, Projects
workflow, Documents workflow, QR attendance, digital signature, Reports,
global search, web push.

Confirmed decisions:

* Supabase project does not exist yet — write full schema + RLS as migration
  files; user creates the project and applies them.
* Language: Thai primary with an English toggle, full i18n from day one.

### 30.1 Scaffold & dependencies

* `create-next-app` → Next.js 15 App Router, React 19, TypeScript strict,
  Tailwind CSS v4, ESLint.
* `git init` + `.gitignore` (`.env*.local` ignored before any commit).
* `npx shadcn@latest init` — shadcn/ui only.

Install only what Phase 1 uses:

```text
@supabase/supabase-js, @supabase/ssr   auth + data, cookie sessions
react-hook-form, zod, @hookform/resolvers   forms + validation
next-themes                             light/dark
framer-motion, @animateicons/react, lucide-react   motion + icons
recharts                                dashboard chart
date-fns                                Thai/EN date formatting
```

Defer to the phase that needs them: TanStack Table + Query (Members),
Zustand (only if real cross-tree client state appears), React QR Scanner
(QR phase), React Signature Canvas (signature phase).

### 30.2 Design system

Tailwind v4 CSS-first theming. Palette from §3 as CSS variables under
`:root` and `.dark`, exposed via `@theme inline`.

* Contrast guard: `#FFB800` on white is ~1.9:1 — never use as body text or
  text color on light backgrounds. Restrict to fills, borders, badges,
  focus rings, chart series, always paired with `#111827` text on top.
  `#002583` on white is ~14:1 and safe for text.
* Typography: `next/font` — IBM Plex Sans Thai for Thai, Inter for Latin,
  one font stack for mixed strings. `leading-relaxed` as body default
  (Thai tone marks stack above/below).
* Logo assets: copy `Picture/*.png` into `public/`, render with `next/image`.
* shadcn components to add now: button card input label form dropdown-menu
  avatar badge sheet skeleton separator tabs sonner tooltip scroll-area.

### 30.3 Internationalization

Official Next.js dictionary pattern — zero extra dependencies.

* Route segment `app/[lang]/...`, `lang` is `th | en`, `th` default.
* `lib/i18n/dictionaries/th.json` + `en.json`, loaded server-side via
  `getDictionary(lang)` (`server-only`). Server Components get strings
  directly; Client Components receive them as props.
* `types/i18n.ts` derives the dictionary type from the Thai file — a
  missing English key is a type error, not a silent fallback.
* Locale detection/redirect lives in the same `middleware.ts` as the
  Supabase session refresh.
* Language toggle rewrites the current path's locale segment and persists
  choice in a cookie.

### 30.4 Supabase layer

Clients (`@supabase/ssr` — never the deprecated `auth-helpers`):

* `lib/supabase/client.ts` — browser client.
* `lib/supabase/server.ts` — Server Component/Action client via `cookies()`.
* `lib/supabase/middleware.ts` — session refresh helper.
* `types/database.ts` — regenerate with Supabase CLI once the project
  exists. No `any` anywhere.

Migrations:

* `supabase/migrations/0001_init.sql` — all 14 tables from §20 (`roles
  departments clubs profiles activities attendance qr_sessions projects
  project_drafts documents document_drafts signature_records notifications
  audit_logs`), with enum types for role/status/workflow states, FKs,
  indexes on every FK and on columns later phases filter by (`student_id`,
  `department_id`, `activity_id`, `academic_year`, `status`), a
  `handle_new_user()` trigger creating a `profiles` row on signup, and an
  `updated_at` trigger.
* `supabase/migrations/0002_rls.sql` — RLS enabled on every table with no
  exceptions, plus a `SECURITY DEFINER` helper `public.current_role()`
  that reads the caller's role from `profiles` without recursive policy
  evaluation.

  | Role | Policy summary |
  |---|---|
  | Guest (anon) | `SELECT` only where `status = 'official'` / `is_public = true` |
  | Student | own rows + official content; `INSERT` own drafts/attendance; no `UPDATE`/`DELETE` on approved records |
  | Teacher | student rights + `SELECT`/review-comment on drafts in scope |
  | Administrator | full access |

  Sensitive columns (citizen ID, GPS, IP, device fingerprint from §14/§15)
  readable only by administrators — enforced by column-level grants and a
  restricted view, not by hiding fields in the UI.
* `supabase/seed.sql` — departments, clubs, roles, demo rows for the
  Dashboard.

This is in Phase 1 because §28 ranks Security first — building UI against
tables with no RLS is how apps ship with wide-open data.

### 30.5 Auth

* `schemas/auth.ts` — one Zod schema imported by both the client form and
  the Server Action. Rejects anything not ending in `@udontech.ac.th`,
  with a friendlier message for `gmail.com`/`yahoo.com`/`hotmail.com`, in
  Thai and English.
* Domain re-checked server-side in the Server Action, plus a `CHECK`
  constraint on `profiles.email` in the migration — three layers, since UI
  validation alone is never trusted.
* Login page: RHF + Zod, inline field errors, loading/disabled submit
  state, `sonner` toast on failure. Email verification callback at
  `app/[lang]/auth/callback/route.ts`.
* `lib/auth/get-session.ts` and `require-role.ts` — server-side guards
  used by every protected page. Middleware redirects unauthenticated
  users; the role check always happens server-side in the page, never in
  middleware alone.
* Sign-up flow is minimal in Phase 1 (verification-email based);
  admin-managed member provisioning belongs with the Members module.

### 30.6 Layout

No left sidebar (§4).

* `top-nav.tsx` — sticky top bar. Left: logo + wordmark. Center: Home ·
  Calendar · Projects · Activities · Documents · Members · Reports,
  active route underlined. Right: notifications bell (unread dot),
  settings, avatar dropdown (profile/theme/language/sign out).
* Navigation items filtered by role from one `lib/navigation.ts` config —
  single source of truth for desktop and mobile.
* `mobile-nav.tsx` — shadcn `Sheet` hamburger; notifications and avatar
  stay reachable outside the sheet.
* `footer.tsx`, `theme-toggle.tsx`, `language-toggle.tsx`.
* Route groups: `app/[lang]/(public)/` for guest pages, `app/[lang]/(app)/`
  for authenticated pages with its own layout calling the auth guard.
* Full keyboard support: visible focus rings, Escape closes the sheet,
  focus trapped while open, skip-to-content link.

### 30.7 Dashboard

All ten sections from §8 as reusable components: Welcome, Notifications,
Upcoming Meetings, Calendar, Activity Statistics (Recharts), Draft
Documents, Recent Projects, Recent Activities, Member Statistics, Quick
Actions.

* Server Components fetching in parallel; each card wrapped in
  `<Suspense>` with a matching skeleton.
* Every card handles loading/skeleton/empty/error. Empty states carry a
  real call-to-action.
* Responsive grid: 1 column mobile → 2 tablet → 3 desktop; calendar and
  statistics cards span wider.
* Data access lives in `services/dashboard.ts` — typed query functions,
  the single place later phases extend.
* Dev-only fallback: `services/` falls back to `lib/dev-fixtures.ts` when
  `NEXT_PUBLIC_SUPABASE_URL` is unset, so the dashboard is visible before a
  Supabase project exists. Clearly marked, env-guarded, documented in
  README, removed once real credentials land.

### 30.8 Folder structure

Exactly per §26. Directories a Phase-1 feature doesn't touch (`table/`,
`charts/` beyond the one dashboard chart) are created when first needed.

`.env.example` documents every variable. `README.md` covers setup,
applying migrations, and generating DB types.

### 30.9 Verification

Must pass before Phase 1 is reported complete:

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Then, with the dev server running, check in browser:

1. Routing/i18n — `/th` and `/en` render; language toggle preserves path;
   `/` redirects to `/th`.
2. Auth — `student@gmail.com` rejected with friendly Thai message;
   `x@udontech.ac.th` passes; visiting `/th/dashboard` signed-out
   redirects to login.
3. Server-side enforcement — submit login Server Action with a
   `gmail.com` address and JS disabled; still rejected.
4. Themes — light and dark at 375px/768px/1280px; no horizontal scroll.
5. Dashboard — all ten sections render; skeletons during load; empty
   states render when a fixture list is emptied.
6. Accessibility — keyboard-only pass through nav → dashboard → avatar
   menu; focus always visible; contrast check on primary/accent pairings.
7. Thai rendering — tone marks/vowels not clipped at any heading size.

SQL migrations cannot be executed until a Supabase project exists —
verify by parsing/dry-run only and flag that explicitly, not as proven.

### 30.10 After Phase 1

Each a separate approved phase: **Members** (TanStack Table + Query,
filters, 10 rows/page) → **Activities** (+ realtime) → **Projects
workflow** → **Documents + digital signature** → **QR attendance** (most
security-sensitive: GPS, device fingerprint, duplicate protection, all
server-verified) → **Reports & global search** → **Notifications / web
push**.
