"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { approveUserSchema } from "@/schemas/approvals";
import { setProfileRole } from "@/services/profiles";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type ApproveErrorKey = "invalidRole" | "unknown";

export type ApproveUserResult = { ok: true } | { ok: false; messageKey: ApproveErrorKey };

function isApproveErrorKey(value: string | undefined): value is ApproveErrorKey {
  return value === "invalidRole";
}

/**
 * Re-checks member:manage server-side (§19) — never trusts that the page
 * guard ran, same reasoning as every other Server Action in this codebase.
 */
export async function approveUser(
  _prevState: ApproveUserResult | null,
  formData: FormData
): Promise<ApproveUserResult> {
  const rawLang = formData.get("lang");
  const lang: Locale = typeof rawLang === "string" && isLocale(rawLang) ? rawLang : defaultLocale;

  await requirePermission("member:manage", lang);

  const parsed = approveUserSchema.safeParse({
    id: formData.get("id"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isApproveErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const result = await setProfileRole(parsed.data.id, parsed.data.role, parsed.data.departmentId);

  if (!result.ok) {
    return { ok: false, messageKey: "unknown" };
  }

  revalidatePath(`/${lang}/approvals`);
  return { ok: true };
}
