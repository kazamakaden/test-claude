# CLAUDE.md — AFT UDONTECH Dashboard

## 0. Phase 1 Status (as of 2026-08-13)

Tracked against the §30 build plan. Grouped by done vs. remaining so status is
scannable at a glance — each item still tags its §30.x subsection for detail.

> **§0 is a running log, not a spec.** Entries are accurate for when they were
> written and are NOT revised afterwards. Three subjects have since changed
> underneath older entries — read the authoritative section instead:
>
> * **Roles and permissions → §6.** `pending` and `aft_teacher` no longer
>   exist (removed in `0046`; a CHECK constraint refuses them). `aft`
>   (นักศึกษา อวท.) and an อวท. ตำแหน่ง axis were added. Any older entry
>   describing `pending`, `aft_teacher`, `approved_accounts` or `/approvals`
>   as current is describing removed machinery.
> * **Student IDs and สาขา → §14.** Department codes are the real OVEC list
>   and สาขา is resolved automatically at sign-in; the codes `31901`–`31906`
>   that appear in older entries were invalid demo data, deleted in `0050`.
> * **E-books → §12 and the FlipHTML5-removal entry below.** There is no
>   flipbook host any more: `flipbook_url` is dropped from both `books` and
>   `documents` (`0053`), `lib/fliphtml5.ts` / `lib/anyflip.ts` /
>   `flipbook-viewer.tsx` / `pdf-viewer.tsx` are deleted, and a book is a PDF
>   in private Storage opened in a new tab. Any older entry describing an
>   AnyFlip or FlipHTML5 embed URL, `resolveBookSource`, or the
>   `books_published_needs_content` constraint is describing removed
>   machinery.

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

**The `/documents`/`/members` error card was silent — fixed to name what
actually broke, self-tested end to end.** Reported live: `/th/documents` on
`test-claude-ka-600a.vercel.app` showed the error card ("ไม่สามารถโหลดข้อมูลได้")
in *both* boundaries (filters and shelf) after uploading a book via a
FlipHTML5 link. Traced every path in both subtrees by reading — `getBookYears`/
`listBooks` both already go through `tryCreateClient()` with their own
`if (error) return …` guards, `getSessionProfile()` fails closed to guest,
`getSignedCoverUrl` guards its storage error, `0027_books.sql`'s `NOT NULL`/
`CHECK` constraints rule out a bad-data crash in `BookCard` — and could not
find the throw. It also didn't reproduce locally (`next build` + `next
start` against a syntactically-valid placeholder Supabase URL/key rendered
the normal empty state, zero error cards). The real defect turned out to be
diagnostic, not functional: `CardBoundary` had no `componentDidCatch` and
`CardError` showed no digest, so a live-only failure was fundamentally
unobservable without redeploying instrumentation first — the same gap
`app/[lang]/error.tsx` already closed for whole-route crashes, never
extended to this per-card boundary.

Fixed in `components/dashboard/card-boundary.tsx`/`card-states.tsx`:
`componentDidCatch` logs to the server console (Vercel Runtime Logs will
carry it), and `error.digest` is captured into state and rendered in
`CardError` as "Error reference: …" — same convention as
`app/[lang]/error.tsx`. Every existing `CardBoundary` consumer (the whole
dashboard) gets this for free, not just Documents.

**A second, more serious defect found in the same code while fixing the
first**: `CardBoundary`'s `getDerivedStateFromError` caught *everything*
thrown by its subtree, including Next's own control-flow signals —
`redirect()`, `notFound()`, dynamic-rendering bailouts all throw internally
and rely on propagating uncaught. A boundary that swallows those turns a
working redirect into a permanent, silent error card instead of letting
Next handle it — and would misfire in exactly the "both boundaries at once"
shape this bug report described, since both `BooksFiltersSection` and
`BooksResults` sit under the same `getRole()`/permission machinery. This
project already learned this exact lesson once for `services/dashboard.ts`
(documented above: "lets `requirePermission`'s `redirect()` propagate
uncaught... must not be swallowed by a `.catch()`"), but `CardBoundary` —
the one place in the codebase that catches errors from an arbitrary Server
Component subtree — never got the same treatment. Fixed with
`unstable_rethrow` (Next's own public API for exactly this, `next/navigation`),
called first in `getDerivedStateFromError` before ever committing the error
fallback.

Closed the two remaining unguarded client constructions in the read path
the same way as the previous pass: `BooksResults`' direct `createClient()`
call and `services/books.ts#getSignedPdfUrl`/`getSignedCoverUrl` now use
`tryCreateClient()` with a null guard. Also hardened `lib/auth/permissions.ts#can`:
`permissionsByRole[role]` would throw on a role value the matrix doesn't
recognize (a real risk given `role` is erased to a plain string at the
database boundary and this project has already hit schema/deploy skew more
than once) — now falls back to an empty permission list instead of
crashing the caller.

**Both fixes were proven working, not just written**, using the same
self-test discipline `scripts/responsive-check.mjs` already established for
this project — temporarily inject the exact failure, observe the fix catch
it, then revert:
1. Made `getBookYears()` throw, ran a real `next build` + `next start`.
   Server console showed `⨯ Error: TEMP_SELF_TEST_getBookYears … digest:
   '236722411'`. Loaded the page in a real headless Chrome tab over CDP
   (the same raw-DevTools-Protocol technique `responsive-check.mjs` uses)
   and read `document.body.innerText`: `"...ไม่สามารถโหลดข้อมูลได้\n\nลองใหม่อีกครั้ง\n\nError
   reference: 236722411..."` — the exact same digest, connected end to end
   for the first time. The shelf boundary (untouched by the injected throw)
   correctly still rendered its normal empty state alongside it, confirming
   the two boundaries fail independently as designed.
2. Put a `redirect()` inside `BooksFiltersSection`, rebuilt, loaded in the
   same real browser, and read `location.href` after settling: it had
   actually navigated to the redirect target — confirming
   `unstable_rethrow` really propagates the signal through the boundary
   instead of silently eating it. Both temporary changes were reverted
   immediately after capturing their result; `git diff` confirms no
   self-test residue shipped.

`npx tsc --noEmit && npm run lint && npm run build` all pass. Re-ran the
previous pass's full regression: no-env-vars `/th/documents`, `/en/documents`,
`/th/members`, `/en/members` all still **200** (not the pre-fix 500), and
`npm run check:responsive` (72/72) passes clean including the new "Error
reference" markup width.

**Not closed by this pass**: this makes the failure name itself; it does
not fix whatever is actually failing on `test-claude-ka-600a.vercel.app`
today, since that cause is still unidentified and this session still cannot
reach either the live site or the live Supabase project. The next production
occurrence's Vercel Runtime Logs — or the digest now shown directly on the
error card — should answer that immediately, unlike this report which had
neither.

**Dashboard calendar day cells are now clickable, and the empty slot beside
them is filled with a live Thai holiday list.** Two real gaps on
`/th/dashboard`'s ปฏิทิน: the grid was fully read-only (a plain `<div>` per
day, no way to see or add anything — in fact nothing anywhere in the app
could create an `activities` row before this pass, despite RLS having
allowed `aft_teacher`/`admin` writes there since `0011`), and the dashboard
grid's `xl:grid-cols-3` layout left the third column empty next to the
calendar's `md:col-span-2`.

**Clicking a day** opens `components/dashboard/calendar-day-sheet.tsx`,
showing that day's activities to everyone; staff (`activity:manage` —
aft_teacher/admin, the same RLS boundary `activities_insert_aft_teacher`/
`activities_update_aft_teacher`/`activities_all_admin` already enforce, 0008/
0011) additionally get inline Edit/Delete per activity and an "add" form,
sharing one form component for create and edit. No migration was needed —
the write boundary already existed, only the UI and the write path
(`actions/activities.ts`, new) didn't. `requirePermission("activity:manage",
lang)` re-checks server-side in every action, never trusting the page guard.
Times are combined with the clicked date and anchored to `+07:00`
(Asia/Bangkok) explicitly in `services/activities.ts#toBangkokInstant` rather
than the server runtime's own timezone (Vercel's Node runtime defaults to
UTC) — without this, a staff member typing "09:00" would store a timestamp
that only renders as 09:00 by accident of where the server happens to run.
`calendar-card.tsx` split into a server shell (fetches data) +
`calendar-grid.tsx` (client, owns which day is selected) — day cells are
real `<button>`s, not a `<div onClick>`, so they stay keyboard-reachable
(§24); Enter/Space opens the sheet the same as a click, verified directly
(not assumed) via a real headless Chrome tab over CDP with a synthetic day
click, confirming the sheet opens with the add form present for `admin` and
absent for `student` — `can(role, "activity:manage")` is `true` only for
`aft_teacher`/`admin`, confirmed by reading the actual matrix in
`lib/auth/permissions.ts` rather than assumed. Escape-closes-sheet was
verified the same way (`sheetStillVisible: false` after a real
`Input.dispatchKeyEvent` Escape).

**ปฏิทินวันหยุด** (`components/dashboard/holiday-card.tsx`, new) sources Thai
public holidays from the exact Google Calendar the user pointed at
(`th.th#holiday@group.v.calendar.google.com`, the `src` of
`.../newembed?src=...`) — not an embedded iframe (Google's own blue chrome
would clash with the §3 monochrome palette and doesn't fit at 375px), but a
plain `fetch` of that calendar's public ICS export, parsed by a small
hand-rolled RFC 5545 reader in `services/holidays.ts` and rendered as a
native scrollable list (`max-h-80 overflow-y-auto`) in the app's own card
styling. Renders beside the calendar at `xl` (CSS grid's default sparse
row-major auto-placement naturally fills the otherwise-empty third column,
verified rather than assumed — no `grid-auto-flow` override needed) and
stacks below it at `md`/mobile.

Two real correctness details the parser has to get right, both unit-tested
against a synthetic-but-format-accurate ICS sample (line-folded per RFC
5545 §3.1, since Thai holiday names are long enough to fold at the 75-octet
boundary) rather than assumed: unfolding a continuation line before reading
`SUMMARY`/`DTSTART` (a naive line-by-line reader would silently truncate a
folded name at the fold point), and unescaping RFC 5545 TEXT escaping
(`\,` `\;` `\n`) in `SUMMARY`. All assertions passed, including a folded
long name round-tripping intact.

`getHolidays()` fails soft to `[]` on any fetch/parse problem — same
contract as every other list service in this codebase — which is also the
**directly observed** behavior here, not just designed-for-but-unverified:
`calendar.google.com` is blocked by this session's network policy (confirmed
`000` on both the ICS and embed URLs), so the empty-state path
("ไม่พบข้อมูลวันหยุด") is what actually rendered in every check this pass ran.
**The live feed itself — real reachability, the actual Thai holiday names,
and the guessed `en.th#holiday@…` English sibling calendar's existence — is
unverified and stated as pending, not done.** Confirm once deployed.

**Two related fixes discovered while building this, applied while already in
the code rather than deferred:**
1. `services/activities.ts#getMonthActivities` switched from `createClient()`
   to `tryCreateClient()` — the same read-only-list-should-fail-soft
   convention already applied to `listBooks`/`getBookYears`/`getMembers` in
   prior passes, which this function had been missed by. Concretely surfaced
   during this pass's own dev-mode testing: with no Supabase configured, the
   calendar card's `CardBoundary` was catching a synchronous
   `createClient()` throw exactly like the pre-fix `/documents` bug, just
   contained rather than fatal this time. `listActivities`/`getActivityCounts`
   (the full `/activities` page, untouched by this feature) were
   deliberately left as-is — out of scope, not silently "also fixed."
2. `types/activities.ts#MonthActivity`/`services/activities.ts#getMonthActivities`
   gained `description`/`endsAt` columns, and `services/dashboard.ts`'s
   `getCalendarEvents`/`CalendarEvent` (a narrower wrapper that existed only
   to feed the old read-only mini-grid) were deleted as dead code once the
   day-sheet needed the richer shape directly — `/calendar`'s `MonthGrid`/
   `MonthEventList` simply don't read the two new fields, verified via a
   clean `tsc` pass rather than assumed safe.

**Live-verification gap, stated plainly**: creating/editing/deleting a real
activity end-to-end, and confirming RLS actually rejects a `student`
attempting the same write, both need the live proof pass this project has a
precedent for (`0005`/`0008`/`0011`'s role-matrix checks) — this session has
no reachable Supabase project. The UI-side gate (`canManage` hiding the
form) was verified directly via the dev-role cookie stub; the
`requirePermission` server-side re-check was verified by reading the code
and confirming it's the same call already proven in `actions/members.ts`,
not independently exercised against a live database this pass.

`npx tsc --noEmit && npm run lint && npm run build` all pass clean.
`npm run check:responsive` (72/72, public pages) stays clean, confirming the
`MonthActivity` type change didn't regress `/calendar`. The dashboard itself
is authenticated so the script's own credential-less mode skips it (stated,
not silently passed) — checked separately via the dev-role cookie stub and
the same real-viewport-emulation CDP technique: 375/768/1280, `admin` role,
zero horizontal overflow at any width.

