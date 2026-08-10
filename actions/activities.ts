"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createActivitySchema, updateActivitySchema, deleteActivitySchema } from "@/schemas/activities";
import { createActivity, updateActivity, deleteActivity } from "@/services/activities";
import { readLang, type Locale } from "@/lib/i18n/config";

type ActivityErrorKey = "invalidDate" | "invalidTime" | "titleRequired" | "descriptionTooLong" | "unknown";

function isActivityErrorKey(value: string | undefined): value is ActivityErrorKey {
  return (
    value === "invalidDate" ||
    value === "invalidTime" ||
    value === "titleRequired" ||
    value === "descriptionTooLong"
  );
}

export type ActivityFormResult = { ok: true } | { ok: false; messageKey: ActivityErrorKey };
export type DeleteActivityResult = { ok: true } | { ok: false; messageKey: "unknown" };

/**
 * Calendar day-sheet create. Gated on activity:manage (aft_teacher/admin,
 * §11.1 of lib/auth/permissions.ts) — the same boundary
 * activities_insert_aft_teacher/activities_all_admin (0008/0011) already
 * enforce in RLS, so a bypassed UI check still can't write. `created_by` is
 * the caller's own session id, never a form value.
 */
export async function createActivityAction(
  _prevState: ActivityFormResult | null,
  formData: FormData
): Promise<ActivityFormResult> {
  const lang = readLang(formData);
  await requirePermission("activity:manage", lang);

  const parsed = createActivitySchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") || null,
    location: formData.get("location") || null,
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isActivityErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "unknown" };

  const result = await createActivity(parsed.data, user.id);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/calendar`);
  return { ok: true };
}

export async function updateActivityAction(
  _prevState: ActivityFormResult | null,
  formData: FormData
): Promise<ActivityFormResult> {
  const lang = readLang(formData);
  await requirePermission("activity:manage", lang);

  const parsed = updateActivitySchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") || null,
    location: formData.get("location") || null,
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isActivityErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const result = await updateActivity(parsed.data);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/calendar`);
  return { ok: true };
}

export async function deleteActivityAction(lang: Locale, id: string): Promise<DeleteActivityResult> {
  await requirePermission("activity:manage", lang);

  const parsed = deleteActivitySchema.safeParse({ id });
  if (!parsed.success) return { ok: false, messageKey: "unknown" };

  const result = await deleteActivity(parsed.data.id);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/calendar`);
  return { ok: true };
}
