"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { updateMemberSchema, createMemberSchema } from "@/schemas/members";
import { updateMember, createMember, deleteMember } from "@/services/members";
import { createClient } from "@/lib/supabase/server";
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

type CreateMemberErrorKey =
  | "invalidEmail"
  | "personalDomain"
  | "wrongDomain"
  | "emailExists"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordNeedsLowercase"
  | "passwordNeedsUppercase"
  | "passwordNeedsSymbol"
  | "invalidRole"
  | "invalidStudentId"
  | "studentIdTaken"
  | "fullNameTooLong"
  | "classNameTooLong"
  | "unknown";

export type CreateMemberResult = { ok: true } | { ok: false; messageKey: CreateMemberErrorKey };

const CREATE_MEMBER_ERROR_KEYS = new Set<CreateMemberErrorKey>([
  "invalidEmail",
  "personalDomain",
  "wrongDomain",
  "emailExists",
  "passwordTooShort",
  "passwordTooLong",
  "passwordNeedsLowercase",
  "passwordNeedsUppercase",
  "passwordNeedsSymbol",
  "invalidRole",
  "invalidStudentId",
  "studentIdTaken",
  "fullNameTooLong",
  "classNameTooLong",
]);

function isCreateMemberErrorKey(value: string | undefined): value is CreateMemberErrorKey {
  return Boolean(value) && CREATE_MEMBER_ERROR_KEYS.has(value as CreateMemberErrorKey);
}

export type DeleteMemberResult =
  | { ok: true }
  | { ok: false; messageKey: "selfDelete" | "adminDelete" | "unknown" };

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

/**
 * Admin-only (member:manage, not member:approve — same distinction §1 of
 * lib/auth/permissions.ts already draws for account-level management vs.
 * editing an already-approved member). An aft_teacher holds member:approve
 * but not member:manage, so this is unreachable for them; no actor-role
 * narrowing beyond the permission check itself is needed here, unlike
 * updateMemberAction above.
 */
export async function createMemberAction(
  _prevState: CreateMemberResult | null,
  formData: FormData
): Promise<CreateMemberResult> {
  const rawLang = formData.get("lang");
  const lang: Locale = typeof rawLang === "string" && isLocale(rawLang) ? rawLang : defaultLocale;

  await requirePermission("member:manage", lang);

  const parsed = createMemberSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
    clubId: formData.get("clubId") || null,
    studentId: formData.get("studentId") || null,
    className: formData.get("className") || null,
    fullName: formData.get("fullName") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isCreateMemberErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const result = await createMember(parsed.data);

  if (!result.ok) {
    return {
      ok: false,
      messageKey: isCreateMemberErrorKey(result.error) ? result.error : "unknown",
    };
  }

  revalidatePath(`/${lang}/members`);
  return { ok: true };
}

/**
 * Admin-only (member:manage). Two guards enforced HERE, server-side, never
 * trusting the confirm dialog: refuse to delete the caller's own account,
 * and re-read the TARGET's actual role from the database (not anything the
 * form sent) to refuse deleting an admin row. Both checks happen before
 * services/members.ts#deleteMember ever touches the Admin API — a
 * permanent delete has no undo, so these run first, not as an
 * afterthought.
 */
export async function deleteMemberAction(lang: Locale, id: string): Promise<DeleteMemberResult> {
  await requirePermission("member:manage", lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === id) {
    return { ok: false, messageKey: "selfDelete" };
  }

  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "admin") {
    return { ok: false, messageKey: "adminDelete" };
  }

  const result = await deleteMember(id);
  if (!result.ok) {
    return { ok: false, messageKey: "unknown" };
  }

  revalidatePath(`/${lang}/members`);
  return { ok: true };
}