**The persistent `/documents` production crash (digest `2646013012`, seen
across many separate reports and several unrelated fix passes) is now
actually root-caused and fixed — the digest was misleading, not stale.**
Every earlier pass ruled out Supabase/RLS (confirmed clean via
`get_logs`/`execute_sql` — every query for `/documents` returns `200` with
well-formed rows) and improved the *failure handling* around this route
(`tryCreateClient`, `CardBoundary` digest surfacing, `unstable_rethrow`), but
none of that touched the actual defect, because it isn't a data or RLS
problem at all. The real cause, obtained directly from a Vercel Runtime Logs
line the user pulled up (matching the same digest): **"Event handlers cannot
be passed to Client Component props"**, thrown for a `<button
onClick={...}>`.

`components/books/book-card.tsx` (`BookCard`) is an **async Server
Component** — every book in the shelf renders through it. When `canDelete`
is true (a real signed-in owner or staff member viewing a real book —
exactly the condition this session's static-only review, with no reachable
Supabase project, could never trigger locally), it built a `<button
onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}>`
JSX element **in the Server Component** and passed it as the `trigger` prop
into `DeleteBookButton` (`"use client"`). A function cannot cross that
Server → Client serialization boundary — React throws mid-render the moment
it tries to serialize the RSC payload, which is exactly why the page's outer
HTTP status stayed `200` (the static shell around it is fine) while the
shelf's own `CardBoundary` caught the throw and rendered the error card,
with the identical digest every single time regardless of which book, which
build, or which live database state — because the bug is structural, not
data-dependent, and was present continuously since this trigger button was
first written, never actually fixed by any of the several passes that
worked around its symptoms instead.

Fixed by moving the `onClick` out of the Server Component entirely:
`book-card.tsx`'s trigger `<button>` now carries only serializable props
(`type`/`aria-label`/`className`/`children`); `delete-book-button.tsx` gained
a `stopTriggerPropagation?: boolean` prop and applies the
preventDefault/stopPropagation `onClick` directly on `AlertDialogTrigger`
itself — which is already inside the client component, so the handler is
constructed client-side and never needs to be serialized across the
boundary. The detail-page call site (`app/[lang]/(public)/documents/[id]/page.tsx`)
was unaffected — its trigger (a plain `<Button variant="destructive">`) never
carried an inline `onClick`, so only the shelf card had this defect.
`npx tsc --noEmit && npm run lint && npm run build` all pass clean.

**Not verified live**: this session still cannot reach the deployed site or
the live Supabase project directly (confirmed again this pass — direct
`curl` to both hosts times out), so the fix is verified by exactly matching
the reported error's mechanism and removing the only place it could occur,
not by reproducing the crash and watching it disappear in a real browser.
Confirm after this deploys: sign in as the real book owner or staff, load
`/documents`, and check the shelf renders books (with a working delete
button) instead of the error card.

**Book detail page now shows the file to the person who uploaded it, and
approved members can be sent back to `pending`.** Two independent gaps
reported after the crash fix above landed.

*Book reader vs. edit form.* `app/[lang]/(public)/documents/[id]/page.tsx`
rendered the reader and the edit form as **mutually exclusive** branches of
one ternary — `canEdit && viewerId ? <BookEditForm/> : <reader/>`, with
`canEdit = isStaff || (isOwner && book.status === "draft")`. Concretely: an
owner mid-draft, and **every staff member on every book regardless of
status**, saw only the metadata form and could never see the actual PDF or
flipbook they were supposed to be reviewing before publishing it. The
storage RLS already allowed it (`books_storage_select_authenticated`,
`0029_books_storage.sql`, lets staff mint a signed URL for any draft) — this
was purely the page's own UI branch. Fixed by splitting the ternary: the
reader renders first when a file is attached, the edit form renders below it
whenever the viewer can edit, and the "no book attached" warning is
suppressed specifically when the viewer can edit *and* nothing is attached
yet (the fresh-draft case `createBookAction` redirects straight into), so a
brand-new book opens on the upload form instead of an alarming empty state.
A secondary gap in the same block — a book with **both** a FlipHTML5 URL and
a PDF made the PDF unreachable, since `resolveBookSource` picks the flipbook
as primary and the page never checked `pdfPath` on its own — closed with a
new `PdfDownloadLink` secondary link. The identical "not attached" empty
state duplicated between `pdf-viewer.tsx` and `flipbook-viewer.tsx` was
extracted to `components/books/book-not-attached.tsx` in the process, rather
than adding a third copy.

*Revoking approval.* Confirmed the §14 signup split needs no change —
numeric local part → `pending` (blocked, needs approval), named → `teacher`
immediately (`0023_handle_new_user_role_split.sql`) — a random student
genuinely cannot reach the app without an admin/aft_teacher approving them
at `/approvals` first. What was missing was the reverse: once approved,
there was no way to take access back short of permanently deleting the
account. Grepped `revoke|unapprove|reject` across the whole app first to
confirm — every hit was the unrelated project/document rejection workflow;
nothing anywhere wrote `role = 'pending'`.

**No migration was needed.** Traced `prevent_role_self_escalation`
(`0024_member_approval_authority.sql`) by hand for `old.role='student' →
new.role='pending'` with an admin/aft_teacher actor: it falls straight
through every guard to `if actor in ('admin','aft_teacher') then return new`
— there never was a downgrade guard, only an upgrade one. Two properties
come free from that same trigger and are relied on rather than
re-implemented: self-revoke is already blocked (`new.id = auth.uid()`
raises) and admin rows are already protected (`old.role = 'admin'` requires
an admin actor). The only things blocking a revoke were app-layer TS/Zod
exclusions on `setProfileRole`/`updateMember`.

New `revokeProfileApproval(id)` (`services/profiles.ts`) — deliberately a
*separate* narrow function from `setProfileRole`, not a widened version of
it: `setProfileRole`'s `.update({ role, department_id: departmentId })`
would have wiped the member's department on every revoke, and it lacks
`.select().maybeSingle()`, so a blocked/zero-row update would read back as a
false `{ ok: true }`. The new function updates `role` alone and treats a
zero-row result as a real failure, matching `updateMember`'s existing
discipline. New `revokeMemberAction(lang, id)` (`actions/members.ts`, beside
`deleteMemberAction`) gates on `member:approve` (admin + aft_teacher — the
same tier that can approve, not the stricter `member:manage` delete uses),
and re-checks both guards server-side exactly like `deleteMemberAction`
does: refuses self-revoke via `supabase.auth.getUser()`, and refuses an
`admin` target by re-reading that row's role from the database rather than
trusting the form. `revalidatePath`s both `/members` and `/approvals`, since
a revoked row disappears from one list and reappears in the other — neither
existing action revalidated both.

Surfaced from `/members` (not `/approvals`, which only ever lists `role =
'pending'` rows, i.e. people already un-approved) via a new
`MemberRevokeDialog`, modeled directly on the existing
`MemberDeleteDialog` (`AlertDialog` + `useTransition` + toast), mounted in
`members-table.tsx` next to Edit/Delete, shown whenever the viewer holds
`member:approve` — `services/members.ts#getMembers` already excludes
`role = 'pending'` rows from this table (`.neq("role", "pending")`), so
every row shown here is a safe revoke target with no extra state check
needed. New `members.revoke.*` dictionary keys added to **both**
`th.json`/`en.json`.

**Wording note, stated plainly rather than glossed over**: revoking sets
`role = 'pending'`; the person can still *authenticate* (Google/password
still work) but every `requirePermission`-guarded route bounces them to
`/pending` on their next request, so they cannot reach any part of the app,
and they reappear in `/approvals` for re-approval. A true
"cannot-authenticate-at-all" block would need Supabase's `banned_until` via
the Admin API — deliberately not built, since permanent delete
(`deleteMemberAction`, already existing, admin-only) already covers that
case, and a deleted person signing up again correctly re-lands at `pending`
through `handle_new_user()` — verified by reading the trigger, not
re-implemented.

`npx tsc --noEmit && npm run lint && npm run build` all pass clean.
`npm run check:responsive` (72/72, public pages, including `/th/documents`
and `/th/members`) stays clean.

**Not verified live**: this session still cannot reach the deployed site or
the live Supabase project (`curl` to both hosts times out; the Supabase MCP
connector disconnected mid-session), so neither change was exercised against
a real signed-in owner/staff session or a real member row. Confirm after
deploy: staff opening a published *and* a draft book both see the file above
the edit form; a fresh `/books/new` draft opens on the upload form with no
warning; revoking a member from `/members` bounces them to `/pending` on
their next navigation and they reappear in `/approvals`; revoke is refused
for the caller's own account and for an admin target even when called
directly, not just hidden in the UI.

**Six-task pass: the `0030` live-schema gap closed, a real content page, a
real `/profile`, a Settings overlay (password/font-size/push), and genuine
PDF downloads — this session had live Supabase MCP access throughout, a
first for several of these.**

