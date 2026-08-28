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
 * "home" is `/` for everyone. It used to be `/dashboard` for a signed-in
 * viewer (via a `homeHrefFor(role)` override applied in navFor below), because
 * the homepage redirected them there anyway. Both are gone: /{lang}/dashboard
 * folded into /{lang}/calendar and now redirects to `/`, and the homepage
 * renders for signed-in viewers too.
 */
export const navItems: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "calendar", href: "/calendar" },
  { key: "activities", href: "/activities" },
  // §5: public. The shelf of documents about the organisation itself — the
  // same books table and the same page component as /documents, with 0074's
  // `admin_info` collection pinned and no list switcher.
  { key: "adminInfo", href: "/admin-info" },
  // §5: public. "11 ดี 11 เก่ง อวท." lives on /documents, which shows its two
  // lists (11 ดี / 11 เก่ง). The route kept its URL when it stopped being the
  // general เอกสาร shelf, because it is in bookmarks and every book detail
  // page links back to it; /aft-11 redirects here.
  { key: "aft11", href: "/documents" },
  // §5: public — guests can browse the directory to check whether they're
  // registered; services/members.ts hides email from them and the "add
  // filters"/edit affordances stay role-gated inside the page itself.
  { key: "members", href: "/members" },
  // §5: public. Published announcements are readable by guests
  // (announcements_select_published, 0060). This entry closes B-1 — the route
  // was linked from the footer but absent here, so it was a dead link.
  { key: "announcements", href: "/announcements" },
  // Exactly seven tabs, in this order, per the confirmed spec.
  //
  // Deliberately NOT here, and still reachable by URL: /projects, /reports and
  // /audit, which moved into the (unused) route group — see its README. Their
  // nav.* dictionary keys stay, because those pages still read them as their
  // own <h1>. No "approvals" entry either: approving a signup moved onto
  // /members, and the old route is a redirect for stale links.
];

/**
 * Nav visibility is filtered by the same predicate the route guard enforces
 * (`requirePermission`), so a link can never appear for a role that would be
 * bounced on arrival.
 */
export function navFor(role: Role): NavItem[] {
  return navItems.filter(
    (item) => item.permission === undefined || can(role, item.permission)
  );
}
