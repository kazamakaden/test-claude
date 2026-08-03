"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireAnyPermission } from "@/lib/auth/require-role";
import { createProjectSchema, updateProjectDraftSchema, rejectProjectSchema } from "@/schemas/projects";
import {
  createProjectDraft,
  updateProjectDraft,
  submitProjectDraft,
  recommendProject as recommendProjectService,
  approveProject as approveProjectService,
  rejectProject as rejectProjectService,
} from "@/services/projects";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type ProjectErrorKey = "titleRequired" | "unknown";
export type SaveProjectResult = { ok: true; id: string } | { ok: false; messageKey: ProjectErrorKey };
export type RejectProjectResult = { ok: true } | { ok: false; messageKey: "reasonRequired" | "unknown" };

function isProjectErrorKey(value: string | undefined): value is ProjectErrorKey {
  return value === "titleRequired";
}

function getLang(formData: FormData): Locale {
  const raw = formData.get("lang");
  return typeof raw === "string" && isLocale(raw) ? raw : defaultLocale;
}

/** Re-checks project:draft:submit server-side (§19) — never trusts the page guard ran. */
export async function createProject(
  _prevState: SaveProjectResult | null,
  formData: FormData
): Promise<SaveProjectResult> {
  const lang = getLang(formData);
  await requirePermission("project:draft:submit", lang);

  const parsed = createProjectSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    departmentId: formData.get("departmentId") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isProjectErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "unknown" };

  const result = await createProjectDraft(parsed.data, user.id);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/projects`);
  // A Next.js control-flow signal — must propagate uncaught, never swallowed.
  redirect(`/${lang}/projects/${result.id}`);
}

export async function saveProjectDraft(
  _prevState: SaveProjectResult | null,
  formData: FormData
): Promise<SaveProjectResult> {
  const lang = getLang(formData);
  await requirePermission("project:draft:submit", lang);

  const parsed = updateProjectDraftSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    departmentId: formData.get("departmentId") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isProjectErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const result = await updateProjectDraft(parsed.data);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/projects/${parsed.data.id}`);
  return { ok: true, id: parsed.data.id };
}

export async function submitProject(id: string, lang: Locale) {
  await requirePermission("project:draft:submit", lang);
  await submitProjectDraft(id);
  revalidatePath(`/${lang}/projects/${id}`);
}

export async function recommendProject(id: string, lang: Locale) {
  await requirePermission("project:recommend", lang);
  await recommendProjectService(id);
  revalidatePath(`/${lang}/projects/${id}`);
  revalidatePath(`/${lang}/projects/review`);
}

export async function approveProject(id: string, lang: Locale) {
  await requirePermission("project:approve", lang);
  await approveProjectService(id);
  revalidatePath(`/${lang}/projects/${id}`);
  revalidatePath(`/${lang}/projects/review`);
  revalidatePath(`/${lang}/projects`);
}

/**
 * RLS is what actually confines a plain teacher to teacher_review-stage
 * rows and lets aft_teacher/admin touch admin_approval-stage rows — this
 * permission check is a UX/defense-in-depth gate, not the enforcement
 * point.
 */
export async function rejectProject(
  _prevState: RejectProjectResult | null,
  formData: FormData
): Promise<RejectProjectResult> {
  const lang = getLang(formData);
  await requireAnyPermission(["project:recommend", "project:approve"], lang);

  const parsed = rejectProjectSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { ok: false, messageKey: "reasonRequired" };
  }

  const result = await rejectProjectService(parsed.data);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/projects/${parsed.data.id}`);
  revalidatePath(`/${lang}/projects/review`);
  return { ok: true };
}
