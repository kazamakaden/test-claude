"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { setOwnCitizenIdSchema, updateOwnProfileSchema } from "@/schemas/profile";
import { setOwnCitizenId, updateOwnProfile } from "@/services/profiles";
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

type CitizenIdErrorKey = "citizenIdInvalid" | "alreadySet" | "unknown";

function isCitizenIdErrorKey(value: string | undefined): value is CitizenIdErrorKey {
  return value === "citizenIdInvalid" || value === "alreadySet";
}

export type CitizenIdFormResult = { ok: true } | { ok: false; messageKey: CitizenIdErrorKey };

/**
 * §14 เลขบัตรประชาชน — the owner sets it once.
 *
 * Same authorization shape as updateOwnProfileAction above, and for the same
 * reason: gated on profile:update, and the target row is always the caller's
 * own session id, never a form value. There is no `id` field to tamper with.
 *
 * Set-once is NOT enforced here. prevent_citizen_id_change (0003) raises when
 * the column is already non-null and the actor is not an admin, so the rule
 * holds for every client rather than only for this form; this action just
 * translates that raise into a message.
 */
export async function setOwnCitizenIdAction(
  _prevState: CitizenIdFormResult | null,
  formData: FormData
): Promise<CitizenIdFormResult> {
  const lang = readLang(formData);
  await requirePermission("profile:update", lang);

  const parsed = setOwnCitizenIdSchema.safeParse({ citizenId: formData.get("citizenId") });
  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isCitizenIdErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "unknown" };

  const result = await setOwnCitizenId(user.id, parsed.data.citizenId);
  if (!result.ok) {
    return { ok: false, messageKey: isCitizenIdErrorKey(result.error) ? result.error : "unknown" };
  }

  revalidatePath(`/${lang}/profile`);
  return { ok: true };
}
