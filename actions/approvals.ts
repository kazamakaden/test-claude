"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { approveUserSchema } from "@/schemas/approvals";
import { setProfileRole } from "@/services/profiles";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type ApproveErrorKey = "invalidRole" | "forbiddenRole" | "unknown";

export type ApproveUserResult = { ok: true } | { ok: false; messageKey: ApproveErrorKey };

function isApproveErrorKey(value: string | undefined): value is ApproveErrorKey {
  return value === "invalidRole" || value === "forbiddenRole";
}

/**
 * Re-checks member:approve server-side (§19) — never trusts that the page
 * guard ran, same reasoning as every other Server Action in this codebase.
 *
 * An aft_teacher actor is additionally narrowed to student/teacher here —
 * granting aft_teacher itself stays admin-only. This mirrors
 * prevent_role_self_escalation (0024), which is the real enforcement; the
 * check here exists only to turn that trigger's raw Postgres exception into
 * a localized message instead of the generic "unknown" fallback.
 */
export async function approveUser(
  _prevState: ApproveUserResult | null,
  formData: FormData
): Promise<ApproveUserResult> {
  const rawLang = formData.get("lang");
  const lang: Locale = typeof rawLang === "string" && isLocale(rawLang) ? rawLang : defaultLocale;

  const actorRole = await requirePermission("member:approve", lang);

  const parsed = approveUserSchema.safeParse({
    id: formData.get("id"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isApproveErrorKey(rawKey) ? rawKey : "unknown" };
  }

  if (actorRole !== "admin" && parsed.data.role === "aft_teacher") {
    return { ok: false, messageKey: "forbiddenRole" };
  }

  const result = await setProfileRole(parsed.data.id, parsed.data.role, parsed.data.departmentId);

  if (!result.ok) {
    return {
      ok: false,
      messageKey: isApproveErrorKey(result.error) ? result.error : "unknown",
    };
  }

  revalidatePath(`/${lang}/approvals`);
  return { ok: true };
}
