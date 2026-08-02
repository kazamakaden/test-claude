---
phase: 01-foundation
reviewed: 2026-08-01T00:00:00Z
depth: deep
files_reviewed: 34
files_reviewed_list:
  - app/[lang]/layout.tsx
  - app/[lang]/(app)/layout.tsx
  - app/[lang]/(app)/dashboard/page.tsx
  - app/[lang]/(app)/members/page.tsx
  - app/[lang]/(app)/notifications/page.tsx
  - app/[lang]/(app)/profile/page.tsx
  - app/[lang]/(app)/projects/page.tsx
  - app/[lang]/(app)/reports/page.tsx
  - app/[lang]/(public)/layout.tsx
  - app/[lang]/(public)/page.tsx
  - app/[lang]/(public)/login/page.tsx
  - app/[lang]/(public)/activities/page.tsx
  - app/[lang]/(public)/announcements/page.tsx
  - app/[lang]/(public)/calendar/page.tsx
  - app/[lang]/(public)/documents/page.tsx
  - app/globals.css
  - components/layout/top-nav.tsx
  - components/layout/nav-links.tsx
  - components/layout/mobile-nav.tsx
  - components/layout/user-menu.tsx
  - components/layout/dev-role-switcher.tsx
  - components/layout/language-toggle.tsx
  - components/layout/page-shell.tsx
  - components/layout/footer.tsx
  - components/layout/theme-toggle.tsx
  - components/layout/skip-to-content.tsx
  - components/layout/logo.tsx
  - components/layout/notifications-button.tsx
  - components/theme-provider.tsx
  - lib/auth/get-role.ts
  - lib/i18n/config.ts
  - lib/i18n/get-dictionary.ts
  - lib/i18n/dictionaries/th.json
  - lib/i18n/dictionaries/en.json
  - lib/navigation.ts
  - middleware.ts
  - types/auth.ts
  - types/i18n.ts
  - components/ui/button.tsx
  - components/ui/sheet.tsx
  - components/ui/dropdown-menu.tsx
  - package.json
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-01
**Depth:** deep
**Files Reviewed:** 34 (all files touched by the two commits, excluding shadcn-generated static UI primitives beyond button/sheet/dropdown-menu, package-lock.json, and binary image assets)
**Status:** issues_found

## Summary

Reviewed both commits (`593efb6` scaffold, `45860a4` design system + top-nav).
`npx tsc --noEmit` and `npm run build` both pass clean, confirming the
commit-message claims. The `#002583` / `#FFB800` OKLCH conversions in
`globals.css` were independently verified byte-for-byte against the
CLAUDE.md palette — no color-fidelity bug found there, contrary to my
initial hypothesis.

No secrets, no `eval`, no XSS vectors, no left sidebar (top-nav layout
correctly implemented). The main issues are: (1) two accessible/authenticated
routes (`dashboard`, `members`, `projects`, `reports`) are reachable with
zero authorization enforcement even though CLAUDE.md §5/§6 classifies them
as authenticated-only — currently *anyone*, including a browser with no
cookies at all, can view them since `getRole()` only ever downgrades the
*nav items shown*, never blocks page access; (2) a `prefers-reduced-motion`
gap in the animated nav underline; (3) a mislabeled `<nav>` landmark; (4)
minor duplication and dead-end UI affordances. All are consistent with an
intentionally incomplete Phase 1 foundation commit (auth guard is explicitly
noted as deferred to §30.5 in code comments), but are called out below since
they are currently live on `master` and CLAUDE.md's priority order puts
Security first (§28).

## Warnings

### WR-01: Authenticated routes have no server-side access control at all

**File:** `app/[lang]/(app)/layout.tsx:14-36`, `app/[lang]/(app)/dashboard/page.tsx`, `.../members/page.tsx`, `.../projects/page.tsx`, `.../reports/page.tsx`, `.../notifications/page.tsx`, `.../profile/page.tsx`

