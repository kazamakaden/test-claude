"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { updateContentBlockSchema } from "@/schemas/content";
import { updateContentBlock } from "@/services/content";
import { readLang } from "@/lib/i18n/config";

type ContentBlockErrorKey = "titleRequired" | "titleTooLong" | "bodyTooLong" | "unknown";

function isContentBlockErrorKey(value: string | undefined): value is ContentBlockErrorKey {
  return value === "titleRequired" || value === "titleTooLong" || value === "bodyTooLong";
}

export type ContentBlockFormResult = { ok: true } | { ok: false; messageKey: ContentBlockErrorKey };

/**
 * Task 2 content-block edit. Gated on content:manage (aft_teacher/admin,
 * lib/auth/permissions.ts) — the same boundary content_blocks_update_staff
 * (0032) enforces in RLS, so a bypassed UI check still can't write.
 * `updated_by` is the caller's own session id, never a form value — same
 * discipline as `created_by` in actions/activities.ts.
 */
export async function updateContentBlockAction(
  _prevState: ContentBlockFormResult | null,
  formData: FormData
): Promise<ContentBlockFormResult> {
  const lang = readLang(formData);
  await requirePermission("content:manage", lang);

  const parsed = updateContentBlockSchema.safeParse({
    slug: formData.get("slug"),
    titleTh: formData.get("titleTh"),
    titleEn: formData.get("titleEn") || null,
    bodyTh: formData.get("bodyTh") || "",
    bodyEn: formData.get("bodyEn") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isContentBlockErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "unknown" };

  const result = await updateContentBlock(parsed.data, user.id);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/aft-11`);
  return { ok: true };
}
