"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema } from "@/schemas/auth";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type ChangePasswordErrorKey =
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordNeedsLowercase"
  | "passwordNeedsUppercase"
  | "passwordNeedsSymbol"
  | "passwordMismatch"
  | "sessionExpired"
  | "updateFailed"
  | "unknown";

const FIELD_ERROR_KEYS = new Set<ChangePasswordErrorKey>([
  "passwordTooShort",
  "passwordTooLong",
  "passwordNeedsLowercase",
  "passwordNeedsUppercase",
  "passwordNeedsSymbol",
  "passwordMismatch",
]);

function fieldErrorKey(rawKey: string | undefined): ChangePasswordErrorKey {
  return rawKey && FIELD_ERROR_KEYS.has(rawKey as ChangePasswordErrorKey)
    ? (rawKey as ChangePasswordErrorKey)
    : "unknown";
}

export type ChangePasswordResult = { ok: true } | { ok: false; messageKey: ChangePasswordErrorKey };

function readLang(formData: FormData): Locale {
  const raw = formData.get("lang");
  return typeof raw === "string" && isLocale(raw) ? raw : defaultLocale;
}

/**
 * Settings > change password. Deliberately a NEW action, not a reuse of
 * actions/auth.ts#updatePassword — that one is reached only via the
 * short-lived recovery session app/[lang]/auth/reset/route.ts mints from a
 * password-reset link, and its trailing signOut()+redirect(/login?notice=)
 * is load-bearing there (a recovery session must not continue as an
 * ordinary session, and it's the terminal step of "Google sign-in -> set
 * password -> now sign in"). This action runs under the caller's ordinary,
 * already-signed-in session and must NOT sign them out or redirect — the
 * settings dialog needs to render a success state in place.
 *
 * Trade-off, stated rather than hidden: the current password is not
 * verified. supabase.auth.updateUser({password}) doesn't check it, and the
 * obvious workaround — re-authenticating with signInWithPassword — is
 * rejected outright on this project, since Turnstile is enforced at the
 * Supabase project level (captcha protection: request disallowed) and a
 * settings dialog has no captcha widget of its own. The mitigations that do
 * apply: the caller must hold a live session (requirePermission below), and
 * lib/auth/session-timeout.ts already caps every session at 12 hours. On
 * success, every OTHER session is revoked (scope: "others") so a change
 * made by someone who walked up to an unlocked, already-signed-in browser
 * at least locks out whoever else was signed in — this does not verify the
 * old password, it only limits the blast radius of not verifying it.
 */
export async function changePasswordAction(
  _prevState: ChangePasswordResult | null,
  formData: FormData
): Promise<ChangePasswordResult> {
  const lang = readLang(formData);
  await requirePermission("profile:update", lang);

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { ok: false, messageKey: fieldErrorKey(parsed.error.issues[0]?.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, messageKey: "sessionExpired" };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, messageKey: "updateFailed" };
  }

  await supabase.from("profiles").update({ password_set: true }).eq("id", user.id);

  try {
    await supabase.auth.signOut({ scope: "others" });
  } catch (signOutError) {
    // Best-effort — a failure here must not turn a successful password
    // change into an error toast; the caller's own session is untouched
    // either way.
    console.error("[changePasswordAction] signOut(others) failed", signOutError);
  }

  revalidatePath(`/${lang}`, "layout");
  return { ok: true };
}
