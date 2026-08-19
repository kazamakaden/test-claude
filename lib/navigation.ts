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
  { key: "projects", href: "/projects", permission: "workspace:access" },
  { key: "activities", href: "/activities" },
  // §5: public. Published announcements are readable by guests
  // (announcements_select_published, 0060). This entry closes B-1 — the route
  // was linked from the footer but absent here, so it was a dead link.
  { key: "announcements", href: "/announcements" },
  { key: "documents", href: "/documents" },
  // §5: public — "11 ดี 11 เก่ง อวท." is public page copy, editable in-app
  // only by staff (content:manage, lib/auth/permissions.ts).
  { key: "aft11", href: "/aft-11" },
  // §5: public — guests can browse the directory to check whether they're
  // registered; services/members.ts hides email from them and the "add
  // filters"/edit affordances stay role-gated inside the page itself.
  { key: "members", href: "/members" },
  // report:view, not workspace:access: the latter is held by a read-only
  // `student`, who has no §6 basis for org-wide attendance and membership
  // figures. The report RPCs (0058) enforce the same boundary themselves.
  { key: "reports", href: "/reports", permission: "report:view" },
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
  return navItems.filter(
    (item) => item.permission === undefined || can(role, item.permission)
  );
}
