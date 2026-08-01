import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

export type NavItem = {
  key: keyof Dictionary["nav"];
  href: string;
  roles: readonly Role[];
};

const allRoles: readonly Role[] = ["guest", "student", "teacher", "admin"];
const signedIn: readonly Role[] = ["student", "teacher", "admin"];

export const navItems: readonly NavItem[] = [
  { key: "home", href: "/", roles: allRoles },
  { key: "calendar", href: "/calendar", roles: allRoles },
  { key: "projects", href: "/projects", roles: signedIn },
  { key: "activities", href: "/activities", roles: allRoles },
  { key: "documents", href: "/documents", roles: allRoles },
  { key: "members", href: "/members", roles: signedIn },
  { key: "reports", href: "/reports", roles: signedIn },
];

export function navFor(role: Role): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role));
}
