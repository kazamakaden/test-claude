import "server-only";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/get-role";
import { canAs, type Permission } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";

/**
 * Where a viewer without `permission` gets sent. Always /login now: with the
 * `pending` role gone there is no signed-in-but-unapproved state to route to
 * a waiting page — anyone signed in already holds a real role.
 */
function deniedRedirectTarget(_role: Role, lang: Locale): string {
  return `/${lang}/login`;
}

/** Where an already-signed-in viewer belongs instead of a guest-facing page (homepage, login, signup). */
export function signedInLandingTarget(_role: Role, lang: Locale): string {
  return `/${lang}/dashboard`;
}

/**
 * Server-side guard for routes that require a permission from the §6 matrix.
 * Redirects to /login when the viewer's role doesn't hold it (or /pending
 * for a signed-in-but-unapproved user — see deniedRedirectTarget). Session-
 * backed role resolution replaces the getRole() dev-cookie stub in §30.5 —
 * callers of requirePermission() don't change.
 */
export async function requirePermission(
  permission: Permission,
  lang: Locale
): Promise<Role> {
  // canAs, not can: an อวท. officer holds member:approve through their office
  // rather than their role, and can() sees only the role half — it would turn
  // a real officer away from a page they are entitled to.
  const actor = await getActor();

  if (!canAs(actor, permission)) {
    redirect(deniedRedirectTarget(actor.role, lang));
  }

  return actor.role;
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
  const actor = await getActor();

  if (!permissions.some((permission) => canAs(actor, permission))) {
    redirect(deniedRedirectTarget(actor.role, lang));
  }

  return actor.role;
}