**Issue:** The `(app)` route group's layout only calls `getRole()` to decide
which nav items to *render* — it never redirects unauthenticated visitors.
Every route in this group (`/th/dashboard`, `/th/members`, `/th/projects`,
`/th/reports`, `/th/profile`, `/th/notifications`) is fully reachable by an
anonymous visitor today, in direct contradiction of CLAUDE.md §5 ("Members,
Activities, Projects, Documents, Reports … Authenticated") and §6
("Always enforce permissions with Supabase RLS, not only UI checks" —
here there isn't even a UI check gating the route, only gating which nav
*link* is shown). The code comment on line 9-13 acknowledges the guard is
deferred to §30.5, which is a reasonable phased plan, but as merged this
means anyone can navigate directly to `/th/members` right now and see the
(stub) authenticated page with no redirect to `/login`.
**Fix:** Either (a) land the guard in the same commit that introduces the
`(app)` route group (a minimal `requireRole`/`redirectIfSignedOut` stub that
denies everything until Supabase auth exists), or (b) if deferring is
intentional, put the stub pages behind a `noindex` + explicit
"not yet enforced" runtime guard so the gap can't silently ship to
production between phases. At minimum, track this in the PR/README as a
known gap, since `master` is the deploy branch.

### WR-02: Animated nav underline ignores `prefers-reduced-motion`

**File:** `app/globals.css:146-155`, `components/layout/nav-links.tsx:83-89`

**Issue:** CLAUDE.md §25 requires "Respect `prefers-reduced-motion`." The
CSS block in `globals.css` only zeroes out `animation-duration` /
`transition-duration`, which affects CSS transitions/animations. The active
route indicator in `NavLinks` (`<motion.div layoutId="nav-underline" ... transition={{ duration: 0.22 }} />`) is driven by Framer Motion's own animation
engine (RAF-based `transform`/`layout` animation), which is not a CSS
transition and is therefore untouched by the media query. Users with
`prefers-reduced-motion: reduce` will still see the underline slide between
nav items.
**Fix:** Read `useReducedMotion()` from `framer-motion` and either skip the
`layoutId` animation or force `transition={{ duration: 0 }}` when reduced
motion is requested:
```tsx
import { useReducedMotion } from "framer-motion";
const prefersReducedMotion = useReducedMotion();
...
transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: "easeOut" }}
```

### WR-03: Both desktop and mobile `<nav>` landmarks are mislabeled

**File:** `components/layout/top-nav.tsx:27`, `components/layout/mobile-nav.tsx:50`

**Issue:** Both the desktop nav (`<nav aria-label={dict.nav.home}>`) and the
mobile sheet nav (`<nav aria-label={dict.nav.home}>`) use the translated
string for the "Home" nav *item* ("หน้าแรก"/"Home") as the `aria-label` for
the entire navigation landmark. Screen reader users navigating by landmark
will hear the region announced as "Home navigation," which doesn't describe
its contents (it's the primary site navigation, not a link named "Home").
This also means two separate landmarks in the DOM share the identical label
once both are considered by assistive tech tooling that inspects the whole
page (e.g. axe/Lighthouse "landmark unique" checks), which is a WCAG best
practice violation (CLAUDE.md §24 requires "semantic HTML … ARIA labels
when necessary").
**Fix:** Add a dedicated `common.mainNav` (and optionally `common.mobileNav`)
string to the dictionaries and use that instead of reusing `dict.nav.home`:
```tsx
<nav aria-label={dict.common.mainNav}>
```

### WR-04: `getRole()` / dev-role cookie is trusted without validation depth and silently no-ops "Settings"/"Sign out"

**File:** `components/layout/user-menu.tsx:69-77`

**Issue:** The `DropdownMenuItem` entries for "Settings" and "Sign out" have
no `onClick`/`render` link — clicking them does nothing and gives no
feedback (no toast, no navigation, no disabled state). This is a dead-end
affordance: a real user who hasn't read the source will conclude the app is
broken (indistinguishable from a rendering bug) rather than "coming soon."
**Fix:** Either wire minimal stub behavior (e.g. `sonner` toast: "Coming
soon") consistent with the `PageShell` pattern used elsewhere, or mark the
items `disabled` so they're not presented as interactive:
```tsx
<DropdownMenuItem disabled>
  <Settings />
  {dict.common.settings}
</DropdownMenuItem>
```

### WR-05: `getDictionary`/layout params trust an unvalidated `lang` route param

**File:** `app/[lang]/layout.tsx:49-50`, and every page under `app/[lang]/**` (e.g. `app/[lang]/(public)/page.tsx:12-13`)

**Issue:** Every layout/page does `const lang = rawLang as Locale;` — a bare
type assertion with no runtime check that `rawLang` is actually `"th"` or
`"en"`. `generateStaticParams` only produces `th`/`en`, but Next.js dynamic
segments are not statically exhaustive at the routing layer by default;
if `dynamicParams` is ever left at its default (`true`) and any code path
reaches this route with another segment value (middleware currently
prevents this for normal navigation, but middleware can be bypassed by
`_next`/prefetch edge cases, direct `fetch`, or a future change to the
middleware matcher), `getDictionary(lang)` — `lib/i18n/get-dictionary.ts:11`
— will do `dictionaries[lang]()` where `dictionaries['xx']` is `undefined`,
throwing `TypeError: dictionaries[locale] is not a function` and crashing
the request with an unhandled 500 instead of a friendly 404.
**Fix:** Validate and fall back explicitly:
```ts
import { isLocale, defaultLocale } from "@/lib/i18n/config";
const lang = isLocale(rawLang) ? rawLang : defaultLocale;
```
or call `notFound()` from `next/navigation` when `!isLocale(rawLang)`, and
set `export const dynamicParams = false` on `app/[lang]/layout.tsx` so
Next.js 404s automatically for any locale outside `generateStaticParams`.

## Info

### IN-01: Ten near-identical stub pages duplicate the same 15 lines

**File:** `app/[lang]/(app)/dashboard/page.tsx`, `.../members/page.tsx`, `.../notifications/page.tsx`, `.../profile/page.tsx`, `.../projects/page.tsx`, `.../reports/page.tsx`, `app/[lang]/(public)/activities/page.tsx`, `.../announcements/page.tsx`, `.../calendar/page.tsx`, `.../documents/page.tsx`, `.../login/page.tsx`

**Issue:** Every stub page repeats the identical
`await params → cast lang → getDictionary → <PageShell ...>` boilerplate,
differing only in the icon and dictionary key. This is expected/acceptable
for placeholder pages ahead of real features, but as more phases add real
logic to some of these routes, the copy-paste base makes it easy for one
page to silently miss a future shared change (e.g. the `WR-05` locale-guard
fix above will need to be pasted into all 11 files instead of one place).
**Fix:** Not urgent for Phase 1, but consider a small helper (e.g. a
`resolveLangParams(params)` utility in `lib/i18n/`) that centralizes the
`await params` + validate + `getDictionary` sequence so all pages call one
function.

### IN-02: `DevRoleSwitcher` cookie is set without `Secure`/`SameSite=Strict` and persists 1 year

**File:** `components/layout/dev-role-switcher.tsx:9-11`

**Issue:** `document.cookie = \`dev_role=${role}; path=/; max-age=31536000; samesite=lax\`` has no `Secure` attribute and a 1-year expiry. The component is gated behind `process.env.NODE_ENV !== "development"` so it can't render in production, but the cookie itself, once set in a dev environment, has no expiry tied to dev-mode and no `Secure` flag, so it would linger in the browser (and be sent over plain HTTP) long after the developer moves on. Low real-world impact since `getRole()` also gates on `NODE_ENV`, but it's an easy copy-paste source for a real cookie-setting utility later.
**Fix:** Add `Secure` (when not `localhost`) and consider a much shorter `max-age` (e.g. a session cookie) since it's only ever meant for the current dev session:
```ts
document.cookie = `dev_role=${role}; path=/; samesite=lax`; // session cookie
```

### IN-03: `NotificationsButton` unread count is a hardcoded prop with no data source

**File:** `components/layout/notifications-button.tsx:6`, `components/layout/top-nav.tsx:34`

**Issue:** `unreadCount = 0` is the only value ever passed (`top-nav.tsx`
never supplies `unreadCount`), so the "unread dot" branch is permanently
dead code for now. Not a bug, but worth flagging since CLAUDE.md §16
requires real notification support — this is a visual affordance with no
backing data yet, which is fine for Phase 1 scaffolding but should not be
mistaken for a finished feature.
**Fix:** No action needed for Phase 1; note as a TODO tracked against the
Notifications phase rather than left implicit.

### IN-04: shadcn primitives are built on `@base-ui/react`, not the traditional Radix primitives most "shadcn/ui" docs assume

**File:** `components/ui/button.tsx:1`, `components/ui/sheet.tsx:4`, `components/ui/dropdown-menu.tsx:4`, `package.json:13`

**Issue:** CLAUDE.md §2 says "shadcn/ui ONLY." The installed `shadcn@4.16.1`
CLI generated components on top of `@base-ui/react` (a newer, Radix-alternative
primitives library) rather than the historically-default `@radix-ui/react-*`
packages. This is not a violation of the letter of CLAUDE.md (the components
are still generated/customized via the shadcn CLI and registry, satisfying
"shadcn/ui ONLY"), but it is a meaningful deviation from what most
contributors/AI assistance will assume "shadcn/ui" means (Radix-based),
which can cause confusion when adding new components by hand later (Radix
and Base UI props/APIs differ, e.g. `render` prop instead of `asChild`).
**Fix:** No code change required; just document this choice (e.g. in
README or a short comment in `components.json`) so future contributors
don't accidentally mix Radix-based shadcn snippets from the web with this
Base UI-based setup.

---

_Reviewed: 2026-08-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
