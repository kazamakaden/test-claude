"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { updateMemberSchema } from "@/schemas/members";
import { updateMember } from "@/services/members";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type UpdateMemberErrorKey =
  | "invalidRole"
  | "forbiddenRole"
  | "invalidStudentId"
  | "studentIdTaken"
  | "fullNameTooLong"
  | "classNameTooLong"
  | "unknown";

export type UpdateMemberResult = { ok: true } | { ok: false; messageKey: UpdateMemberErrorKey };

function isUpdateMemberErrorKey(value: string | undefined): value is UpdateMemberErrorKey {
  return (
    value === "invalidRole" ||
    value === "forbiddenRole" ||
    value === "invalidStudentId" ||
    value === "studentIdTaken" ||
    value === "fullNameTooLong" ||
    value === "classNameTooLong"
  );
}

/**
 * Re-checks member:approve server-side (§19) — never trusts the page guard
 * ran. Same actor-narrowing as actions/approvals.ts#approveUser: an
 * aft_teacher actor may not grant aft_teacher, mirroring
 * prevent_role_self_escalation (0024), which is the real enforcement.
 */
export async function updateMemberAction(
  _prevState: UpdateMemberResult | null,
  formData: FormData
): Promise<UpdateMemberResult> {
  const rawLang = formData.get("lang");
  const lang: Locale = typeof rawLang === "string" && isLocale(rawLang) ? rawLang : defaultLocale;

  const actorRole = await requirePermission("member:approve", lang);

  const parsed = updateMemberSchema.safeParse({
    id: formData.get("id"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
    clubId: formData.get("clubId") || null,
    studentId: formData.get("studentId") || null,
    className: formData.get("className") || null,
    fullName: formData.get("fullName") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isUpdateMemberErrorKey(rawKey) ? rawKey : "unknown" };
  }

  if (actorRole !== "admin" && parsed.data.role === "aft_teacher") {
    return { ok: false, messageKey: "forbiddenRole" };
  }

  const result = await updateMember(parsed.data);

  if (!result.ok) {
    return {
      ok: false,
      messageKey: isUpdateMemberErrorKey(result.error) ? result.error : "unknown",
    };
  }

  revalidatePath(`/${lang}/members`);
  return { ok: true };
}
