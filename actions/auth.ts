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
  | "oauthFailed";

export type SignInResult = { ok: true } | { ok: false; messageKey: AuthErrorKey };

function isAuthErrorKey(value: string | undefined): value is AuthErrorKey {
  return value === "invalidEmail" || value === "personalDomain" || value === "wrongDomain";
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
  // (account enumeration). Every @udontech.ac.th signup is accepted and
  // lands 'pending' (0020) — there is no longer a pre-approval rejection
  // to special-case here.
  if (error) {
    return { ok: false, messageKey: "sendFailed" };
  }

  return { ok: true };
}

/**
 * Google OAuth, restricted to the same @udontech.ac.th domain as magic-link
 * sign-in. `hd` is a UI hint to Google's account picker only — it is NOT
 * enforcement and a user can bypass it by picking a different account than
 * the one it suggests. The actual boundary is profiles.email's CHECK
 * constraint (0001), which a non-college address fails at signup, plus the
 * explicit re-check in the callback route as defence in depth. Bound to the
 * login form's `action` (not an onClick handler) so it still works — as a
 * real redirect-driving POST — with JavaScript disabled, same reasoning as
 * signIn above.
 */
export async function signInWithGoogle(lang: Locale) {
  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/${lang}/auth/callback`,
      queryParams: { hd: "udontech.ac.th", prompt: "select_account" },
    },
  });

  if (error || !data?.url) {
    redirect(`/${lang}/login?error=oauthFailed`);
  }

  redirect(data.url);
}

export async function signOut(lang: Locale) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${lang}`);
}
