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

### ❌ Remaining

* **Custom SMTP (Resend) needs to be manually reconfigured** — cleared as a
  side effect of the round-trip proof above (Authentication → Emails → SMTP
  Settings → toggle "Enable custom SMTP" → re-enter host `smtp.resend.com`,
  port `465`, sender `noreply@udontech.ac.th` / "AFT UDONTECH", username
  `resend`, and the Resend API key as the password → Save). Not urgent: it
  won't actually send until `udontech.ac.th` also finishes Resend's DNS
  verification, which is still pending — check `resend._domainkey.udontech.ac.th`
  resolves before expecting it to work.
* **The remaining four §20 tables / four §30.10 phases** — `project_drafts`
  (Projects workflow), `qr_sessions` + `signature_records` (QR attendance,
  most security-sensitive: GPS/device fingerprint), `audit_logs`. Plus
  Documents digital-signature, Reports & global search, Notifications/web
  push — none of those phases started; each is its own approved phase, in
  that order. **§30.10's Activities phase is now partially consumed** — the
  full §10 UI (search/filters/sort/pagination/statistics) landed above, built
  directly against the existing `activities` table; only **realtime** (the
  other half of that phase) remains outstanding.
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