1. **`0030_profiles_password_set.sql` applied live** — it had been sitting
   in the migration file, unapplied, since the section above first
   documented it (that section's own `types/database.ts` header comment
   already recorded the resulting `42703 undefined column` breaking "Add
   user"). Applied via the Supabase MCP this session; re-verified against
   `information_schema.columns` and that `password_set` is in fact
   `authenticated`-selectable per its own migration's grant.
2. **`/aft-11`** ("11 ดี 11 เก่ง อวท.") — a new public content page, backed
   by `content_blocks` (`0031_content_blocks.sql`, one row per `slug`,
   `title_th`/`title_en`/`body_th`/`body_en`), not a hardcoded page — an
   admin can edit the copy without a deploy. RLS (`0032`) is anon/
   authenticated `SELECT` for everyone, `UPDATE` for `admin`/`aft_teacher`
   only, both applied and confirmed live via `pg_policies`. `services/content.ts`
   uses `tryCreateClient()` (fail-soft, same convention as every other read
   path in this codebase), `actions/content.ts` re-checks
   `content:manage` server-side. Nav entry added to `lib/navigation.ts`
   (public, no permission gate) and both dictionaries.
3. **`/profile`** — replaced the `PageShell` "coming soon" stub. Only
   `full_name` is actually editable by the viewer (`actions/profile.ts` →
   `services/profiles.ts#updateOwnProfile`, gated on `profile:update`,
   target row always the caller's own session id, never a form value);
   role/student ID/department/class/club render read-only with an
   explanatory note, since `prevent_member_identity_change` (0025) would
   reject a self-edit of those anyway — matching the established "don't
   build a form the database will just reject" discipline this file
   already applies elsewhere. Added a real `<form action={signOut.bind(null,
   lang)}>` sign-out button (`components/layout/sign-out-button.tsx`) —
   the *only* sign-out entry point in the app that works with JavaScript
   disabled, since the existing menu-item sign-outs in `user-menu.tsx`/
   `mobile-nav.tsx` live inside JS-only Base UI overlays that can't open
   without JS in the first place.
4. **Settings as a blurred-overlay dialog**, reachable from both the
   desktop dropdown and the mobile sheet, not a route — replaces the
   dead `toast.info(comingSoon)` stub the Settings menu item previously
   called. `SettingsDialogProvider` wraps `UserMenu`+`MobileNav`
   unconditionally in `top-nav.tsx` (not conditionally on role) so
   `useSettingsDialog()`/`useSignOut()` can be called unconditionally at
   the top of both consumers — calling a hook only after a `role ===
   "guest"` early return would violate rules-of-hooks the moment role
   changes without a remount, checked for directly rather than assumed
   safe. Mobile's Settings trigger closes the sheet before opening the
   dialog (`setOpen(false)` then `openSettings()`) — two simultaneously
   open Base UI Dialogs would mean two stacked focus traps.
5. **Settings contents**: password change/set
   (`change-password-section.tsx` + `actions/settings.ts#changePasswordAction`,
   a deliberately *new* action rather than a reuse of the recovery-flow
   `updatePassword` — this one must NOT sign out/redirect, the recovery one
   must; documented trade-off: the current password isn't verified, since
   `updateUser({password})` doesn't check it and re-authenticating would hit
   this project's project-level Turnstile requirement with no captcha
   widget available in a settings dialog — mitigated by requiring a live
   session, the existing 12-hour session cap, and revoking every *other*
   session on success), font size (`font-size-section.tsx`, a `data-font-size`
   attribute + cookie read server-side in `app/[lang]/layout.tsx` to avoid a
   flash of default size), and web push opt-in (`push-section.tsx` +
   `public/sw.js` + `push_subscriptions` table, `0033`/`0034` — RLS applied
   and confirmed live via `pg_policies`: owner-only `SELECT`/`UPDATE`/
   `DELETE`, `INSERT` additionally requires `current_role()` to be a real
   member role, not `pending`/`guest`). Renders nothing at all when
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset — same "hide the control rather
   than render one that can only fail" pattern as `isTurnstileConfigured`/
   `isSupabaseAdminConfigured` elsewhere in this codebase — then degrades
   through unsupported-browser and permission-denied states before ever
   showing a live toggle. This phase only stores subscriptions; it does not
   send pushes (`VAPID_PRIVATE_KEY` is documented in `.env.example` but
   deliberately unused by any code this pass — sending is a later phase).
6. **Downloadable documents** — `PdfDownloadLink`/`PdfViewer` previously
   only ever opened a PDF in a new tab (`target="_blank"`), which most
   browsers still render inline rather than save; neither actually
   triggered a download despite the former's name. `services/books.ts#getSignedPdfUrl`
   gained an optional `downloadAs` filename, passed through to Supabase
   Storage's own `createSignedUrl(path, ttl, { download })` option
   (`Content-Disposition: attachment` on the response) — a plain HTML
   `download` attribute is silently ignored across an origin boundary, and
   Storage is always cross-origin from the app, so this is the only way
   that actually works. `PdfViewer` now mints a *second*, separate signed
   URL specifically for the download link rather than reusing the inline
   viewer's URL — forcing `Content-Disposition: attachment` on the same URL
   used by the `<object>` tag risked turning the inline preview into a
   forced download too. `lib/books.ts#bookPdfFilename` strips characters
   illegal in a `Content-Disposition` filename (quotes, control/path
   separators) while leaving Thai script intact, since this project's book
   titles are frequently Thai.

**Live-verified this pass, via the Supabase MCP directly** (not `curl`,
not assumed from reading policy SQL): `0030` applied and its column grant
confirmed; `0031`–`0034` applied and every new table's `pg_policies` read
back to confirm the intended role/command matrix, matching this project's
established `0005`/`0008`/`0011`-style live-proof discipline rather than
trusting the migration file alone. `npx tsc --noEmit && npm run lint &&
npm run build` all pass clean, including a full 54-route static generation
pass with the new `/profile` and `/aft-11` routes. **Not verified live**:
the actual signed-in click-through for all five UI-facing changes (Settings
dialog open/close on both breakpoints, a real password change, a real push
subscribe/unsubscribe round trip including a delivered notification, a real
PDF download's `Content-Disposition` header observed in a live response) —
this session had live database access but not a live deployed frontend or
a real signed-in browser session; that gap matches every prior pass's own
stated limitation, not a new one introduced here.

**Dashboard calendar compacted, ปฏิทินวันหยุด merged and made to fill the
card, month navigation added, and the first real realtime usage in the
codebase — scoped to the dashboard calendar specifically, not `/activities`.**
Reported live with a screenshot: the month grid's `aspect-square` cells blew
up to 113×113px once the merged calendar+holiday card (see the "Dashboard
calendar day cells are now clickable" entry above) went full-width, six rows
running to ~680px and dwarfing the rest of the dashboard; ปฏิทินวันหยุด's own
`max-h-80` cap left visible dead space below it once the grid shrank; and
there was no way to change the displayed month at all. Fixed: `h-12` fixed
row height (wide-cell month-view shape, grid → 336px); `holiday-list.tsx`
stretches (`flex h-full` + `flex-1` on the list) to match the grid's height
exactly — verified via CDP that the grid's, panel's, and list's bottom edges
land on the identical pixel. New `components/dashboard/calendar-month-nav.tsx`
renders `‹ สิงหาคม 2026 ›` in the card's `CardAction` slot, reusing
`schemas/calendar.ts`'s existing `parseMonthParam`/`formatMonthParam` and the
`calendar.previousMonth/nextMonth/today` dictionary keys `/calendar`'s own
`MonthNav` already uses — no new i18n keys, plain `<Link>`s so paging works
with JS disabled. `CalendarGrid` gained a `monthIso` prop and switched its
"today" check from date-fns's `isToday()` (reads the browser clock) to
comparing against the passed-down `todayIso`, so the highlight stays correct
while a non-current month is displayed.

Realtime: `0035_activities_realtime.sql` adds `public.activities` to the
`supabase_realtime` publication — applied live and confirmed via
`pg_publication_tables`. Supabase's Realtime server evaluates each
subscriber's own SELECT RLS (`activities_select_public`/
`activities_select_authenticated`, 0008) before forwarding a row, so this
doesn't widen visibility, only pushes already-visible rows instead of
requiring a refetch — confirmed via `get_advisors` showing no new finding
from the change. `CalendarGrid` seeds local state from the server-provided
`events` prop, resets it whenever that prop changes (a month-navigation
re-render), and separately subscribes to `postgres_changes` on `activities`
for the displayed month's date range, merging INSERT/UPDATE into state (or
dropping a row that moved outside the range) and removing on DELETE.

**A real regression was found and fixed while building this, not left for
someone else to hit:** the browser `createClient()`
(`lib/supabase/client.ts`) asserts its env vars are present and throws
immediately when they're not; called unconditionally from `CalendarGrid`'s
new effect, that throw would have propagated to the dashboard page's
`CardBoundary` and taken the *entire* calendar card down in any environment
without a live Supabase project configured — exactly the class of bug this
project has already fixed more than once for the server-side client
(`tryCreateClient()`). Guarded with the existing `isSupabaseConfigured` flag
(`lib/supabase/env.ts`, already safe to import client-side — no
`server-only`), which now short-circuits the effect instead of subscribing.
Verified live in this session's dev-fixture environment (no `.env.local`):
before the guard, the console showed `createClient` throwing from inside the
effect; after, the calendar card renders cleanly with zero console
errors/exceptions from the realtime path — the other pre-existing "cannot
load data" error cards visible on the same screenshot (Notifications,
Upcoming Meetings, etc.) are unrelated, already-documented behavior of their
own server-side `services/*.ts` calls, not something this pass touched.

**Not verified live**: an actual `postgres_changes` event being received by
a real connected browser — this session's outbound network is blocked to
`*.supabase.co` directly (confirmed via a timed-out `curl`, the same
limitation already documented for `calendar.google.com` and the Vercel
domains), even though the Supabase MCP connector itself can reach the
project for `execute_sql`/`apply_migration`/`get_advisors`. The publication
membership and RLS-enabled state were confirmed live via SQL; the
subscribe → receive → merge-into-state round trip was not observed in a
real browser and needs the same live click-through proof this project's
other realtime-adjacent gaps already call for.

`npx tsc --noEmit && npm run lint && npm run build` all pass clean.

**§16 Notifications: the feature had no write path at all — built, and the
whole read path rebuilt around per-user read state (migrations `0036`–`0038`,
all applied and proven live).** `.from("notifications")` appeared exactly once
in the entire codebase, as a *read* (`services/dashboard.ts`). Nothing ever
created a notification: every row on screen came from `seed.sql`, and every
approval, submission, rejection and account change notified nobody.

Two structural problems were fixed before any writer was added, because both
would have been baked in permanently otherwise:

1. **i18n.** The seeded rows store Thai prose directly in `title`. A
   notification is read by the *recipient*, whose locale is unknown at write
   time, so text baked in at insert time is wrong for half the audience.
   System-generated rows instead store `message_key` + `message_params`
   (jsonb) and are translated at render time from the same dictionaries as
   the rest of the app (§30.3), via new `lib/i18n/interpolate.ts` +
   `lib/notifications.ts`. `title` stays `NOT NULL` and carries the entity's
   own name, so free-text announcements and the existing seeds keep working
   untouched. `accountApproved` stores the raw role enum and the renderer maps
   it through the existing `dict.roles` rather than storing a second localized
   copy.
2. **Read state.** `notifications.read` was one boolean on a row that, for
   broadcasts (`recipient_id is null`, §16), is *shared by every user* — one
   person marking it read would mark it read for all. In practice nobody could
   even do that: `notifications_update_own_read` (0008) required
   `recipient_id = auth.uid()`, never true for a broadcast, so a badge built
   on that column would have shown a count no user could ever clear. `0037`
   drops the column outright and moves read state into `notification_reads`
   (one row per notification+user), which works identically for personal and
   broadcast rows. Users now need no UPDATE privilege on `notifications` at
   all.

**Writers are triggers, not application inserts** (`0036`), the same choice
`enforce_project_status_transition`/`handle_new_user` already make here: a
Server Action, a future Edge Function and a manual Table Editor fix all
notify, and since they are `security definer` there is still deliberately no
INSERT policy on `notifications` for `authenticated` — a signed-in user cannot
forge a notification addressed to someone else. `notify_roles()` fans out to
reviewer roles and **always excludes the actor** (notifying the person who
just performed the action is noise, never news). Covered: project
submitted/recommended/approved/rejected, document awaiting-approval/approved/
rejected (`signed` deliberately silent — the owner just signed it on screen),
and account approved/revoked across the `pending` boundary. All four functions
had `EXECUTE` revoked in the same migration that defines them — the exact
`0011`→`0012` trap this file already records, checked for directly rather than
rediscovered.

**A real defect this design avoided, confirmed live rather than reasoned
about.** `notifications_all_admin` (0008) is permissive and OR's with the
own-or-broadcast policy, so for an admin RLS alone matches *every* row in the
table, including other users' private targeted notifications. RLS is the
security floor here, not the definition of "my notifications", so all three
RPCs (`get_unread_notification_count`, `mark_all_notifications_read`,
`list_notifications`) spell out `recipient_id = auth.uid() or recipient_id is
null` explicitly. Proven with a real targeted notification addressed to the
demo student: an admin JWT reading it through the app RPC returned **0 rows**,
while a raw `select` on the same table as the same admin returned **1** —
demonstrating the filter is load-bearing, not decorative. Per-user read state
was proven the same way: the student marked all 3 broadcasts read (unread
3 → 0, 3 `notification_reads` rows written) while the admin's unread count
stayed **3**, which a single shared boolean could never have produced.

**Full live trigger matrix**, run against the hosted project with real JWT
claims (`set local role authenticated` + `request.jwt.claims`), not
service-role shortcuts: student submits → exactly the 3 reviewers notified and
the submitting student excluded; aft_teacher recommends → 2 admins notified,
the recommending aft_teacher excluded, owner gets `projectRecommended`; admin
approves → owner gets `projectApproved`; admin rejects with a Thai reason →
owner gets `projectRejected` with the reason round-tripped intact through
jsonb; revoke and re-approve both fire with the correct `/pending` and
`/dashboard` links. Grants re-checked afterward: the four trigger functions
are callable by nobody, the three app RPCs by `authenticated` only. Every
test row, the temporary project, the temporary role change and all read-marks
were deleted afterward and the database confirmed back to its 3-seed baseline.

**A self-caused regression, caught before shipping rather than in
production.** `0037` dropping the `read` column immediately broke
`services/dashboard.ts#getNotifications`, which still did
`.select("id, type, title, created_at, read")` — and worse, broke it
*silently*: its `if (error || !data) return []` guard swallows the `42703
column "read" does not exist` error, so the dashboard's Notifications card
would have shown "no notifications" forever instead of failing visibly.
Confirmed live (the exact 42703), then fixed by deleting that fetcher and the
now-dead `Notification` type entirely and routing the card through the new
`services/notifications.ts#getRecentNotifications`, so the dashboard card and
the full page share one read path with correct per-user read state.

**`/notifications` is a real page**, replacing the `PageShell` "coming soon"
placeholder (one of the five §30.10 placeholders this file lists): All/Unread
filters as plain `<Link>`s (URL state, shareable, works with JS disabled per
§30.9 item 3), 20-rows/page pagination reusing `components/table/pagination.tsx`,
localized relative dates, unread rows visually distinguished, per-type badges,
and a "mark all read" button rendered only when something is actually unread.
`services/notifications.ts` uses `tryCreateClient()` (fail-soft), matching
every other read path here.

**The notification bell was decorative and is now wired.**
`components/layout/notifications-button.tsx` was a `<Button>` with no `href`
and no handler, and its `unreadCount` prop defaulted to 0 and was never passed
by `top-nav.tsx` — so it navigated nowhere and the unread dot could never
appear under any circumstances. Now a real link to `/notifications` with a
live count, split into `notifications-bell.tsx` behind `<Suspense>` so the
nav (rendered on every page) never blocks on a notification query. Two further
fixes made in passing: the old component set both an `aria-label` *and* an
`sr-only` span with the count — an `aria-label` overrides element content, so
the count was never announced to a screen reader; the count now lives in the
accessible name itself. And the visibility gate moved from `role !== "guest"`
to `can(role, "notification:read")`, because `pending` sits at guest-level
permissions — the old check gave a pending user a bell that could only bounce
them back to `/pending`. Verified per role against the running app:
student/teacher/aft_teacher/admin get the bell, `pending` and `guest` do not.

**The "สแกน QR เข้าร่วมกิจกรรม" quick action was removed rather than left
lying.** It pointed at `/activities` — a plain table with no scanner anywhere
in it. Grep-confirmed §13 QR attendance has *no* implementation at all (no
`qr_sessions` migration, no scanner dependency, and nothing anywhere writes to
`attendance`; the only hits are comments saying it is deferred). A button that
promises a QR scanner and delivers a list is worse than no button, so the
entry and its now-orphaned dictionary keys were removed from both locales,
with a comment in `services/dashboard.ts` saying to re-add it with that phase.

`npx tsc --noEmit && npm run lint && npm run build` all pass clean, including
the new `/[lang]/notifications` route. Dictionary key parity between
`th.json`/`en.json` was checked programmatically, not by eye.
**Not verified live**: the signed-in browser click-through — a real user
clicking the bell, marking notifications read, and paging the list — because
this session has no `.env.local` and outbound access to `*.supabase.co` is
blocked (`curl` returns `000`), the same limitation prior passes record. The
database half *was* proven live via the Supabase MCP as described above, and
the pages were verified against a running dev server with the `dev_role`
cookie stub: guest correctly 307s to `/login`, student gets 200 on
`/th/notifications`, `?filter=unread` and `/en/notifications`, both empty
states render their distinct copy, and the dashboard still renders with the
QR action gone.

**Three defects found by code review of the notifications commit, all fixed
and verified (migration `0039`).** Recorded because two of them are the kind
that only show up in a state this session cannot reach live:

1. **Opening a notification never marked it read.**
   `markNotificationReadAction` was written but had *zero callers* — dead code
   — so unread state could only be cleared in bulk, which also cleared items
   the user had never opened, making the unread count meaningless. Wired via a
   new client `components/notifications/notification-item.tsx`. Degrades
   correctly with JS off (§30.9 item 3): the linked case is still a real
   `<Link>`, so navigation works and the row just stays unread; only the
   mark-on-open *side effect* needs JS, never the navigation itself. An unread
   row with no link becomes the "mark as read" control itself.
2. **The `accountRevoked` notification was unreachable by its only
   recipient.** 0036 addressed it to the user whose role had just become
   `pending` — but `pending` holds guest-level permissions, so it lacks
   `notification:read` (no bell) *and* `workspace:access`, which every
   `app/[lang]/(app)` route requires (so `/notifications` bounces them to
   `/pending`). Doubly blocked. Worse, it doesn't stay invisible: on later
   re-approval the stale "your access has been suspended" surfaces in their
   history *after* access was restored — actively misleading. `0039` drops
   that insert (keeping `accountApproved`, which is genuinely readable since
   the recipient regains `notification:read` by definition); `/pending` is
   what actually informs a revoked user, and an admin-side record belongs in
   `audit_logs` (§20, deferred), not a user-facing inbox. Verified live:
   revoke now writes 0 rows, approve still writes 1, and — the `0011`→`0012`
   trap checked for directly again — `create or replace` did not resurrect
   the `EXECUTE` grant, confirmed against `role_routine_grants`.
3. **An out-of-range `?page=` stranded the viewer.** `total` is read off the
   returned rows, so a page past the end yields `total: 0`, and
   `components/table/pagination.tsx` renders *nothing* at `total === 0` — an
   empty page with no link back to page 1. The page now redirects to page 1
   of the same filter. Verified against the running dev server:
   `?page=99` → `307` to `/th/notifications`, `?filter=unread&page=99` → `307`
   preserving `?filter=unread`, `/en/notifications?page=5` → `307`, while a
   genuinely empty page 1 correctly stays `200` and renders its empty state.

`npx tsc --noEmit && npm run lint && npm run build` all pass. The orphaned
`accountRevoked` dictionary entry was removed from both locales and key parity
re-checked programmatically. **Not verified live**: the mark-on-open round
trip needs real notification rows in a signed-in browser, which this session
still cannot reach — the action, its RLS (`notification_reads_insert_own`) and
the bulk path were all proven live earlier, but the per-item click was not.

**Dashboard calendar card no longer runs past the screen; the avatar now opens
Settings directly; the web-push toggle can finally appear.** All three reported
from live production while signed in.

1. **The calendar card was enormously tall** (screenshot: holidays listed out
   to 2029, dead space beside the month grid). Two compounding causes.
   `services/holidays.ts#getHolidays()` filtered `date >= today` and sorted but
   **never bounded the result** — Google's Thai ICS carries years forward, so
   it returned ~100 rows. And the height cap never engaged:
   `holiday-list.tsx` used `flex h-full` → `flex-1 min-h-0` → a `h-full
   overflow-y-auto` list, which only constrains when the *parent* is bounded —
   but in `calendar-card.tsx`'s `xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`
   the row height is set by its tallest child, which was this very list, so it
   stretched instead of scrolling. **Why it passed review before:** this file
   already records the panel as "verified via CDP that the grid's, panel's and
   list's bottom edges land on the identical pixel" — that check ran in a
   session where `calendar.google.com` was network-blocked, so the list was
   empty and the unbounded case was never exercised. An earlier pass had a real
   `max-h-80`; the later "stretch to match the grid" change removed the only
   hard bound. Fixed in both layers: a 12-month horizon in `getHolidays()`
   (deliberately a date window, **not** a `slice(n)` — the same array marks day
   cells in `CalendarGrid`, so truncating to a count would silently drop
   markers), an explicit `max-h-80 overflow-y-auto` on the scroll container,
   `items-start` on the card's grid so columns size to their own content, and
   the existing "ดูปฏิทินทั้งหมด" CTA surfaced below the list rather than only
   in the empty state.

   **Proven against production's actual data volume**, which is the part the
   previous verification skipped: a temporary 100-row stub (removed before
   commit; `grep TEMP_SELF_TEST` → 0) plus real viewport emulation over CDP,
   3 breakpoints × 2 themes. The list caps at **320px visible against 4988px
   of content** — so the bound scrolls rather than clips — and the card lands
   at **502px** at 1280 and 887px stacked, versus the ~5000px it would have
   been. Zero horizontal overflow at any width. The empty-list path (the real
   state here, feed still blocked) was re-checked afterward and is unchanged.

   **Follow-up in the same pass — the first bound was too narrow.** A
   future-only window (`date >= today`) left *past* months with no holiday
   markers at all, even though the calendar can be paged back 24 months
   (`schemas/calendar.ts`). `getHolidays()` now takes the displayed month and
   spans both the next 12 months (what the panel lists) and that month, so a
   month a year ago still marks its holidays; `HolidayList` filters to
   upcoming so the side panel stays "upcoming holidays" rather than listing
   dates already past. Proven end-to-end against the **real** `getHolidays()`
   with a stubbed ICS feed and a faked clock (`node --experimental-strip-types`,
   with a throwaway `server-only` shim removed afterward): viewing 2025-08
   returns the 2025 holidays, viewing the current month does not, and a
   2029 date stays excluded in every case so the size bound still holds.

   **Time-dependence audited while answering "will it follow in 2027?"**: the
   default month is `startOfMonth(new Date())` and the holiday window is
   derived from `new Date()` per request, so both roll over on their own.
   Confirmed the dashboard is **not** frozen at build time despite the `●`
   marker in `next build` output — that reflects `generateStaticParams` for
   `[lang]`, and there is no prerendered HTML nor a `prerender-manifest`
   entry for the route. Clock-faked checks at 2027-01, 2027-12 and 2030-06 all
   return the matching month. Google's feed is re-fetched with
   `revalidate: 86400`, so a holiday Google adds or moves appears within 24h.

2. **The avatar now opens the Settings card directly.** It previously opened a
   Profile/Settings/Sign out dropdown. `components/layout/user-menu.tsx` drops
   the `DropdownMenu` for a plain button calling the existing `openSettings()`.
   **Profile and Sign out were not dropped** — they moved into
   `settings-dialog.tsx` as a footer row (reusing `dict.nav.profile` /
   `dict.common.signOut` and the existing `hooks/use-sign-out.ts`, no new
   keys), so nothing became unreachable. The button's accessible name now
   leads with the visible display name (WCAG 2.5.3 "Label in Name" — the old
   `aria-label` was `dict.nav.profile`, which no longer matches what the button
   does); it falls back to just "ตั้งค่า" when there is no name to show.
   `mobile-nav.tsx` is deliberately untouched: its sheet already lists all
   three separately and already closes itself before `openSettings()` to avoid
   two stacked focus traps. Verified over CDP with a real click: dialog opens
   containing password / font size / push / profile / sign out, and Escape
   closes it.

3. **Web push was invisible in production because of a config gap, not a bug.**
   `push-section.tsx` is `if (!isPushConfigured) return null`, derived from
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — which was never set in Vercel (only the
   Supabase + Turnstile vars are). A VAPID P-256 keypair was generated with
   Node's built-in `crypto` (no new dependency; `web-push` still isn't
   installed) and written to the git-ignored `.env.local`, which is what made
   the toggle render in the CDP check above. **The three vars still have to be
   set in Vercel by hand** — this session cannot reach that dashboard — and
   until then production still shows no toggle.

   **Stated plainly rather than implied:** this only makes the toggle appear
   and *subscribe*. Nothing sends a push. `push_subscriptions` (0033/0034)
   stores subscriptions and `public/sw.js` exists, but no code calls
   `web-push`. Delivery remains a separate unbuilt phase; the natural hook is
   the same 0036 notification insert that now drives the in-app bell.

