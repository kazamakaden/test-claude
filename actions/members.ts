"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { updateMemberSchema, createMemberSchema, createDepartmentSchema } from "@/schemas/members";
import { updateMember, createMember, deleteMember, createDepartment } from "@/services/members";
import { revokeProfileApproval } from "@/services/profiles";
import { createClient } from "@/lib/supabase/server";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type UpdateMemberErrorKey =
  | "invalidRole"
  | "forbiddenRole"
  | "invalidPosition"
  | "forbiddenPosition"
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
    value === "invalidPosition" ||
    value === "forbiddenPosition" ||
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

export type RevokeMemberResult =
  | { ok: true }
  | { ok: false; messageKey: "selfRevoke" | "adminRevoke" | "unknown" };

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
    // Absent for a non-admin (the select isn't rendered for them), which the
    // schema's .optional() turns into "leave the office as it is".
    // "__none__" is the Select's "no office" sentinel (member-edit-sheet.tsx);
    // it must become null rather than reach z.enum, which would reject it as
    // an invalid position and make "remove someone's office" impossible.
    ...(formData.has("position")
      ? {
          position:
            formData.get("position") === "__none__" ? null : formData.get("position") || null,
        }
      : {}),
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isUpdateMemberErrorKey(rawKey) ? rawKey : "unknown" };
  }

  if (actorRole !== "admin" && parsed.data.role === "aft_teacher") {
    return { ok: false, messageKey: "forbiddenRole" };
  }

  // Only an admin may assign an อวท. office. Hiding the select from everyone
  // else is UX; THIS is the app-layer guard, and prevent_position_change
  // (0044) is the one that holds regardless of both. Without it an officer —
  // who reaches this action via member:approve — could POST a `position`
  // field by hand and mint officers, turning one appointment into unbounded
  // authority.
  if (parsed.data.position !== undefined && actorRole !== "admin") {
    return { ok: false, messageKey: "forbiddenPosition" };
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

/**
 * "Stop approve" — sends an already-approved member back to `pending` so
 * every requirePermission-guarded route bounces them to /pending on their
 * next request (lib/auth/require-role.ts#deniedRedirectTarget), without the
 * account-deletion services/members.ts#deleteMember performs. Gated on
 * member:approve (admin + aft_teacher — the same tier that can approve at
 * /approvals), not member:manage, matching the distinction
 * lib/auth/permissions.ts already draws between approval authority and
 * admin-only account management.
 *
 * Same two server-side guards as deleteMemberAction, checked here rather
 * than relying solely on prevent_role_self_escalation (0002/0024) to raise:
 * that trigger's raise ("cannot change your own role") is mapped by
 * services/profiles.ts#revokeProfileApproval to "forbiddenRole", which this
 * action's UpdateMemberErrorKey-shaped result type doesn't carry — checking
 * here first gives a clearer messageKey and avoids relying on a raw
 * Postgres error string staying stable across a future migration.
 */
export async function revokeMemberAction(lang: Locale, id: string): Promise<RevokeMemberResult> {
  await requirePermission("member:approve", lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === id) {
    return { ok: false, messageKey: "selfRevoke" };
  }

  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "admin") {
    return { ok: false, messageKey: "adminRevoke" };
  }

  const result = await revokeProfileApproval(id);
  if (!result.ok) {
    return { ok: false, messageKey: "unknown" };
  }

  // One path now: a revoked member drops out of the directory list and
  // reappears in the pending-approvals section, both of which live on
  // /members since /approvals was folded into it.
  revalidatePath(`/${lang}/members`);
  return { ok: true };
}

type CreateDepartmentErrorKey =
  | "invalidDepartmentCode"
  | "departmentNameRequired"
  | "departmentNameTooLong"
  | "departmentCodeTaken"
  | "notAllowed"
  | "unknown";

export type CreateDepartmentResult =
  | { ok: true; department: { id: string; code: string; nameTh: string; nameEn: string } }
  | { ok: false; messageKey: CreateDepartmentErrorKey };

function isCreateDepartmentErrorKey(v: unknown): v is CreateDepartmentErrorKey {
  return (
    v === "invalidDepartmentCode" ||
    v === "departmentNameRequired" ||
    v === "departmentNameTooLong" ||
    v === "departmentCodeTaken" ||
    v === "notAllowed" ||
    v === "unknown"
  );
}

/**
 * Adds a new รหัสวิชา from /members/autoinput.
 *
 * `member:manage` (admin), not `member:approve` — creating a department
 * reshapes the directory for every user, so it belongs with account management
 * rather than with approving an individual member. Re-checked here regardless
 * of what the page rendered, and again by departments_insert_admin (0042) at
 * the database.
 *
 * Plain-argument signature rather than FormData: this is submitted from the
 * autoinput form's own client state, which is JavaScript-only by nature (the
 * whole feature is live parsing as you type), the same justified deviation
 * actions/push.ts already documents.
 */
export async function createDepartmentAction(
  lang: Locale,
  input: unknown
): Promise<CreateDepartmentResult> {
  const safeLang: Locale = isLocale(lang) ? lang : defaultLocale;
  await requirePermission("member:manage", safeLang);

  const parsed = createDepartmentSchema.safeParse(input);
  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isCreateDepartmentErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const result = await createDepartment(parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      messageKey: isCreateDepartmentErrorKey(result.error) ? result.error : "unknown",
    };
  }

  // Both pages render a department filter built from this table.
  revalidatePath(`/${safeLang}/members`);
  revalidatePath(`/${safeLang}/activities`);

  return { ok: true, department: result.department };
}
