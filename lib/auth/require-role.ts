import "server-only";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth/get-role";
import { can, type Permission } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";

/**
 * Server-side guard for routes that require a permission from the §6 matrix.
 * Redirects to /login when the viewer's role doesn't hold it. Session-backed
 * role resolution replaces the getRole() dev-cookie stub in §30.5 — callers
 * of requirePermission() don't change.
 */
export async function requirePermission(
  permission: Permission,
  lang: Locale
): Promise<Role> {
  const role = await getRole();

  if (!can(role, permission)) {
    redirect(`/${lang}/login`);
  }

  return role;
}

/**
 * Same fail-closed contract as requirePermission, for actions two disjoint
 * roles can legally reach at different workflow stages (e.g. rejecting a
 * project: plain teacher at teacher_review, aft_teacher/admin at
 * admin_approval) — not a new permission, just an OR over existing ones.
 */
export async function requireAnyPermission(
  permissions: readonly Permission[],
  lang: Locale
): Promise<Role> {
  const role = await getRole();

  if (!permissions.some((permission) => can(role, permission))) {
    redirect(`/${lang}/login`);
  }

  return role;
}