`npx tsc --noEmit && npm run lint && npm run build` all pass, and
`npm run check:responsive` is 72/72. **A false alarm worth recording so it
isn't re-investigated:** an intermediate responsive run failed all 72 with
`innerWidth=981, emulation did not apply`. That was not a regression and not
the missing-viewport-meta bug it resembles — it was `npm run build` being run
concurrently with `next dev` against the same `.next` directory, which
clobbered the dev server's manifests. Killing the server, clearing `.next` and
restarting produced a clean 72/72 with the viewport meta present.

**Logo changed size when toggling light/dark — fixed by rebuilding the dark
asset to the light lockup's proportions.** Reported with side-by-side
screenshots: the whole nav shifted right in dark mode. Cause was an
**aspect-ratio mismatch between the two PNGs**, not CSS —
`logo-with-text.png` is 418×134 (aspect 3.119) and
`logo-with-text-dark.png` was 1415×423 (aspect 3.345). Both render
`h-14 w-auto`, so width is `56 × aspect`: 174.7px light vs 187.3px dark, and
everything after the logo moved with it.

Measured rather than eyeballed: normalising each file by its own height, the
crest matched (1.02×h vs 1.00×h) but the **text block was 2.008×h light
against 2.303×h dark** — ~15% wider. So it was genuinely different artwork,
not croppable whitespace. Confirmed the two files are otherwise the same
lockup by comparing ink bands: identical structure and colours, differing
only in the Chinese subtitle (near-black `rgb(30,30,31)` light vs white
`rgb(249,249,249)` dark), which is the intended dark-mode treatment. The
drift dates to commit `b13e8aa`, which rebuilt the dark variant by
compositing the high-res `Picture/logo.png` + `text only.png` rather than
deriving it from the same `Picture/logo with text.png` the light asset came
from.

Rebuilt the dark PNG programmatically from the light file's geometry while
keeping the high-res source pixels: the seal is pasted at its natural size
(**not** stretched — a 2% horizontal scale to force an exact match would
visibly oval a circular crest), and only the text block is rescaled, by
LANCZOS **downscale** so it stays sharp, positioned using the light file's
own normalised gap and vertical span. Result is 1320×423, aspect 3.1206
against the light's 3.1194 — a 0.04% difference, i.e. 0.08px at the rendered
56px height. `logo.tsx`'s `width` prop updated to match, with a comment
saying the two assets must stay proportional and why.

Verified in a real browser over CDP at 1280px in both themes: logo width
**174.67px light / 174.75px dark (0.08px apart, was ~12px)** and the nav
starts at the same x in both. The rebuilt file is also slightly smaller on
disk (517KB vs 527KB). `npm run check:responsive` 72/72, lint and build clean.

**Role model rebuilt twice, and an อวท. ตำแหน่ง axis added (migrations
`0044`–`0049`). §6 is the current contract; read it rather than the history
below, which records how it got here.**

`0044`/`0045` added `member_position` (8 offices: ประธาน, รองประธาน, ปฏิคม,
นายทะเบียน, ประชาสัมพันธ์, เลขานุการ, ครู→`advisor`, กรรมการ) with
`prevent_position_change` making assignment admin-only. At that point holding
an office also granted `member:approve`, via a `canAs(actor, permission)`
predicate and a `profiles_update_officer` policy.

`0046`/`0047` then collapsed the roles: `pending` went away (signup no longer
needs approval — any `@udontech.ac.th` Google account is in immediately) and
`aft_teacher` went away, its authority redistributed across all 18 policies
that named it. **PostgreSQL cannot drop an enum value in place**, so both
labels survive in `user_role` and a `profiles_role_allowed` CHECK is what
actually prevents storing them; `toRole()` narrows at the DB boundary and
fails closed to `guest`.

`0048`/`0049` re-split what `0046` had merged: `aft` (นักศึกษา อวท.) became
its own role alongside `teacher` (ครู), sharing **one** permission list. The
officer axis was then removed entirely — `canAs`, `Actor`, `getActor`,
`officerPermissions`, `profiles_update_officer` and `current_position()` are
all gone; `can(role, permission)` is the whole predicate again and member
editing is admin-only. In its place `sync_role_with_position()` makes a
ตำแหน่ง **set** the role: `student` → `aft` on assignment, back on clearing,
with `teacher`/`admin` deliberately untouched since `advisor` (ครู) is itself
one of the eight.

Proven live under real JWT claims with `set local role authenticated`, not
service role: the full sync matrix including teacher+advisor staying
`teacher`; `aft` can submit drafts, create activities and recommend but
cannot approve to `official` or edit a member; a student, an `aft` and a
`teacher` each refused when granting a ตำแหน่ง; writing `role='pending'` or
`'aft_teacher'` refused by the CHECK. All test accounts torn down.

**Three real bugs found while doing it**, each fixed rather than worked
around: `projects_update_teacher_recommend` tested `= 'teacher'` exactly, so
an อวท. member could submit a draft and then be unable to move it forward;
`updateMember` had no `position` field and silently dropped it, making the
whole ตำแหน่ง UI non-functional (TypeScript could not catch it — excess-property
checks do not apply to a variable); and book creation was gated on
`workspace:access`, which a read-only student holds, so `document:draft:submit`
was added and the RLS narrowed to match.

**Real OVEC department codes, and สาขา auto-filled at sign-in
(`0050`/`0051`).** The seeded codes `31901`–`31906` were invented demo data
and every one was invalid — OVEC numbering is a qualification digit (`2` ปวช.,
`3` ปวส., `4` ทล.บ.) plus a 4-digit programme id, with no `31xxx` block.
**`31901` was the exception and deleting it was a real bug — see the
correction below; `0054` puts it back.**
`0050` loads the 29 official codes, remaps the demo activities/projects, and
deletes the invalid rows in that order so no FK dangles. Profiles were
**cleared rather than remapped**, because `student_id` is authoritative:
remapping `66209010020` the way its activities went would have put a ปวช.
student into the ปวส. IT department.

`0051` makes `handle_new_user()` resolve `departments.code = substring(
local_part, 3, 5)` as a scalar subquery, so an unregistered code yields NULL
and the sign-in still succeeds. Verified live: `66209010021` → `20901` ปวช.
IT, `69309010015` → `30901` ปวส. IT, `69401010007` → `40101` ทล.บ.,
`69319010099` (invalid `31901`) → signs in with no สาขา, staff address → no
student_id at all. `lib/student-id.ts` gained ทล.บ. as a third level.

**Correction — `31901` IS a real code, and `0050` deleted it in error
(`0054` restores it).** An earlier version of this note claimed "it is not an
OVEC code (ปวส. IT is `30901`)" and that the accounts carrying it "resolve to
no สาขา, which is correct — they are not students". Both halves were wrong,
and the second was circular: they had no สาขา *because* `0050` had deleted the
row, not because none was expected.

Checked against the live database before reversing it:

| programme code | real accounts | registered after `0050` |
|---|---|---|
| `20901` | 1 | yes |
| `31901` | **2** | **no — deleted** |
| `30901` | 0 | yes |

`69319010003@` and `69319010015@` both sign in with **Google** using
college-issued identities, so `31901` is not something the app can "correct"
to `30901` — rewriting the stored email would break their sign-in, since the
Google identity email is fixed by the college. `0054` registers `31901` as
เทคโนโลยีสารสนเทศ / Information Technology and re-runs `0051`'s backfill.

`0050`'s general reasoning still stands for the rest of the `31xxx` block —
only `31901` was shown to be in use. **Do not re-delete `31901`.**

Consequence worth knowing: `30901` and `31901` are now both ปวส. *and* both
named เทคโนโลยีสารสนเทศ, so a level-and-name label renders two identical
options. `departmentOptionLabel` (`lib/student-id.ts`) therefore appends the
code — the only value guaranteed unique.

**Corrections to this file's own earlier claims**, made here rather than left
to be rediscovered:

* Everything describing `approved_accounts`, the `pending` waiting-room and
  the `/approvals` page as *current* is **historical only**. The table is
  dropped, the role is unstorable, and `/approvals` is a bare `redirect()` to
  `/members` kept solely because `0036`'s notification rows link to it.
* Every `aft_teacher` permission description above is superseded by §6.
* §6 itself previously attributed "submit project drafts / QR attendance /
  digital signature" to **Student**. That was written before `aft` existed
  and is now wrong: a plain `student` is read-only.

**FlipHTML5 removed entirely; a book is now a PDF opened in a new tab
(migration `0053`).** The §12 e-book shelf embedded books from a third-party
flipbook host inside an `<iframe>`. Reported as not meeting the project's
technical requirements or Thai government web compliance, so the whole
integration is gone — `lib/fliphtml5.ts`, `flipbook-viewer.tsx`, the
`<object>`-based `pdf-viewer.tsx`, both `flipbook_url` columns and both host
CHECK constraints. Clicking a book on `/documents` now opens its uploaded
PDF in a new tab (`target="_blank" rel="noopener noreferrer"`), rendered by
the browser's own viewer.

**Two corrections to the brief, both stated up front rather than discovered
mid-build.** The request described fetching a PDF *URL* from *MySQL*: this
project has no MySQL (Supabase Postgres), and the PDF is not a URL column —
it is `books.pdf_path`, a path into the **private** `books` Storage bucket,
read through a signed URL minted per request. That is deliberate
(`0029`): a public bucket makes every object readable by path regardless of
publish status, so a draft's PDF would be one URL guess away from the
public. Kept as-is and built on `pdf_path`.

**The publish guard is a database invariant, not a UI check.**
`books_published_needs_pdf` (0053) replaces `books_published_needs_content`:
`check (status <> 'published' or pdf_path is not null)`. With
`books_select_published` (0028) that yields **published ⇒ a PDF exists** and
**a guest only ever sees published rows**, so the shelf cannot render a card
with nothing behind it. `lib/books.ts#canOpenBookPdf` is the app-layer
consequence: published opens for anyone, a draft opens only for its owner or
staff (so a file can be checked before it goes public). Verified live in
both directions, not just read off the constraint: publishing with
`pdf_path IS NULL` is refused with **`23514`**, and with a path set it is
accepted — run inside a self-rolling-back function, with the after-counts
confirming zero residue (0 published, 0 with pdf).

The one previously-published book was flipbook-only, so `0053` returned it
to draft before rebuilding the constraint. **All six books therefore have no
file and the public shelf is empty until someone uploads a PDF** — expected,
not a regression.

**`approveDocument`'s document → shelf bridge was removed, not silently
broken.** It upserted a published book from the approved document's
`flipbook_url`; with that column gone there is no content to carry, and
`documents` has no upload of its own. `approveDocument` is now just the
status transition, with a comment naming exactly what would restore the
bridge (a `pdf_path` on `documents` plus the two-phase upload flow
`components/books` already has). `lib/books.ts#deriveAcademicYearAndSeason`
went with it as dead code.

**Two real bugs found while reviewing this area, fixed in the same pass:**

1. **A plain `student` was offered a "เพิ่มหนังสือ" button that could never
   work.** This file already recorded that book authoring "was gated on
   `workspace:access` ... so `document:draft:submit` was added and the RLS
   narrowed to match" — but only the permission and the policy were ever
   changed. **Five call sites still guarded on `workspace:access`**, which
   `studentPermissions` includes, while `books_insert_own` (0028/0049)
   admits only `aft`/`teacher`/`admin`. A student could open the form, fill
   it in, submit, and get the generic `unknown` toast from an RLS refusal.
   The database was right; the guard had not been updated. All five now use
   `document:draft:submit`. Verified by HTTP status, not page text — the
   false-pass this project has recorded before: `/th/books/new` is **307 →
   /th/login** for student and guest, **200** for aft/teacher/admin, and the
   add button renders 0 times for student, once for aft/teacher/admin.
2. **The migration would have silently broken the publish error message.**
   `publishBookAction` identifies "nothing to read" by string-matching the
   constraint name; renaming it to `books_published_needs_pdf` would have
   made that test always false, degrading "attach a file first" into the
   misleading "not found or forbidden". Updated with the rename. Worth
   noting the fragility rather than only patching it: an error message is
   coupled to a database identifier with nothing enforcing the link —
   matching on SQLSTATE `23514` plus the name would at least fail loudly.

**A third, pre-existing defect surfaced during verification and was fixed
because it blocked it:** `services/books.ts#getBook` used unguarded
`createClient()`, which throws *synchronously* above the page's own
boundary when the Supabase env vars are absent — so `/th/documents/<id>`
returned a bare **500** instead of a 404. Same class as the `/members` and
`/documents` shelf defects already recorded here; `getBook` was simply never
converted. Now `tryCreateClient()` + a null guard, so its caller's existing
`notFound()` handles it: the route returns **404**, confirmed. Write paths
(`createBook`/`updateBook`/`deleteBook`/publish) deliberately keep
`createClient()` — a write with no real client *should* throw.

**Performance:** the shelf signed a cover URL per card and would have signed
a PDF URL per card too — 24 Storage round trips for 12 books. New
`services/books.ts#getSignedUrlMap` signs a whole page in one
`createSignedUrls` call; the page makes exactly **two**, and `BookCard` is a
synchronous component again.

**CSP tightened as a side effect**: both FlipHTML5 hosts dropped from
`frame-src`, and with the `<object>` embed gone `object-src` is now `'none'`
in **both** the enforced and report-only policies (it had been relaxed to
allow Supabase Storage solely for that embed).

**Verified in a real browser against the real page**, using this project's
established inject-then-revert self-test discipline — because outbound
access to `*.supabase.co` is blocked from this session (`curl` returns
`000`, same limitation prior passes record), so an unstubbed shelf renders
empty and would prove nothing about the card. Fixtures were injected into
`listBooks`/`getSignedUrlMap`/`getBook`/`getSignedPdfUrl`, the pages driven
over a real dev server, then reverted (`grep TEMP_SELF_TEST` → 0, and the
file restored from a pre-stub copy so only the deliberate `getBook` fix
survives). Results, per role:

* Guest / student / aft: exactly **1** storage link on the shelf — the
  published book — with `target="_blank"` and `rel="noopener noreferrer"`.
  Both drafts fall back to their detail page; **the draft that HAS a PDF
  does not leak it.** 0 manage anchors, 0 delete buttons.
* Admin (holds `document:approve`): **2** storage links — published plus the
  draft-with-PDF, which is the point of letting staff check a file before
  publishing — 3 manage anchors, 3 delete buttons.
* Detail page: **0** `<iframe>`/`<object>`/`fliphtml5`; the open link carries
  `target="_blank" rel="noopener noreferrer"`; the download link is a
  **separate** signed URL carrying `&download=Published%20with%20PDF.pdf`
  and deliberately no `target` — proving the two-URL design (forcing
  `Content-Disposition: attachment` on the view URL would turn the open link
  into a save prompt). The "not attached" empty state correctly did **not**
  render for a book with a file — the apparent match was the serialized
  dictionary, checked rather than assumed.

