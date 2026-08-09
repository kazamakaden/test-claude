"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { updateOwnProfileSchema } from "@/schemas/profile";
import { updateOwnProfile } from "@/services/profiles";
import { readLang } from "@/lib/i18n/config";

type ProfileErrorKey = "fullNameRequired" | "fullNameTooLong" | "unknown";

function isProfileErrorKey(value: string | undefined): value is ProfileErrorKey {
  return value === "fullNameRequired" || value === "fullNameTooLong";
}

export type ProfileFormResult = { ok: true } | { ok: false; messageKey: ProfileErrorKey };

/**
 * Gated on profile:update (student and above, lib/auth/permissions.ts) —
 * guest/pending don't hold it. The target row is always the caller's own
 * session id, never a form value — that, plus profiles_update_own (0002),
 * is the whole authorization story; there is no `id` field to tamper with.
 */
export async function updateOwnProfileAction(
  _prevState: ProfileFormResult | null,
  formData: FormData
): Promise<ProfileFormResult> {
  const lang = readLang(formData);
  await requirePermission("profile:update", lang);

  const parsed = updateOwnProfileSchema.safeParse({
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isProfileErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "unknown" };

  const result = await updateOwnProfile(user.id, parsed.data.fullName);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/profile`);
  revalidatePath(`/${lang}`, "layout");
  return { ok: true };
}
