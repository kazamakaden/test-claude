"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-role";
import { approveAccountSchema } from "@/schemas/approvals";
import { addApprovedAccount, removeApprovedAccount } from "@/services/approvals";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type ApproveErrorKey = "invalidEmail" | "wrongDomain" | "invalidRole" | "duplicate" | "unknown";

export type ApproveAccountResult = { ok: true } | { ok: false; messageKey: ApproveErrorKey };

function isApproveErrorKey(value: string | undefined): value is ApproveErrorKey {
  return value === "invalidEmail" || value === "wrongDomain" || value === "invalidRole";
}

/**
 * Re-checks member:manage server-side (§19) — never trusts that the page
 * guard ran, same reasoning as every other Server Action in this codebase.
 */
export async function approveAccount(
  _prevState: ApproveAccountResult | null,
  formData: FormData
): Promise<ApproveAccountResult> {
  const rawLang = formData.get("lang");
  const lang: Locale = typeof rawLang === "string" && isLocale(rawLang) ? rawLang : defaultLocale;

  await requirePermission("member:manage", lang);

  const parsed = approveAccountSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isApproveErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, messageKey: "unknown" };
  }

  const result = await addApprovedAccount(parsed.data, user.id);

  if (!result.ok) {
    // Postgres unique_violation on approved_accounts.email.
    const messageKey = result.error.includes("duplicate key") ? "duplicate" : "unknown";
    return { ok: false, messageKey };
  }

  revalidatePath(`/${lang}/approvals`);
  return { ok: true };
}

export async function revokeAccount(id: string, lang: Locale) {
  await requirePermission("member:manage", lang);
  await removeApprovedAccount(id);
  revalidatePath(`/${lang}/approvals`);
}