`npx tsc --noEmit`, `npm run lint` and a fully observed `npm run build`
(exit 0, `BUILD_ID` present, never piped through `head`) all pass, plus
`npm run check:responsive` **72/72 with 0 overflow and the self-test
passing**. Dictionary key parity re-checked programmatically (609 keys,
both locales). `types/database.ts` regenerated against the live schema.

**Not verified, stated plainly:** no PDF has ever been uploaded to this
project, so the genuine end-to-end — upload a real file, publish it, open it
as a guest, and observe the real `Content-Disposition` on a live Storage
response — has **not** been done. Every URL above came from a stub; the
signing call itself (`createSignedUrl`/`createSignedUrls`) is unexercised
against real Storage. That is the first thing to confirm after deploy.


**สาขา `31901` restored, and every department list now states its ระดับ
(`0054`).** Reported live: `69319010015@udontech.ac.th` signs in but shows no
สาขา, and ปวช./ปวส. appears nowhere. Two separate causes.

The สาขา gap was **`0050` deleting a code the college actually issues** — full
correction recorded in §14. Live evidence gathered before touching anything:
`31901` had **2** real Google-authenticated accounts and `30901` had **0**.
`0054` re-inserts it (`on conflict (code) do nothing`, re-runnable) and reuses
`0051`'s *exact* backfill statement rather than a hardcoded one, so any code
registered later is picked up by the same query. No trigger workaround was
needed: `prevent_member_identity_change` (0025) does guard `department_id`,
but has an explicit `auth.uid() is null` carve-out for migrations — the same
path `0051`'s own backfill took. Verified live before/after: departments
29 → 30, profiles with a สาขา 1 → 3, **student-shaped profiles with no สาขา
2 → 0**, and both accounts now read เทคโนโลยีสารสนเทศ.

The ระดับ gap was **not** a parser bug — `parseStudentId` already returns
`level` and the Auto Input panel already showed it. `departments` simply has
no level and every list rendered the name alone, so สาขา sharing a name were
indistinguishable. Fixed by **deriving** the level from the code's first digit
(`departmentLevelLabel`/`departmentOptionLabel`, beside the existing
`studentLevelFromProgramCode`) rather than adding a column — a stored level
would be a second source of truth that can drift from `code`, which
`departments_code_format` (0043) already constrains. Surfaced as a ระดับ column
in the สาขา table and as a prefix on both department `<Select>`s
(`members-filters.tsx`, `member-edit-sheet.tsx`). The four `levels` dictionary
keys moved `members.autoinput.*` → `common.levels`, the same lift
`common.pagination.*` already got; parity re-checked programmatically (684
keys, both locales).

**A gap in this pass's own plan, caught by testing rather than review:** the
plan assumed a level prefix disambiguates. It does not — registering `31901`
made `30901` and `31901` *both* ปวส. *and* both เทคโนโลยีสารสนเทศ, so the
label rendered two identical options. `departmentOptionLabel` now appends the
code, the only value guaranteed unique (`departments.code` is UNIQUE, 0003).
Proven by a real unit run over all 9 relevant codes plus an unknown digit.

**Also confirmed, not changed** (asked during the pass): the live
`handle_new_user()` already implements "numeric email → student, named email →
teacher" — `is_student := local_part ~ '^[0-9]{11,}$'`, with `student_id` and
the สาขา lookup applied only in the student branch. Read from `pg_proc`, not
assumed. This is why the two `31901` accounts are `admin`: they signed up as
`student` and were promoted afterwards.

**Not verified live:** the rendered สาขา table and dropdowns. This session
still cannot reach `*.supabase.co` (proxy returns `403` on `CONNECT`; GitHub
returns `200` from the same shell), so the app has no data to render and the
label logic was proven by direct unit execution instead. Confirm after deploy
that the ระดับ column reads ปวช./ปวส./ทล.บ. correctly and that the three
same-name สาขา are now distinguishable in both dropdowns.

**The set-password step was skippable — now gated on every guarded route and
action.** Reported: on a first-time sign-in you land on `/set-password` but can
click the nav and carry straight on. Confirmed exactly:
`auth/callback/route.ts` redirects there **once**, `/set-password` renders
inside the `(public)` layout which includes the full `TopNav`, and
`(app)/layout.tsx` guards on role only. `passwordSet` *was* already fetched by
`getSessionProfile()` and threaded through the layouts — but used **only to
pick label text** in `change-password-section.tsx`. It had never been a guard.

**Live evidence, not hypothetical:** two accounts were already through —
`69319010003@` (**admin**) and `66209010020@` (student), both
`password_set = false`.

Fixed **without** resurrecting the `pending` role (`0046` removed it
deliberately; a CHECK refuses it, `/pending` is deleted, and signup was changed
so any `@udontech.ac.th` account is in immediately). No migration, no RLS
change. Two layers:

1. `lib/auth/require-role.ts` — new `requirePasswordSet()`, called by both
   `requirePermission` and `requireAnyPermission` **before** the permission
   check, redirecting to `/set-password`. Both switched from `getRole()` to
   `getSessionProfile()`, which is `cache()`d and which `getRole()` already
   wraps — the same one round trip, not a second query. This covers pages and
   Server Actions together; every `actions/*.ts` file already calls one of the
   two (verified by count, not assumption).
2. `lib/auth/get-role.ts` — `getRole()` now reports **`guest`** for a
   half-onboarded account. Needed because `requirePermission` is **not** the
   universal chokepoint the first design assumed: `/members`, `/documents`,
   `/aft-11` and `/` are `(public)` pages that call `getRole()` + `can()`
   directly and render privileged controls from it, so a password-less admin
   would have been shown Add/Edit/Delete buttons whose actions then bounce
   them. Reporting `guest` makes the UI agree with what the guards allow.

**`profile.userId !== null` is load-bearing, not defensive noise.** Both
`GUEST_PROFILE` and the `dev_role` cookie stub report `passwordSet: false`
alongside a null `userId`; without that clause the gate would fire for every
guest and **break local development outright**. Verified directly: all four
dev roles still reach all five `(app)` routes with 200.

**A false conclusion avoided, worth recording.** Mid-verification
`/th/notifications` and `/th/profile` returned 200 while four sibling routes
correctly 307'd — reproducibly. It looked like a real hole in the fix. It was
**dev-server module staleness** from editing the auth files while `next dev`
ran: after `rm -rf .next` and a restart, all five gate identically. Confirm a
suspicious result against a clean build before treating it as a defect.

Proven by simulation, since this session cannot reach a live Supabase session:
the `dev_role` stub was temporarily given a non-null `userId` to impersonate a
signed-in account with no password, which reproduced the exact reported
behaviour and then its fix; reverted after (`grep TEMP_SELF_TEST` -> 0). Also
confirmed no redirect loop is possible — `/set-password`, `/reset-password`,
`/forgot-password` and `/login` reach **zero** `requirePermission` calls, and
the `(public)` layout is ungated.

**Accepted limit, stated rather than implied:** this is an
**application-layer** gate, chosen knowingly over the `pending` alternative. A
half-onboarded account still holds a valid JWT whose stored role passes RLS, so
it is not a database boundary — reads through the Supabase API directly are
still possible. Closing that would require changing the role itself. Same shape
as the already-documented Turnstile-with-JS-off trade-off.

**Five 0%-reported features built: QR attendance, audit logs, reports, global
search and announcements (`0055`–`0060`) — plus a critical live RLS hole found
and closed first.**

The audit that preceded this confirmed all five were genuinely at 0%, but the
significant finding was not one of them. **`attendance_insert_own` (0008,
re-wrapped in 0041) was, in full, `with check (student_id = auth.uid())`** — no
role check — and 0008's column hardening had revoked SELECT only, leaving
INSERT and UPDATE granted on all 14 columns to `authenticated` and `anon`.
Reproduced live before touching it, as the real `student` 66209010020, a role
that per §6 is read-only and holds no `attendance:submit`: one row written,
status `completed`, GPS set to Bangkok (~560 km away), fingerprint and IP
forged, `recorded_at` backdated 30 days. §13 requires GPS, time and device
fingerprint to be server-verified; every one was client input.

`0055` fixes it in two layers on purpose. The **grants** go, so no client can
write the table at all — §13 attendance arrives through a security-definer RPC
that needs no grant. The **policy** additionally gains the role check, which is
redundant while the grant is revoked, and that is the point: it is the layer
that still holds if a future migration re-grants INSERT, the way `0011`'s
`create or replace` silently restored an EXECUTE grant `0006` had revoked.
Trade-off stated in the migration: `authenticated` is one shared role, so this
removes the admin's UI-less raw-REST write too. That capability had no caller
and was never complete — DELETE has never been granted on this table to anyone.

**QR attendance (§13, `0056`)** — no in-app scanner. §13 reads "Scan QR → Open
Website → Confirm", so the student's own camera opens `/{lang}/attend/{token}`:
no camera permission, no scanner dependency, works on every phone, and the
client stays out of the trust path. "Dynamic" is solved without a job runner by
deriving the token TOTP-style — a per-session secret HMAC'd with a time bucket,
so nothing rotates anything and a screenshotted QR simply stops verifying. The
staff display polls a route handler rather than computing the next token
locally, which is the whole security argument: the secret is unreadable by
every client, so a browser *cannot* derive the next code. `record_attendance()`
derives student_id, recorded_at, status, ip and activity_id server-side; the
caller supplies only a token, a GPS reading and a fingerprint, each verified.

**Audit logs (§19, `0057`)** — this was a live gap, not a missing feature:
`deleteMemberAction` permanently destroys an account and nothing recorded who
did it. Append-only enforced by **grant**, not by absent policy (0055's lesson
applied up front), and written exclusively by triggers — an audit trail an
application caller can write is one they can forge. Proven live including the
case app-level logging cannot catch: a DELETE run as the table owner with the
JWT cleared is still recorded, actor correctly null.

**Reports (§18, `0058`)** closed SEC-5 (`/reports` was gated on
`workspace:access`, which a read-only student holds) and **B-2**: 
`get_activity_stats()` is SECURITY INVOKER, so `completed`/`pending` are
org-wide while `attendance` is per-caller — one chart, two scopes, nothing
saying which. Fixed by telling the truth rather than changing the numbers: the
legend now says "my attendance" when it means that. Forcing org-wide figures
would have leaked the college's attendance to every student.

**Global search (§18, `0059`)** is SECURITY INVOKER so per-table RLS scopes it
— **deliberately the opposite of `0038`'s choice for `list_notifications`**, and
the contrast is the useful part: there RLS was *broader* than the app's meaning
of "mine", so the RPC had to restate scope; here the policies already say
exactly what each role may see, so restating them would create a second copy
that can drift. Which is right depends on whether RLS already means what the
feature means.

**Announcements (`0060`)** closes B-1 — `/announcements` was linked from the
footer but absent from `navItems`, a dead link since Phase 1. Publishing fans
out a broadcast notification via trigger, reusing the whole 0036→0038 chain;
`notified_at` stops republish from re-notifying everyone.

**Testing, and two ways it went wrong.** Every migration has a re-runnable,
self-rolling-back matrix in `supabase/tests/` (0055: 10 cases, **0056: 17**,
0057: 10, 0058: 10, 0059: 9, 0060: 11), all passing live.

The **0056 §13 abuse matrix is the one that matters most** and was the last to
actually be run — it was written alongside the migration and then, by
oversight, committed without being executed; the count is listed here only now
because "the file exists" and "the file passes" are different claims. 17/17,
and three results are worth keeping:

* **`secret` is unreadable even by staff** (42501), and `qr_token_for_bucket`
  is uncallable by anyone. If either ever passes, tokens can be minted
  client-side and every other case in the file is decoration.
* **A cross-session forgery is refused** — session 1's public slug signed with
  session 2's secret. Without the HMAC being bound per session, holding any one
  QR would grant attendance at every other activity.
* **A student reading `qr_sessions` gets 0 rows, not an error.** That is correct
  RLS behaviour (no applicable policy), not a missing grant, and is called out
  so a future reader does not "fix" it into a permission error.

The matrix deliberately reads `secret` as the table OWNER to forge its test
tokens — attacking the scheme from a stronger position than any real client
holds, since case 03 proves no client can reach it. Two flaws in the *test method* were
caught, in opposite directions, and both are worth remembering:

* **False PASS** — `select (insert into …)` is not valid syntax, so an
  expect-refused helper records the syntax error as a refusal. Statements must
  run as statements.
* **False FAIL** — `select 1 from (select f()) t` leaves the function result
  unreferenced, so the planner prunes the call entirely and it reads as
  "allowed". This briefly looked like a bypassed guard that was never bypassed.

Also: a missing-grant and an RLS violation both raise `42501`, so the helpers
record `sqlerrm`, not just SQLSTATE — that is what proves 0055's policy layer
refuses independently of its grant layer.

**A real bug found by testing rather than reading**: `search_all`'s first
version selected `profiles.created_at`, outside the column allow-list `0026`
grants anon, which made the **entire** function fail for guests with 42501 —
not merely hide the member section. That is precisely the failure this
migration's own header warns about for `email`; the warning was written and
then walked into one column over.

**Not verified, stated plainly**: no end-to-end scan on a physical phone; the
staff QR page's rendered output (needs a real activity row and a configured
Supabase); the dashboard chart legend (with no Supabase the stats are empty, so
the card renders its empty state and the legend never mounts — the scope
predicate itself was exercised for all five roles).

**Correction to this file**: the §12 entry says all six books have no file and
the public shelf is empty after `0053`. One book was genuinely published with a
PDF on 2026-08-14 and is visible to anon, which is correct behaviour under
`books_select_published`, not a leak.

`npx tsc --noEmit`, `npm run lint` and `npm run build` pass clean throughout;
dictionary parity checked programmatically at each step (859 keys per locale at
the end). `types/database.ts` is verified against the live catalog by an
automated drift check — extended mid-work to cover **functions** as well as
tables, since the table-only version silently missed three new RPCs.

**Activity detail page, co-editors, banners, manual attendance, and students
scanning (`0061`–`0063`) — plus a fatal escalation caught by review before it
shipped.** `/activities` was a list and nothing else: there was no detail page
at all, so `/activities/{id}` 404'd and `[id]` existed only to host the QR
child, leaving `/activities/{id}/qr` reachable only by typing a URL nothing in
the app would ever show.

**The finding that mattered was not in the feature.** `activities.created_by`
had existed since `0007` and **no policy ever referenced it**, so any
aft/teacher could edit any other teacher's activity. The obvious fix — point the
UPDATE policy at ownership — would have shipped a self-service ownership
transfer: verified live via `information_schema.column_privileges`,
`authenticated` (and `anon`) held **UPDATE on every column including
`created_by` and `id`**, Supabase defaults never revoked here the way `0055`
revoked them for `attendance`. A co-editor could run `update activities set
created_by = <self>`. **RLS cannot prevent this** — `WITH CHECK` only ever sees
the NEW row, so no policy can say "this column must not change". A column-grant
allow-list is the only mechanism that can. Corollary now written into the
migration: column grants are per-*role* and `authenticated` is one shared role,
so "the owner may transfer ownership but a co-editor may not" is
**inexpressible** in RLS.

Three more design corrections, each verified rather than argued:
* **The banner cap is a constraint, not a trigger.** A counting trigger is racy
  — two concurrent inserts under READ COMMITTED each see 9 and both commit.
  `check (sort_order between 0 and 9)` + `unique (activity_id, sort_order)` is a
  hard cap, and it is the ordering key the carousel needs anyway. Proven from
  both directions: slot 10 fails the check, a taken slot fails the index.
* **DELETE is owner+admin, never co-editors.** `attendance.activity_id` is `ON
  DELETE CASCADE` (confirmed live), so deleting an activity destroys its whole
  attendance record — bypassing both RLS and the fact that DELETE has never been
  granted on `attendance` to anyone.
