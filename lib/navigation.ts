import { can, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

export type NavItem = {
  key: keyof Dictionary["nav"];
  href: string;
  /** Undefined = public (§5). Otherwise the viewer must hold this permission. */
  permission?: Permission;
};

/**
 * Where "home" actually points for a viewer. A signed-in user's home is
 * their dashboard (or the waiting page while unapproved) — pointing them at
 * `/` instead costs a wasted round trip, because the homepage's own
 * `signedInLandingTarget()` redirect (app/[lang]/(public)/page.tsx) just
 * bounces them straight back out, rendering a blank page in between.
 *
 * Lang-less, like every other `navItems` href — callers prefix the locale.
 * Mirrors `signedInLandingTarget()`'s pending/dashboard split
 * (lib/auth/require-role.ts), which stays the actual redirect authority;
 * this only decides where the link points so the redirect is never needed.
 * That module is `server-only` and this one is imported by Client
 * Components, hence the deliberate small overlap rather than an import.
 */
export function homeHrefFor(role: Role): string {
  return role === "guest" ? "/" : "/dashboard";
}

export const navItems: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "calendar", href: "/calendar" },
  { key: "projects", href: "/projects", permission: "workspace:access" },
  { key: "activities", href: "/activities" },
  { key: "documents", href: "/documents" },
  // §5: public — "11 ดี 11 เก่ง อวท." is public page copy, editable in-app
  // only by staff (content:manage, lib/auth/permissions.ts).
  { key: "aft11", href: "/aft-11" },
  // §5: public — guests can browse the directory to check whether they're
  // registered; services/members.ts hides email from them and the "add
  // filters"/edit affordances stay role-gated inside the page itself.
  { key: "members", href: "/members" },
  { key: "reports", href: "/reports", permission: "workspace:access" },
  // §19 audit trail. `system:manage` = admin only, matching
  // audit_logs_select_admin (0057) — every other role would see an empty
  // table, so the link is hidden rather than rendered-then-refused.
  { key: "audit", href: "/audit", permission: "system:manage" },
  // No "approvals" entry: approving a pending signup moved onto /members,
  // which is already in this list and public. The old route still exists as a
  // redirect (app/[lang]/(app)/approvals/page.tsx) for stale links.
];

/**
 * Nav visibility is filtered by the same predicate the route guard enforces
 * (`requirePermission`), so a link can never appear for a role that would be
 * bounced on arrival.
 */
export function navFor(role: Role): NavItem[] {
  return navItems
    .filter((item) => item.permission === undefined || can(role, item.permission))
    .map((item) => (item.key === "home" ? { ...item, href: homeHrefFor(role) } : item));
}
