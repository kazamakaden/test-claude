"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/schemas/auth";
import { assertTurnstileSafeForProduction, isTurnstileConfigured } from "@/lib/turnstile";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

type AuthErrorKey =
  | "invalidEmail"
  | "personalDomain"
  | "wrongDomain"
  | "sendFailed"
  | "captchaFailed"
  | "notApproved";

export type SignInResult = { ok: true } | { ok: false; messageKey: AuthErrorKey };

function isAuthErrorKey(value: string | undefined): value is AuthErrorKey {
  return value === "invalidEmail" || value === "personalDomain" || value === "wrongDomain";
}

/**
 * §14 allow-list rejection surfaces from handle_new_user() as a Postgres
 * exception during signInWithOtp itself (shouldCreateUser defaults to true,
 * so the auth.users insert — and its trigger — fires at OTP-request time,
 * not at magic-link verification). Distinguish it from a generic send
 * failure so the user gets an actionable message instead of "try again".
 */
function isNotApprovedError(message: string): boolean {
  return message.includes("account not approved");
}

/**
 * Bound directly to the login form's `action` attribute (useActionState),
 * so submission works with JavaScript disabled — a real POST, not a
 * client-invoked RPC. `lang` travels as a hidden field for the same reason:
 * a bound argument can't be set by a plain HTML form post.
 *
 * Re-validates server-side with the same schema the client form uses (never
 * trust client validation alone — §19, §30.5, and the §30.9 "submit with JS
 * disabled" check all require this).
 */
export async function signIn(
  _prevState: SignInResult | null,
  formData: FormData
): Promise<SignInResult> {
  // Throws in production if the sitekey is missing or a Cloudflare test key
  // — both would otherwise fail open (no CAPTCHA enforced, or an
  // always-pass key doing the enforcing). Never trips in development.
  assertTurnstileSafeForProduction();

  const rawLang = formData.get("lang");
  const lang: Locale = typeof rawLang === "string" && isLocale(rawLang) ? rawLang : defaultLocale;

  const parsed = loginSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isAuthErrorKey(rawKey) ? rawKey : "invalidEmail" };
  }

  const captchaToken = formData.get("cf-turnstile-response");
  if (
    isTurnstileConfigured &&
    (typeof captchaToken !== "string" || captchaToken.length === 0)
  ) {
    return { ok: false, messageKey: "captchaFailed" };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/${lang}/auth/callback`,
      ...(typeof captchaToken === "string" && captchaToken.length > 0
        ? { captchaToken }
        : {}),
    },
  });

  // Same success response whether or not the address is registered —
  // signInWithOtp doesn't distinguish, and we don't want to either
  // (account enumeration). The §14 allow-list rejection is the one
  // deliberate exception: telling an unapproved student "contact an admin"
  // is more useful than a generic failure, and it doesn't leak whether a
  // *named* address exists — only that a student-ID-shaped one isn't approved.
  if (error) {
    if (isNotApprovedError(error.message)) {
      return { ok: false, messageKey: "notApproved" };
    }
    return { ok: false, messageKey: "sendFailed" };
  }

  return { ok: true };
}

export async function signOut(lang: Locale) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${lang}`);
}
