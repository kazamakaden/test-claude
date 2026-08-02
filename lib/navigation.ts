import { can, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

export type NavItem = {
  key: keyof Dictionary["nav"];
  href: string;
  /** Undefined = public (§5). Otherwise the viewer must hold this permission. */
  permission?: Permission;
};

export const navItems: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "calendar", href: "/calendar" },
  { key: "projects", href: "/projects", permission: "workspace:access" },
  { key: "activities", href: "/activities" },
  { key: "documents", href: "/documents" },
  { key: "members", href: "/members", permission: "workspace:access" },
  { key: "reports", href: "/reports", permission: "workspace:access" },
  { key: "approvals", href: "/approvals", permission: "member:manage" },
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
