"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  signInSchema,
  signUpSchema,
  resetRequestSchema,
  newPasswordSchema,
} from "@/schemas/auth";
import { assertTurnstileSafeForProduction, isTurnstileConfigured } from "@/lib/turnstile";
import { resolveConfiguredSiteUrl } from "@/lib/site-url";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

type AuthErrorKey =
  | "invalidEmail"
  | "personalDomain"
  | "wrongDomain"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordNeedsLowercase"
  | "passwordNeedsUppercase"
  | "passwordNeedsSymbol"
  | "passwordMismatch"
  | "invalidCredentials"
  | "signUpFailed"
  | "resetFailed"
  | "updateFailed"
  | "sessionExpired"
  | "captchaFailed"
  | "oauthFailed";

export type SignInResult = { ok: true } | { ok: false; messageKey: AuthErrorKey };
export type SignUpResult = { ok: true } | { ok: false; messageKey: AuthErrorKey };
export type ResetRequestResult = { ok: true } | { ok: false; messageKey: AuthErrorKey };
export type UpdatePasswordResult = { ok: true } | { ok: false; messageKey: AuthErrorKey };

const FIELD_ERROR_KEYS = new Set<AuthErrorKey>([
  "invalidEmail",
  "personalDomain",
  "wrongDomain",
  "passwordRequired",
  "passwordTooShort",
  "passwordTooLong",
  "passwordNeedsLowercase",
  "passwordNeedsUppercase",
  "passwordNeedsSymbol",
  "passwordMismatch",
]);

function fieldErrorKey(rawKey: string | undefined, fallback: AuthErrorKey): AuthErrorKey {
  return rawKey && FIELD_ERROR_KEYS.has(rawKey as AuthErrorKey) ? (rawKey as AuthErrorKey) : fallback;
}

function getLang(formData: FormData): Locale {
  const rawLang = formData.get("lang");
  return typeof rawLang === "string" && isLocale(rawLang) ? rawLang : defaultLocale;
}

/** Both share the same Turnstile widget/token, so validated once per action. */
function readCaptchaToken(formData: FormData): string | null {
  const token = formData.get("cf-turnstile-response");
  return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * The `origin` request header is absent in some proxied/edge configurations.
 * Without a fallback, `${origin}/...` silently becomes the literal string
 * "null/th/auth/callback" and a signup/reset email's link goes nowhere —
 * indistinguishable from "email not sending" to the person who clicks it.
 * lib/site-url.ts's resolveConfiguredSiteUrl() is the explicit fallback
 * (NEXT_PUBLIC_SITE_URL, or Vercel's auto-injected production URL); if
 * neither is set, fall back to the request's own Host header rather than
 * emitting a known-broken URL.
 */
async function resolveOrigin(): Promise<string> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const siteUrl = resolveConfiguredSiteUrl();
  if (siteUrl) return siteUrl;

  const host = headerList.get("host");
  return host ? `https://${host}` : "";
}

async function redirectByRole(lang: Locale): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${lang}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(`/${lang}/${profile?.role === "pending" ? "pending" : "dashboard"}`);
}

/**
 * Bound directly to the login form's `action` attribute (useActionState),
 * so submission works with JavaScript disabled — a real POST, not a
 * client-invoked RPC. `lang` travels as a hidden field for the same reason.
 *
 * Re-validates server-side with the same schema the client form uses (never
 * trust client validation alone — §19, §30.5, and the §30.9 "submit with JS
 * disabled" check all require this).
 *
 * Every failure — unknown email, wrong password, unconfirmed account —
 * collapses into the single `invalidCredentials` key. Distinguishing them
 * would let an attacker enumerate registered @udontech.ac.th addresses.
 */