* **`attendance.method` has NO default.** Defaulting to `'qr'` would let any
  future writer that forgets the column silently produce rows claiming
  cryptographic verification — fail-open, the exact class `0055` exists to
  prevent.

**Students can now scan.** `record_attendance()` admits `student`, and
`attendance:submit` **moved** into `studentPermissions` (a copy would duplicate,
since `organisationPermissions` spreads it). `attendance_insert_own` is
deliberately **not** relaxed to match: with no INSERT grant that policy is
unreachable, so keeping it narrow costs nothing and still holds if a future
migration re-grants INSERT. The migration says so, or a later reader will "fix"
the apparent contradiction.

**The percentage has a real denominator.** `activities.expected_attendees` is
owner-stated, because `attendance` rows exist only for people who checked in —
so the obvious denominator makes the figure checked-in/checked-in, always 100%.

**Live: 49 cases across `0061`–`0063`, all passing**, plus `0055`'s boundary
re-verified 9/9 after the schema change. `0056` case 01 asserted the student
refusal and was **inverted in the same commit** rather than left to fail.

**Three harness traps found by running rather than reading**, worth keeping:
1. **RLS FILTERS on UPDATE/DELETE rather than raising** — a forbidden statement
   succeeds affecting zero rows, so an exception-based helper reads it as
   *allowed*. Two cases false-FAILed this way before write-effect cases were
   switched to assert `ROW_COUNT`. INSERT is the asymmetric case: a `WITH CHECK`
   violation does raise.
2. Matching a policy predicate with `like '%student%'` hits the **column name
   `student_id`**, reporting a hole in a correct policy. Match the role literal.
3. `types/database.ts` was verified against the live catalog rather than trusted:
   tables, PostgREST-reachable functions and every column of the four
   changed/new tables diffed both ways, zero rows. That also surfaced two
   **pre-existing** drifts — `assert_report_viewer` (0058) was never added, and
   the Constants block never got `attendance_status` (0056).

A real break came out of it: adding `recorded_by` gives `attendance` a **second
FK into `profiles`**, so `listActivityAttendance`'s `profiles(...)` embed became
ambiguous — a runtime PostgREST failure, not just a type error, caught by `tsc`
first. Hinted to `profiles!attendance_student_id_fkey`. Also worth knowing: the
`.select()` string must be a single literal, since postgrest-js parses it at the
type level and `"a" + "b"` collapses the row type to `GenericStringError`.

**Not verified**: the rendered page with real data. Without Supabase the detail
page correctly `notFound()`s, so there is nothing for the responsive suite to
measure and no banner, attendee row or co-editor grant has been seen in a
browser. The guards, the route move, the build and the whole database layer are
proven; the pixels are not.

**Password emails are sent by this app over SMTP; Supabase Auth's mailer is
out of that path entirely (`0064`).** Reported plainly: setting a password
"should be Nodemailer because [Supabase] is too much trouble — anyone should
be able to set a password from a phone, a PC, anything, by clicking one
link." That is what shipped.

Three separate Supabase blockers made the old path unfixable rather than
merely annoying, and this file already recorded each one in isolation
without connecting them: the built-in sender caps around two messages an
hour (`429 over_email_send_rate_limit`); custom SMTP through Resend was
**cleared by the dashboard itself** when its toggle was switched off and its
domain never finished DNS verification (`resend._domainkey.udontech.ac.th`
still resolves to nothing); and — the one no configuration fixes — this
project enables Supabase's **project-level CAPTCHA**, so a server-initiated
`resetPasswordForEmail()` is refused outright with `captcha protection:
request disallowed`. That last one is the *only* reason `/set-password`
exists as an interstitial page at all rather than the callback route just
sending the mail.

**A bigger change than swapping a transport, stated up front.** Supabase's
link worked because it established a *recovery session* that
`updateUser({password})` then acted on. A link this app mints carries no
session, so the password is set through `admin.auth.updateUserById()` — the
service-role key. **This is the first unauthenticated path to that key in
the codebase**, and that, not the email, is where the risk lives. Three
properties carry it, and none is incidental:

1. **The GET does not consume the token.** Gmail, Outlook and corporate
   antivirus all fetch links in mail before a human does; a token spent by
   that fetch is dead by the time the recipient clicks — intermittently,
   depending on whose scanner saw it first, which is the worst possible
   failure to diagnose. `peekToken()` (a SELECT) runs on the GET;
   `consumeToken()` (the UPDATE) runs on the POST. Single-use is intact
   because "use" means setting a password.
2. **The handoff cookie carries the RAW TOKEN, not the token row's id.** A
   row id in a cookie is a bearer credential anyone who guesses one could
   spend; the token is 256 bits minted for exactly that job. Moving it out
   of the URL also gets the secret out of the address bar before the
   password screen renders, so it cannot leak via Referer, a screenshot or
   history. `path: "/"` rather than `/{lang}/reset-password`, deliberately —
   the narrow scope is tempting and wrong, because the header's language
   toggle rewrites the locale segment and the cookie would silently vanish
   on a `/th` → `/en` switch.
3. **Consumption is ONE atomic statement** — `update … where token_hash = $1
   and used_at is null and expires_at > now() returning user_id` — so two
   concurrent submissions cannot both win, and **the account acted on is the
   one that statement returned**. No form field, cookie or query parameter
   anywhere in `updatePassword` names a user.

`token_hash` is **hex `text`, not `bytea`**, with a `CHECK (~
'^[0-9a-f]{64}$')`. bytea crosses the PostgREST boundary as a backslash-x
escape string whose round-trip depends on URL escaping behaving exactly
right in both directions — unverifiable from this session, since outbound
access to `*.supabase.co` is blocked. Hex has no escape path to get wrong,
indexes identically, and the CHECK makes a malformed write impossible rather
than unlikely. No policies and no grants, the `qr_scan_attempts` (0056)
shape; RLS is still *enabled* so a future accidental grant still meets a
fail-closed table.

**No constant-time comparison anywhere, and that is deliberate rather than
forgotten** — the plan called for reusing `lib/push-server.ts`'s
hash-both-sides compare, but the token is never compared in application
code. It is looked up by indexed equality inside Postgres, which leaks
nothing an attacker could walk a byte at a time the way a naive `memcmp`
would. Recorded so it is not "fixed" later by someone reading the plan.

**SMTP is enforced by the build guard, unlike the VAPID keys.**
`lib/env-guard.ts` now fails a Vercel production build when
`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` are not all set. The VAPID comment
in that file argues the opposite for push, correctly — a missing push key
degrades to "no toggle shown." A missing SMTP key does not degrade: setting
a password is the only route into an account that has none, and that route
is now one emailed link. **Operationally this means the next production
deploy FAILS until those three variables are set in Vercel** — which is the
guard doing its job, not a regression, but it is the first thing to hit.

Throttle: 3 links per account per 15 minutes, fixed-window `count(*)`, same
shape as `qr_scan_attempts`. **Being throttled must not change the
response** — `requestPasswordReset` returns `{ok:true}` whether the address
is registered, throttled, or the send failed, because that uniformity is the
entire account-enumeration guard and a "too many requests" message hands
back exactly what it hides. An address with no `profiles` row mints nothing
and so has no row to count; that path is bounded by Turnstile alone, which
is proportionate — it costs one indexed lookup and sends no mail. Turnstile
stays on the request form for precisely that reason: an unprotected "email
this address" endpoint is a way to make the server mail college addresses on
demand.

The emailed link is built from `resolveConfiguredSiteUrl()` only — **never**
`resolveOrigin()`, which is header-first. Header-first is right for an OAuth
redirect (the user is standing in front of the browser that sent it) and
wrong for a link that goes in an inbox: a poisoned `Host` would mail a real
college address a link pointing at an attacker's host, carrying a token
valid for their account. Development falls back to the request origin so
`npm run dev` works unconfigured; anything else refuses to send and says so
in the log.

`app/[lang]/auth/reset/route.ts` was **deleted**, not kept as a fallback —
it existed only to exchange a Supabase recovery `code`, which nothing issues
any more. Two reset systems means two kinds of link in the wild and a path
nobody exercises; this project already made that argument when it dropped
the direct-INSERT fallback on `attendance`.

**A real defect found by testing rather than review, and it was not in the
new code.** The route matrix showed `/th/auth/set-password?token=garbage`
correctly redirecting to `/th/login?error=sessionExpired` — so the check
looked green. Grepping the actual response HTML showed the message appears
**exactly once, inside the serialized dictionary payload, and nowhere as
visible text**: every `?error=`/`?notice=` on `/login` was delivered only as
a sonner toast inside a `useEffect`. Pre-existing (it has always been how
`?error=auth`/`oauthFailed`/`sessionTimedOut` behaved) but newly
load-bearing, because an expired or already-used link is a *routine* outcome
of this flow and that message is now the only thing explaining it — and it
was invisible with JavaScript off, against §30.9 item 3. Fixed by
server-rendering the message on `login/page.tsx` (`role="alert"` /
`role="status"`) and removing the URL-carried toast; the submit-result toast
is untouched. Re-checked in the raw HTML per case: `sessionExpired`,
`signupComplete` and `passwordUpdated` each render outside `<script>`, an
unknown `?error=bogusKey` renders nothing, and a bare `/login` renders
nothing.

**Verified live, this session:**
* **`supabase/tests/0064_…_test.sql`, 20/20 against the hosted project**,
  self-rolling-back (0 rows left after, confirmed). The cases that matter:
  `authenticated` and `anon` can neither SELECT, INSERT, UPDATE nor DELETE
  the table (`42501` each, with `sqlerrm` recorded — a missing grant and an
  RLS violation both raise `42501`, so the message is what distinguishes
  them); a token consumed twice returns a row then nothing; expired and
  already-used are refused; **user B's token returns user B, never user A**;
  the CHECK refuses a raw token stored by mistake (`23514`) and the unique
  index refuses a duplicate hash (`23505`).
* **The email-scanner simulation (cases 18-20)** — peek, peek, then consume.
  Both peeks see a valid token and the human's POST still works. This is the
  assertion that proves an inbox scanner cannot silently kill the flow.
* **The email itself, through the real modules**, via a temporary route on a
  real dev server (`app/api/selftest-temp`, removed afterwards; `grep
  TEMP_SELF_TEST` → 0): Thai and English subjects, the link present in both
  the text and HTML parts, `{email}`/`{minutes}` interpolated with no
  unreplaced tokens left, an adversarial link containing `"><script>`
  escaped (no raw `<script>` in the output), and nodemailer's
  `jsonTransport` building a real MIME envelope with both parts. Also the
  token primitives: 43-char base64url, 64-hex digest, stable per token,
  different across tokens, `../../etc/passwd` and `""` rejected.
* **Route matrix on the dev server**: `/{lang}/auth/set-password` with no
  token, a garbage token and a well-formed unknown token all `307` to
  `/{lang}/login?error=sessionExpired` with the locale preserved and **no
  Set-Cookie**; `/{lang}/reset-password` without the cookie does the same;
  `/forgot-password` and `/login` stay `200`.
* `npx tsc --noEmit`, `npm run lint`, `npm run build` clean;
  `npm run check:responsive` **78/78, 0 overflow, self-test detecting its
  injected 3000px element**; dictionary parity checked programmatically (944
  keys per locale). `types/database.ts` updated and the new table's six
  columns diffed against `information_schema` both ways rather than trusted.

**Not verified, stated plainly rather than implied:** **no real email has
been sent.** `smtp.gmail.com:465` is unreachable from this session — the
same network policy that blocks `*.supabase.co` directly — so everything up
to the transport is proven and the transport itself is not. Nor has the full
click-through been run against live Supabase (`findUserIdByEmail`/`mintToken`
need the service-role key, which this environment has no working route to).
The first deploy is what confirms both; `docs/email-setup.md` names the exact
server log line for each failure mode, because the action deliberately
reports success either way.

Two smaller things worth not rediscovering: `@types/nodemailer` is still
`8.x` while the runtime is `9.0.5` — 9.0.0's only breaking change is
stricter TLS validation when fetching remote attachment content, which this
app never does — and `pool` is not passed to `createTransport` because the
8.x types reject it on the SMTP overload; unpooled is the default anyway,
which is what we want (a pooled socket on Vercel never gets a second send to
amortise over). And a Next.js detail that cost a debug cycle: an App Router
folder whose name starts with `_` is a **private folder**, excluded from
routing — `app/api/__selftest` 404'd until it was renamed.


**Captcha and Google sign-in both moved out of Supabase and into this app
(PRs #36, #40, #41). Both proven live the same day.**

**The captcha was never actually being checked.** `grep siteverify` over the
whole repo returned nothing. `readCaptchaToken` (`actions/auth.ts`) tested only
that the form field was **non-empty**, then handed the token to Supabase, whose
project-level CAPTCHA did the real verification. Once `0064` removed
`resetPasswordForEmail`, `requestPasswordReset` checked presence and then
**discarded** the token — so a `POST` carrying `cf-turnstile-response=x` sailed
through the gate in front of the endpoint that makes the server send mail. Its
only real protection was the 3-per-15-minutes mint throttle.

`lib/turnstile-server.ts` now calls Cloudflare's `siteverify` directly and
**fails closed** on a non-200, malformed JSON, a network error or a timeout,
logging the `error-codes` array so a wrong secret is diagnosable rather than
silent. `TURNSTILE_SECRET_KEY` is build-required, same tier as SMTP.

Two ordering facts that are not obvious and will bite anyone who repeats this:
a Turnstile token is **single-use**, so verifying it here *and* forwarding it to
Supabase makes Supabase's check fail — which is why **Supabase's project-level
CAPTCHA must be turned OFF, and turned off FIRST**. Doing it the other way round
sends no token to a Supabase that still demands one and every sign-in fails. The
gap between the two costs nothing, since the old presence check was never real
protection anyway.

The hostname returned by siteverify is compared against the **current request's
own host**, deliberately not a hardcoded list. This project has lost sign-in
twice to stale hostname allow-lists — Cloudflare's widget list (error 110200 on
a second Vercel domain) and Supabase's redirect URLs — and a third list that
silently breaks login on a new domain is the mistake worth not repeating.
Cloudflare already refuses to render the widget on an unlisted hostname, so this
is defence in depth, not the primary control.

**Google sign-in now runs on the college's own OAuth client, with the callback
on this app's own domain.** Previously `signInWithOAuth` ran the whole dance on
Supabase's side with Supabase's Google app, putting two things outside this
app's control that had each already broken sign-in in production. Now
`app/[lang]/auth/google/start` builds the authorize URL (PKCE S256, `state`,
`nonce`), `app/[lang]/auth/google/callback` exchanges the code and verifies the
`id_token` against Google's JWKS, and only the finished identity is handed to
Supabase via `signInWithIdToken`.

**Where the line sits is the whole design.** Supabase still ISSUES the session,
so `auth.uid()` and all 83 RLS policies behave exactly as before and this app
owns no signing key. `redirect_uri` is fixed to `/th/...` regardless of the
viewer's locale — Google matches it exactly, so a per-locale path would mean two
URLs per domain and would silently break the day a third locale is added; the
real locale travels in a cookie. The domain rule moved with the flow and got
**stronger**: it used to rest on `profiles.email`'s CHECK failing an insert
after the fact, and now an unverified or non-college address is refused before
any row is touched. `hd` was never enforcement — Google does not enforce it.

**The design that did NOT happen, and why that is the better outcome.** The
approved plan was to mint our own session JWTs with the project's symmetric JWT
secret. A gate was built to prove PostgREST would accept them — and then the
project moved to **ECC (asymmetric) JWT signing**, where Supabase holds the
private key and never releases it. The premise cannot be satisfied at all. Worth
recording as a relief rather than a setback: token signing is the one part of
this stack that fails **OPEN** when wrong, with 38 of 83 policies downstream of
`auth.uid()`. A subtly wrong token would not error — every owner-scoped policy
would quietly return zero rows, or the wrong ones.

