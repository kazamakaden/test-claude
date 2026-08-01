# CLAUDE.md — AFT UDONTECH Dashboard

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

### Colors

Primary blue 30%:
`#002583`

Mustard accent 10%:
`#FFB800`

Neutral 60%.

Light:

* Background `#F8FAFC`
* Card `#FFFFFF`
* Border `#E5E8EF`
* Text `#111827`

Dark:

* Background `#0F172A`
* Card `#1E293B`
* Border `#334155`
* Text `#F8FAFC`

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