export async function signInWithPassword(
  _prevState: SignInResult | null,
  formData: FormData
): Promise<SignInResult> {
  assertTurnstileSafeForProduction();

  const lang = getLang(formData);

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: fieldErrorKey(rawKey, "invalidEmail") };
  }

  const captchaToken = readCaptchaToken(formData);
  if (isTurnstileConfigured && !captchaToken) {
    return { ok: false, messageKey: "captchaFailed" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error) {
    return { ok: false, messageKey: "invalidCredentials" };
  }

  return redirectByRole(lang);
}

/**
 * Same enumeration guard as signIn: the returned result never distinguishes
 * "email already registered" from "email successfully sent" — both produce
 * the same "check your email" panel client-side.
 */
export async function signUpWithPassword(
  _prevState: SignUpResult | null,
  formData: FormData
): Promise<SignUpResult> {
  assertTurnstileSafeForProduction();

  const lang = getLang(formData);

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: fieldErrorKey(rawKey, "invalidEmail") };
  }

  const captchaToken = readCaptchaToken(formData);
  if (isTurnstileConfigured && !captchaToken) {
    return { ok: false, messageKey: "captchaFailed" };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/${lang}/auth/callback`,
      ...(captchaToken ? { captchaToken } : {}),
    },
  });

  if (error) {
    // The user-facing response deliberately stays the generic signUpFailed
    // key (an enumeration guard — see the JSDoc above), but that collapses
    // "address already registered", "SMTP misconfigured", and "rate
    // limited" into one indistinguishable message. Logging the real code
    // server-side is what makes those distinguishable in Vercel logs
    // without weakening the client-facing guarantee.
    console.error("[signUpWithPassword]", error.code, error.message);
    return { ok: false, messageKey: "signUpFailed" };
  }

  return { ok: true };
}

/** Uniform response regardless of whether the address is registered — same enumeration guard. */
export async function requestPasswordReset(
  _prevState: ResetRequestResult | null,
  formData: FormData
): Promise<ResetRequestResult> {
  assertTurnstileSafeForProduction();

  const lang = getLang(formData);

  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: fieldErrorKey(rawKey, "invalidEmail") };
  }

  const captchaToken = readCaptchaToken(formData);
  if (isTurnstileConfigured && !captchaToken) {
    return { ok: false, messageKey: "captchaFailed" };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/${lang}/auth/reset`,
    ...(captchaToken ? { captchaToken } : {}),
  });

  // The user-facing response deliberately ignores this error (beyond a
  // malformed request already caught above) — surfacing "no such account"
  // would be the same enumeration leak the uniform success panel exists to
  // avoid. Logged server-side only, so an SMTP failure or rate limit is
  // still visible in Vercel logs instead of looking identical to a
  // successful send.
  if (error) {
    console.error("[requestPasswordReset]", error.code, error.message);
  }

  return { ok: true };
}

/**
 * Only reachable with the short-lived session app/[lang]/auth/reset/route.ts
 * established from the recovery link's code — updateUser() operates on the
 * caller's current session, not an email lookup, so there's no
 * "email not found" outcome to guard here.
 */
export async function updatePassword(
  _prevState: UpdatePasswordResult | null,
  formData: FormData
): Promise<UpdatePasswordResult> {
  const lang = getLang(formData);

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: fieldErrorKey(rawKey, "passwordTooShort") };
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

  return redirectByRole(lang);
}

/**
 * Google OAuth, restricted to the same @udontech.ac.th domain as password
 * sign-in. `hd` is a UI hint to Google's account picker only — it is NOT
 * enforcement and a user can bypass it by picking a different account than
 * the one it suggests. The actual boundary is profiles.email's CHECK
 * constraint (0001), which a non-college address fails at signup, plus the
 * explicit re-check in the callback route as defence in depth. Bound to the
 * login/signup form's `action` (not an onClick handler) so it still works —
 * as a real redirect-driving POST — with JavaScript disabled, same
 * reasoning as the password actions above.
 */
export async function signInWithGoogle(lang: Locale) {
  const origin = await resolveOrigin();
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