**Verification.** Both were proven against production the same day, by
database evidence rather than by a page looking right: the captcha by a
`/th/forgot-password` submission minting `password_setup_tokens` row 3 at
`07:59:09` (baseline 2) with the mail arriving, which exercises `siteverify`
and the SMTP path together; the OAuth flow by a real sign-in moving
`auth.users.last_sign_in_at` to `07:50:12`, checked 47 seconds later so it could
not be a leftover session. The flow was merged **alongside** the working
Supabase path and reachable only by typing its URL, then switched once proven —
sign-in is the one path that locks everyone out, and this environment can reach
neither Google nor the deployed site.

Offline, `checkGoogleClaims()` was split out of the JWKS call so the claim rules
could be exercised without a live Google: **29/29**, including a token signed by
a **different key**, `alg:none`, wrong audience, wrong issuer, expired, nonce
mismatch, an **absent nonce claim against an empty expected nonce** (a missing
cookie must never be equivalent to a passing check), `email_verified: false`,
`gmail.com`, and a lookalike domain `evil-udontech.ac.th.attacker.com` — all
refused; plus `code_challenge` asserted to equal `sha256(verifier)` and the
verifier asserted never to appear in the authorize URL. Turnstile got the same
treatment: 11/11 branches with a stubbed `fetch` (Cloudflare is unreachable from
the build environment), then two further runs with the secret removed to prove
both no-secret branches — development skips with a warning, production refuses
every token.

**Three things that cost real time and are worth not rediscovering:**

1. **Route Handlers are outside `middleware.ts`'s matcher** (it skips `/api`),
   and middleware is what refreshes the Supabase session cookie. So a direct hit
   on `/api/...` can see a **signed-out caller while the site shows that person
   signed in**. An admin-session gate on a diagnostic endpoint was unusable for
   exactly this reason.
2. **A 404 without `cache-control: no-store` gets cached by the browser** and
   every later attempt is served from cache without reaching the server. This
   looked precisely like a broken deployment and sent several rounds chasing a
   deploy problem that did not exist. Incognito behaving differently from a
   normal window is the tell.
3. **A pre-check that aborts the run is worse than no pre-check.** The JWT gate
   returned early when its offline secret check failed, which stopped it before
   the two checks that actually decided anything — and its diagnosis conflated
   "this is not a JWT at all" with "wrong secret", pointing at the wrong
   variable. Both fixed, but the shape is general: a convenience check must not
   gate the real one.

**A prediction that was wrong, recorded because the process was right.** The
prime suspect for a captcha failure was `remoteip` (taken from
`x-forwarded-for`, which Cloudflare validates against the IP that solved the
challenge). It works fine in production. Testing before changing avoided an
unnecessary edit to working code — the alternative would have been shipping an
untested change to fix an unconfirmed problem.

**Not verified:** a sign-in through the **login button** itself. The proof above
came from opening `/th/auth/google/start` directly, before the button was
switched. Also unconfirmed: whether
`test-claude-ka-600a.vercel.app/th/auth/google/callback` is registered in Google
Console — sign-in was proven only on `swart-delta`, and a missing URI fails that
domain with `redirect_uri_mismatch`, the same shape as the two hostname
allow-list outages above.

**The front of the app was restructured: the dashboard moved onto `/calendar`,
the homepage became a banner carousel, and the activity time picker stopped
showing AM/PM (migration `0065`).** Seven requests in one pass.

**The AM/PM picker was not a formatting bug.** Nothing in this codebase formats
time that way — every `format()` call is already `HH:mm`. `<input type="time">`
renders from the **browser's** language, ignoring the page's `lang`, so a Thai
page in an English-language browser shows an AM/PM picker and no attribute or
stylesheet reaches it. `components/ui/time-input.tsx` replaces it with two
native `<select>`s (00–23 / 00–59) writing `HH:mm` into a hidden input, so the
`name="startTime"`/`name="endTime"` form contract, `actions/activities.ts` and
the Zod schema are untouched. Native selects keep the OS picker on mobile and
need no JavaScript. Minutes are 0–59 rather than 5-minute steps so no existing
activity time becomes unselectable.

The §8 card grid moved out of `app/[lang]/(app)/dashboard/page.tsx` into
`components/dashboard/dashboard-grid.tsx`, and `/{lang}/calendar` now serves
**two pages**: a guest keeps the plain public month view, a signed-in viewer
(`can(role, "workspace:access")` — the same predicate the `(app)` layout
enforced, so nothing became visible to a role that could not already see it)
gets the grid. The grid carries its own month view and holiday panel, so the
two are never rendered together. Every card keeps its own `<Suspense>` +
`CardBoundary`; that per-card isolation is why one failing card cannot take the
page down (§30.7) and it would have been easy to lose in a move.

**The trap this created, and why three changes had to land in one commit.**
`/{lang}` redirected signed-in viewers to `signedInLandingTarget()`, which
returned `/{lang}/dashboard`. Making `/dashboard` redirect to `/` would have
produced an **infinite redirect loop for every signed-in visitor on the whole
site**, not one page. So: the homepage's redirect is gone, `signedInLandingTarget()`
returns `/{lang}`, and `homeHrefFor()` is gone entirely (home is `/` for
everyone, so `navFor()`'s per-role override and `Logo`'s `role` prop went with
it). Verified rather than argued — `/th` and `/th/dashboard` curled for all five
roles, **every result exactly one hop**, `/th` 200 throughout.

`/{lang}/dashboard` is kept as a `redirect()` rather than deleted: it is the old
sign-in landing target, sits in bookmarks, and is still written into
notification links by `0036`/`0039`. It stays inside the `(app)` group on
purpose, so its layout still sends a guest to `/login` rather than bouncing them
around the public site.

**Four collateral breakages found while moving, each fixed rather than left:**
the calendar card's month arrows pointed at `/{lang}/dashboard`, which would now
redirect and drop the `?month=` param; the attendance "back to dashboard" link
and its dictionary key; the `revalidatePath()` targets in
`actions/{activities,attendance}.ts`, which were refreshing a route that no
longer renders anything; and `holiday-list.tsx`'s "ดูปฏิทินทั้งหมด" link, which
now sat on the full calendar. `(app)/dashboard/error.tsx` was deleted — the page
it protected is gone and `app/[lang]/error.tsx` covers the calendar route.

**The homepage banner carousel (`0065_site_banners.sql`).** `/{lang}` leads with
a carousel of images tagged with an academic year and เทอม, newest first, arrows
as plain `<Link>`s driven by a `?b=` param so paging works with JavaScript
disabled (§30.9) — the same choice `/calendar`'s month nav already makes. Staff
(`content:manage` — `aft`/`teacher`/`admin`) additionally get an upload panel,
a publish step, and a delete dialog that asks for the year + เทอม and then the
typed `"ยืนยัน"`, reusing the confirm-text pattern from
`attendance-confirm-form.tsx` and `signature-flow.tsx`. Upload is the two-phase
flow `components/activities/banner-manager.tsx` already established (browser →
Storage direct, the action carries only the path — Server Actions cap at 1MB).

**Draft is a real state, not a flag, and that is what the CHECK enforces.** A
Facebook post carries no year and no เทอม, so an imported banner cannot be
described well enough to publish and an admin fills those in.
`site_banners_published_needs_term` makes that an invariant rather than a form
rule; combined with `site_banners_select_published` (anon sees published rows
only) it gives **published ⇒ visible ⇒ fully described** — the same shape
`books_published_needs_pdf` (0053) gives the shelf.

**Column grants do the work RLS cannot**, the `0055`/`0061` lesson applied up
front rather than after a live finding: a `WITH CHECK` clause only ever sees the
NEW row, so no policy can say "this column must not change". `storage_path`,
`source`, `facebook_post_id`, `created_by` and `published_at` are all
un-updatable. `source` and `facebook_post_id` are granted to **nobody at all**,
so only the importer's service-role client can create a row claiming a Facebook
origin — a staff member cannot dress an upload up as one, and cannot write the
dedupe key to make the next poll skip a real post. Verified against
`information_schema.column_privileges` after applying, not assumed from the
migration text.

**A trap specific to this feature, worth naming**: staff hold *both*
`site_banners_select_published` and `site_banners_select_staff`, and permissive
policies OR together — so a signed-in staff member visiting the homepage would
have seen their own unreviewed drafts rendered on the **public** carousel if the
query leaned on RLS alone. `listPublishedBanners()` filters `status` explicitly
for that reason. Same shape as `0038`'s `list_notifications` restating scope
because `notifications_all_admin` was broader than the app's meaning of "mine".

**Facebook import.** `services/facebook-banner.ts` fetches the Page's newest
photo via the Graph API, **copies the image into our own bucket** and inserts it
as `source = 'facebook'`, `status = 'draft'`, deduped on `facebook_post_id`.
Copying rather than hotlinking is load-bearing: Facebook's CDN URLs are signed
and short-lived and the Page token expires in ~60 days, so a homepage pointing
straight at them would go blank on its own schedule. Triggered by a route
handler a Vercel Cron calls daily, **not** on page load — the homepage must
never wait on Facebook. The route is fail-closed on a `CRON_SECRET` bearer, the
same shape as `/api/push/dispatch`: an endpoint that makes the server fetch and
store a remote image is not one to leave open.

**Why a daily poll and not a Meta Webhook** (asked directly, considered rather
than dismissed): a webhook needs a Meta App, an App Secret, HMAC
`X-Hub-Signature-256` verification on every delivery, a public callback
answering `hub.challenge`, and App Review. It does **not** remove the Page token
either — the `feed` payload carries a post id, not a usable image URL — and
because Meta drops deliveries a webhook design still needs a polling fallback.
Strictly more machinery for latency worth nothing on a banner that changes a few
times a year.

`FACEBOOK_PAGE_ID`/`FACEBOOK_PAGE_ACCESS_TOKEN` are deliberately **not** in
`lib/env-guard.ts`: unset means "no Facebook banner", which is real graceful
degradation — the same argument that file already makes for the VAPID keys, and
the opposite of the SMTP/Turnstile/Google case, where a missing value is a
locked front door. Do not "fix" that inconsistency without reading the comment.

**Verified live this pass, via the Supabase MCP:** `0065` applied, and
`supabase/tests/0065_site_banners_test.sql` run against the hosted project —
**22/22, self-rolling-back, zero residue confirmed after** (0 banners, the
temporarily-flipped `aft` profile back to `student`). The cases that carry the
design: a `student` and `anon` are refused; `aft`, `teacher` and `admin` are
allowed; `term = 3` and an out-of-range year are refused by their CHECKs;
publishing without a year or เทอม is refused with `23514` both on INSERT and on
a later UPDATE; a student sees only the published row while staff see the drafts
too; anon sees **0** drafts; and a duplicate `facebook_post_id` is refused with
`23505`. Deleting asserts `ROW_COUNT` rather than catching an exception, because
**RLS FILTERS a DELETE instead of raising** — an exception-based helper reads a
forbidden delete as "allowed". The helpers record `sqlerrm`, not just SQLSTATE,
which is what distinguishes an RLS refusal (`42501 new row violates row-level
security policy`) from a grant refusal (`42501 permission denied for table`) —
both raise the same code.

