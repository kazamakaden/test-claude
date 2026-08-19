import "server-only";
import { redirect } from "next/navigation";
import { getSessionProfile, type SessionProfile } from "@/lib/auth/get-role";
import { can, type Permission } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";

/**
 * Where a viewer without `permission` gets sent. Always /login: with the
 * `pending` role gone (0046) there is no signed-in-but-unapproved state to
 * route to a waiting page — anyone signed in already holds a real role.
 *
 * The set-password gate below is a SEPARATE redirect target and is checked
 * first, because "signed in but hasn't finished onboarding" is not a
 * permission failure — the account may well hold the permission.
 */
function deniedRedirectTarget(_role: Role, lang: Locale): string {
  return `/${lang}/login`;
}

/**
 * Where an already-signed-in viewer belongs after sign-in, or instead of a
 * guest-facing page (login, signup).
 *
 * The homepage is NOT one of those pages any more. /{lang}/dashboard was
 * folded into /{lang}/calendar and now redirects to `/`, so a home page that
 * still bounced signed-in viewers here would redirect them straight back --
 * an infinite loop taking down the whole site, not one page. The three
 * changes that avoid it (this target, the removed home redirect, and
 * navigation.ts#homeHrefFor) belong together; do not revert one alone.
 */
export function signedInLandingTarget(_role: Role, lang: Locale): string {
  return `/${lang}`;
}


/**
 * A signed-in account that never completed the set-password step has not
 * finished onboarding, and is refused every guarded route and action until it
 * does.
 *
 * This has to be re-checked per request, not once at sign-in. The callback
 * (app/[lang]/auth/google/callback/route.ts) does redirect a fresh Google sign-in
 * here, but /set-password renders inside the (public) layout — which includes
 * the full TopNav — so a single click on the nav skipped the whole step and
 * landed the user in the app with no password. Two live accounts, one of them
 * an admin, got in exactly that way.
 *
 * `userId !== null` is load-bearing, not a defensive habit: both GUEST_PROFILE
 * and the dev_role cookie stub (lib/auth/get-role.ts) report `passwordSet:
 * false` alongside a null userId. Without this clause the gate would fire for
 * every guest and would break local development outright, since no dev_role
 * session could reach any (app) route.
 *
 * Scope, stated plainly: this is an APPLICATION-layer gate. The account still
 * holds a valid JWT whose role passes RLS, so it is not a database boundary —
 * see CLAUDE.md. Blocking at that level would mean changing the role itself.
 */
function requirePasswordSet(profile: SessionProfile, lang: Locale): void {
  if (profile.userId !== null && !profile.passwordSet) {
    redirect(`/${lang}/set-password`);
  }
}

/**
 * Server-side guard for routes that require a permission from the §6 matrix.
 * Redirects to /set-password when the viewer has not finished onboarding, and
 * to /login when their role doesn't hold the permission. Session-backed role
 * resolution replaces the getRole() dev-cookie stub in §30.5 — callers of
 * requirePermission() don't change.
 *
 * getSessionProfile() is cache()d and getRole() is a thin wrapper over it, so
 * reading the whole profile here costs the same one round trip per request.
 */
export async function requirePermission(
  permission: Permission,
  lang: Locale
): Promise<Role> {
  const profile = await getSessionProfile();
  requirePasswordSet(profile, lang);

  if (!can(profile.role, permission)) {
    redirect(deniedRedirectTarget(profile.role, lang));
  }

  return profile.role;
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
  const profile = await getSessionProfile();
  requirePasswordSet(profile, lang);

  if (!permissions.some((permission) => can(profile.role, permission))) {
    redirect(deniedRedirectTarget(profile.role, lang));
  }

  return profile.role;
}