**A test-harness trap hit and worth not repeating:** `set local
request.jwt.claims` inside a helper **outlives that helper's `reset role`**, so
a later statement meant to run as a migration still saw the previous actor's
`auth.uid()` — and `prevent_role_self_escalation` correctly refused a teacher
changing anyone's role. The fix is `set_config('request.jwt.claims', null,
true)` before the flip, since the carve-out that path relies on is
`auth.uid() is null`. It looked like a policy bug and was a fixture bug.

`npx tsc --noEmit`, `npm run lint` and `npm run build` all pass clean.
Dictionary parity checked programmatically (850 keys per locale; the round trip
was diffed against `HEAD` to prove nothing was silently dropped — exactly three
keys added, one renamed). `npm run check:responsive` 72/72 on public pages, plus
a separate 3-breakpoint × 2-theme CDP pass over the authenticated
`/th/calendar` (which the script skips for want of credentials): zero horizontal
overflow, and `window.innerWidth` asserted against the requested width every
time so a silent emulation no-op fails loudly. Task 1 was proven in a real
browser rather than by reading the JSX: the day sheet was opened over CDP, the
add form shown, and the DOM read back — **0** `input[type="time"]`, four
`<select>`s with 25/61 options and correct Thai `aria-label`s, and setting
13 + 45 wrote `startTime=13:45` into the hidden field.

**Not verified, stated plainly:** **no image has ever been uploaded to this
bucket and the Facebook fetch has never run.** This session cannot reach
Facebook (the proxy denies `CONNECT`, as it does to `*.supabase.co` and the
Vercel domains), so the Graph call, the image copy, and a real
`createSignedUrl`-free public object URL are all unexercised — the same gap
`0053` left for book PDFs. The cron route is proven to **reject** (`401` with no
header and with a wrong bearer); the accept path was not exercised. The rendered
carousel, upload panel and delete dialog were checked with the `dev_role` cookie
stub against an empty table, so the empty state is what actually rendered.
`docs/facebook-banner.md` names the exact log line for each failure mode,
because the import deliberately fails soft.

**Advisor sweep after the banner work: five FK indexes added, one policy merge
attempted and REVERTED, and two of this file's own claims corrected
(`0066`/`0067`).**

Both advisor sets were run live rather than trusted from this file, and the
first result was that **two ❌ Remaining claims here were stale**:

* `auth_rls_initplan` — the bullet said "~10 policies call `auth.uid()`
  directly". `get_advisors(performance)` returns **zero** such findings; the
  `rls_initplan` migration (2026-08-12) already fixed them. The bullet is
  corrected.
* `assert_report_viewer` "was never added" (recorded in the `0061`–`0063`
  entry) — it exists in `0058`, in the live catalog, and in
  `types/database.ts`, and all three report RPCs gate on it, confirmed by
  reading `pg_proc.prosrc`. That entry recorded a drift the same pass then
  fixed; §0 is a running log and is not revised, so this is noted here instead.

Every remaining **security** advisory was checked and is by-design or
plan-gated, so nothing was changed for its own sake: `rls_enabled_no_policy` on
`password_setup_tokens`/`qr_scan_attempts` is the deliberate no-policy-no-grant
shape; the SECURITY DEFINER warnings are the app's own RPCs, each of which
enforces its own authorization (`get_citizen_id` gates on admin, verified);
leaked-password protection remains Pro-plan-gated.

**Five unindexed foreign keys were real and were fixed** (`0066`), the same
lint and the same fix as `0015`: `activity_banners.uploaded_by`,
`activity_editors.granted_by`, `attendance.recorded_by`,
`content_blocks.updated_by`, and `site_banners.created_by` — the last one
introduced by `0065` hours earlier, fixed rather than left as a known wart.

**The 18 `unused_index` findings were deliberately NOT acted on**, recorded so
nobody "fixes" them later by reading the lint without this note: those indexes
are unused because the project holds almost no production rows yet, not because
they are pointless — `profiles_full_name_trgm_idx` backs §18 global search and
`activities_department_idx` backs the §10 filters. Dropping them removes
exactly what the app needs once it has data.

**The part worth remembering: the `multiple_permissive_policies` merge was
tried on ONE pair and it was wrong.** `0066` merged `site_banners`' two SELECT
policies into one, argued as behaviour-preserving, on the grounds that both had
been written the same day and `0065`'s 22-case matrix could check it. The
matrix **failed case 19 — anon saw a draft** — and a direct probe isolated why:

    merged policy is `to anon, authenticated`, so its staff clause is evaluated
    for the anon ROLE too, and current_role() answers from the JWT CLAIM, not
    the Postgres role.
      role anon + a stale JWT claim  => current_role() = 'teacher' => drafts visible
      role anon + no claims (real prod) => 0 drafts, correct

Not exploitable today — PostgREST sets the Postgres role and the claims
together, so a genuine anon request cannot diverge. But that is exactly what
the merge threw away: the split makes the staff clause unreachable for anon
**by grant** (`to authenticated`) rather than by trusting role and claim to
agree. Trading an enforced boundary for an assumed one, to save a planner pass
on a table holding double-digit rows, is the wrong side of §28. Reverted in
`0067`, with the advisor warning left standing on purpose.

`0066`'s own header had cited this risk as the reason not to touch the other
~23 findings, and then made an exception for this one. **The exception was
wrong for the same reason the rule is right.** New case **19b** in
`supabase/tests/0065_site_banners_test.sql` pins it: it holds a staff JWT claim
while switching to the anon role and asserts zero drafts — the merged policy
fails it, the split passes. The suite is **23/23** live, self-rolling-back,
zero residue confirmed after (0 rows, the temporarily-flipped `aft` profile
back to `student`).

**A harness slip worth naming, because it cost the first diagnosis:** the
isolation probe ran through `execute_sql` **outside** an explicit transaction,
so its `do $$` block committed and left one `ZZPROBE/` row behind. Caught and
deleted in `0067`, and confirmed 0 afterwards. The test suites wrap everything
in `begin … rollback`; an ad-hoc probe does not unless it says so.

**Two banner-upload defects found by reading the code rather than by a
failure**, both in the path a human uses. The upload built its object path from
the **file name's** extension — `accept` is a hint the picker can be talked out
of, so `photo.jpe`, or a name with no dot, produced a path Storage accepts and
`bannerStoragePathSchema` then rejects. The extension now comes from the MIME
type, the same value the bucket itself validates, so client and server agree by
construction. And when that rejection happened the uploaded object **stayed in
a public bucket with no row pointing at it**, unreachable by the app's own
delete (which works by row) — `services/facebook-banner.ts` already rolled its
object back on a failed insert; the human path now does too.

**The cron route's ACCEPT path is now exercised**, which was the one branch
left open when the banner work shipped: correct bearer → `200`, and a lowercase
`authorization: bearer …` also works (Vercel's header casing is not
guaranteed). The three reject cases — no header, wrong secret, empty bearer —
all return `401`.


### ❌ Remaining

* **RLS policy performance — HALF OF THIS IS DONE, and this bullet's own
  earlier text was stale.** It claimed "~10 policies ... call `auth.uid()`/
  `current_role()` directly instead of `(select auth.uid())`". Checked against
  the live project rather than re-read from here: `get_advisors(performance)`
  returns **zero** `auth_rls_initplan` findings. The `rls_initplan` migration
  (applied 2026-08-12) already fixed them. Corrected here rather than left to
  mislead the next reader into re-doing finished work.
  What remains is **`multiple_permissive_policies` — ~23 findings** across
  `activities`/`books`/`documents`/`projects`/`profiles`/`attendance`/
  `notifications`/`document_drafts`/`announcements`/`signature_records`/
  `activity_banners`/`site_banners`: an inherent side effect of the additive
  "each role gets its own policy on top of the base ones" design. Real at
  scale, harmless at today's row counts. **Still deliberately not fixed, and
  now with direct evidence rather than caution** — see the `0066`/`0067` entry
  in §0: merging exactly ONE such pair, on a table written the same day, with a
  22-case matrix to check it, silently removed a structural guarantee and was
  reverted. A merged `to anon, authenticated` policy evaluates its staff clause
  for the anon role, and `current_role()` answers from the JWT claim rather
  than the Postgres role; the split makes that clause unreachable for anon **by
  grant**. If this is ever attempted again it needs the full
  guest/student/aft/teacher/admin × table matrix AND a case per merged pair
  holding a mismatched role/claim, which is what `0065`'s new case 19b does.
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
* **Two secrets were pasted into a chat transcript and should be treated as
  leaked** — the Google OAuth **client secret** and the Cloudflare Turnstile
  **secret key**. Rotate both (Google Cloud Console → Credentials → Reset
  Secret; Cloudflare → Turnstile → the widget → rotate). The Google one is now
  load-bearing for **every** sign-in, so rotating it means updating Supabase's
  Google provider *and* Vercel in the same sitting, in that order, or sign-in
  breaks in between.
* **Six env vars are now production-build-required, all set and confirmed
  working** — `lib/env-guard.ts` fails a Vercel production build without any of
  them, deliberately: `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` (setting a
  password is the only route into an account that has none),
  `TURNSTILE_SECRET_KEY` (the app verifies captcha tokens itself now), and
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Google is the only way in). Each
  is in the guard for the same reason: a missing value is a locked front door,
  not the graceful degradation a missing VAPID key gives. The same file argues
  the opposite case for push, on purpose — do not "fix" that inconsistency
  without reading its comment. `SUPABASE_JWT_SECRET` is NOT among them and can
  be deleted from Vercel; nothing reads it since the self-minted-JWT design was
  abandoned.
* **The Facebook banner import is built but has never run.** Three server-only
  vars have to be set in Vercel before it does anything:
  `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN` and `CRON_SECRET`.
  Deliberately **not** build-required (see the §0 entry) — unset means "no
  Facebook banner", and uploading by hand works regardless. Once set, confirm
  the accept path of `/api/banners/facebook`, which is the one branch this
  session could not exercise: the reject path (`401` on a missing and on a
  wrong bearer) is proven, the success path is not.
* **A long-lived Page token expires in ~60 days.** When it does the fetch fails,
  the log says so, and every already-imported banner keeps working, because the
  image was copied into our own bucket rather than hotlinked. A System User
  token is the only non-expiring option and needs a Business Manager. This is
  the one part of the banner feature with a scheduled maintenance cost.
* **No image has ever been uploaded to the `site-banners` bucket**, so the
  public object URL, the MIME/size limits and the two-phase upload have not been
  exercised against real Storage — the same gap `0053` still leaves for book
  PDFs. First thing to confirm after deploy: a staff upload lands, publishing
  with a year + เทอม makes it visible to a signed-out visitor, and the arrows
  page correctly with more than one banner.
* **Correction to this section's own prior claim**: it used to say
  "`project_drafts` (Projects workflow) ... Plus Documents digital-signature
  ... none of those phases started." That was wrong by the time it was
  read for this pass — both shipped in commits `03f19e4`/`8260e14`, just
  never reflected here (see the Done-section entry above, added this pass
  specifically to close that gap). Audited every remaining §30.10 phase
  against the actual codebase (routes, migrations, package.json) rather than
  trusting this file's own prior bullets, since one of them had already gone
  stale silently:
  * **QR attendance (§13), `audit_logs`, Reports, global search and
    Announcements — ALL FIVE NOW DONE** (`0055`–`0060`, commits `078e22e`
    through `48fe43b`). The bullets that used to sit here saying each was
    "genuinely not started" were accurate when written and are superseded;
    see the §0 Done entry "Five 0% features built" for what shipped and what
    is still unproven about it.
  * **Notifications (§16) — in-app half now done** (see the Done entry above:
    trigger write path, per-user read state, real `/notifications` page, wired
    bell). **Web push is still not sent**: `push_subscriptions` (0033/0034)
    stores browser subscriptions and `public/sw.js` exists, but nothing ever
    calls `web-push` — `VAPID_PRIVATE_KEY` remains documented in
    `.env.example` and unused by any code. Sending is the remaining piece,
    and the natural trigger for it is the same 0036 notification insert that
    now drives the in-app UI. **Also still pending: the three VAPID vars
    (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
    must be set in Vercel** — a keypair was generated this pass and works
    locally via `.env.local`, but until those land in the Vercel project the
    Settings web-push toggle renders nothing in production.
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
    `activities` table. Realtime landed for the **dashboard calendar card**
    specifically (see the "Dashboard calendar compacted... realtime usage"
    entry above, `0035_activities_realtime.sql`) — the standalone
    `/activities` page (`services/activities.ts#listActivities`/
    `getActivityCounts`) deliberately was not touched by that pass and still
    has no `supabase.channel` usage; its own table/stats strip still requires
    a manual refresh to see a new row.
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

* Dashboard — **no longer a page.** `/{lang}/dashboard` is a `redirect()` to
  `/{lang}`; the §8 card grid renders on `/{lang}/calendar` for a signed-in
  viewer. Kept as a redirect because it is the old sign-in landing target and
  `0036`/`0039` still write it into notification links.
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

Two independent axes: a **role** (what tier of system access you have) and an
**อวท. ตำแหน่ง** (what office you hold). They are not ranks of one another.

### Roles

| Role | Thai | Can do |
|---|---|---|
| `guest` | ผู้เยี่ยมชม | Read official/public content only |
| `student` | นักเรียน/นักศึกษา | **Read-only.** Signed in: own profile, notifications, and which activities they have missed |
| `aft` | **นักศึกษา อวท.** | Student + submit project drafts, QR attendance, digital signature, review/comment/recommend, manage activities and site content |
| `teacher` | **ครู** | **Identical permissions to `aft`** |
| `admin` | ผู้ดูแลระบบ | Everything, incl. approving projects/documents and member management |

**A plain `student` cannot submit drafts, take QR attendance or sign
documents.** Those belong to นักศึกษา อวท. and ครู. An earlier version of this
section attributed them to "Student", written before `aft` existed — that was
wrong and is corrected here.

`aft` and `teacher` share ONE permission list in `lib/auth/permissions.ts`
(`organisationPermissions`), referenced twice. They are separate roles so
reporting can tell an อวท. student member from staff, not so they differ in
power. If they ever must diverge, that should be a deliberate split of that
constant.

Approval sits **above** whoever submits: `aft`/`teacher` submit and recommend,
`admin` approves to `official`. That is what keeps "send a project and it stays
a draft" true.

### ตำแหน่ง (8 offices)

ประธาน · รองประธาน · ปฏิคม · นายทะเบียน · ประชาสัมพันธ์ · เลขานุการ · ครู ·
กรรมการ — `member_position` enum. `null` = general member.

Two rules, both enforced in the database rather than the UI:

* **A ตำแหน่ง SETS the role.** `sync_role_with_position()` promotes
  `student` → `aft` when one is assigned, and demotes back when cleared.
  `teacher` and `admin` are deliberately left alone — `advisor` (ครู) is
  itself one of the eight, precisely so a real teacher can hold an office.
* **Assigning a ตำแหน่ง is therefore a privilege grant**, so
  `prevent_position_change` restricts it to `admin`. Holding one grants
  nothing by itself; `aft` is never assignable directly.

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

**Where it renders:** `components/dashboard/dashboard-grid.tsx`, shown on
`/{lang}/calendar` to a viewer holding `workspace:access`. A guest gets the
plain public month view on that same route instead; the grid carries its own
month view and holiday panel, so the two are never both on the page. There is
no `/{lang}/dashboard` page any more — see §5.

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

### E-books are a separate thing from this workflow

`documents` (above) and `books` (the `/documents` shelf) are two tables and
two flows. Do not conflate them:

* A **document** goes through the signature workflow above. It has no file
  upload of its own.
* A **book** is a **PDF in the private `books` Storage bucket**, read
  through a signed URL minted per request and opened in a new tab by the
  browser's own viewer. There is **no flipbook host** — the AnyFlip and
  FlipHTML5 integrations were both removed in `0053`.

A book's stage is `books.status` (`draft` → `published`), not the document
statuses above. Two rules, both in the database rather than the UI:

* `books_published_needs_pdf` (`0053`) — **published ⇒ a PDF exists**.
* `books_select_published` (`0028`) — a guest only ever sees published rows.

Publishing needs `document:approve`, which **only `admin`** holds, so a book
is always seen by someone other than its author before going public.
`lib/books.ts#canOpenBookPdf` is the app-layer read of those rules: a
published book opens for anyone, a draft only for its owner or staff.

`approveDocument` used to auto-list an approved document on the shelf from
its `flipbook_url`. That bridge is **gone** — there is no such column, and
`documents` has nothing to upload. Restoring it needs a `pdf_path` on
`documents` plus the two-phase upload flow `components/books` already has.

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

A student's college email local part **is** their student ID.

```text
66209010020@udontech.ac.th
66      20901        00       20
└ year  └ programme  └ group  └ running number
2       5 digits     2        2+ digits
```

Validation: `^[0-9]{11,}$` — 11 **or more**, since the running number grows.

Parse (`lib/student-id.ts`, isomorphic — one implementation, used by both the
client form and the server):

* **Year** = first 2 digits (`66`) — also drives the generated
  `profiles.academic_year`
* **Programme code** = next **5** digits (`20901`) — the OVEC (สอศ.)
  `รหัสสาขาวิชา`, matched against `departments.code`
* **Group** = next 2 (`00`) — the student's classroom index
* **Running number** = whatever remains (`20`)

The middle 7 digits together are the `รหัสวิชา` as usually written, but only
the first **five** identify the สาขา. Treating all 7 as the department is the
bug 0043 fixed — it made every student outside group `00` look like they
belonged to a สาขา that did not exist.

**The first digit of the programme code is the qualification:**

| Digit | Level | Example |
|---|---|---|
| `2` | ปวช. — ประกาศนียบัตรวิชาชีพ | `20901` เทคโนโลยีสารสนเทศ |
| `3` | ปวส. — ประกาศนียบัตรวิชาชีพชั้นสูง | `30901` เทคโนโลยีสารสนเทศ |
| `4` | ทล.บ. — เทคโนโลยีบัณฑิต | `40101` เทคโนโลยีเครื่องยนต์ |

Any other digit yields an unknown level — deliberately **not** a parse
failure, so a future qualification can never block admitting a real student.
Naming a new digit (ป.ตรี or anything later) is a four-step, compiler-guided
change — `StudentLevel`, the `switch`, `LevelLabels`, and `common.levels` in
both dictionaries — written up in `docs/add-education-level.md`. Note `4`
(ทล.บ. — เทคโนโลยีบัณฑิต) is *already* a bachelor's degree, so a ป.ตรี request
is usually a new **สาขา** under an existing level, which needs no code at all.

**สาขา is resolved automatically at sign-in.** `handle_new_user()` looks the
5-digit code up in `departments` and fills `profiles.department_id`. An
unregistered code yields NULL and the sign-in still succeeds — a สาขา the
college has not registered must never lock out a student. Admins register new
codes inline from `/members` → กรอกอัตโนมัติ, which pre-fills the code.

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
profiles            departments        clubs
activities          attendance         projects
documents           document_drafts    signature_records
books               content_blocks
notifications       notification_reads push_subscriptions
qr_sessions         qr_scan_attempts   audit_logs
announcements       activity_banners   activity_editors
password_setup_tokens                  site_banners
```

All of §20's original list now exists. `password_setup_tokens` (0064) is the
one table that was never in it: it holds the SHA-256 of the password-setup
link this app emails itself, and nothing but the service-role client may
touch it (no policies, no grants — the `qr_scan_attempts` shape).
`site_banners` (0065) is the other: the homepage banner carousel. Do not
confuse it with `activity_banners` (0063), which is photos attached to one
activity — different table, different bucket, different write boundary
(per-activity co-editor there, `content:manage` here).

Deviations from the original list, deliberate and already shipped:

* `roles` was never created — role is the `user_role` enum on `profiles`,
  with `member_position` as a second, independent column (§6).
* `project_drafts` was never created — a project's stage is
  `projects.status`, the same shape `document_drafts` uses for its half.
* `approved_accounts` existed briefly as a signup allow-list and was
  **dropped** when approval-on-signup was removed; nothing reads it.

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
