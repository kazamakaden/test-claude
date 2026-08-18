"use server";

import { redirect } from "next/navigation";
import { toRole } from "@/types/auth";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { sendMail } from "@/lib/mailer";
import { buildPasswordLinkEmail } from "@/lib/emails/password-link";
import { HANDOFF_COOKIE_NAME, isWellFormedToken } from "@/lib/password-tokens";
import {
  applyNewPassword,
  consumeToken,
  findUserIdByEmail,
  mintToken,
} from "@/services/password-setup";
import { signInSchema, resetRequestSchema, newPasswordSchema } from "@/schemas/auth";
import { assertTurnstileSafeForProduction, isTurnstileConfigured } from "@/lib/turnstile";
import { resolveConfiguredSiteUrl } from "@/lib/site-url";
import { signedInLandingTarget } from "@/lib/auth/require-role";
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
  | "resetFailed"
  | "updateFailed"
  | "sessionExpired"
  | "captchaFailed"
  | "oauthFailed";

export type SignInResult = { ok: true } | { ok: false; messageKey: AuthErrorKey };
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

/**
 * The origin an EMAILED link is built from — deliberately NOT resolveOrigin().
 *
 * resolveOrigin() is header-first, which is right for an OAuth redirect (the
 * user is standing in front of the browser that sent the header) and wrong
 * for a link we put in an inbox: the Origin/Host header is caller-supplied,
 * so a poisoned one would mail a real college address a link pointing at an
 * attacker's host, with a token that is valid for their account. Configured
 * value only.
 *
 * The development fallback exists so `npm run dev` works with no
 * NEXT_PUBLIC_SITE_URL set; in any other environment an unconfigured site
 * URL means no link is sent at all, which fails closed and says so in the
 * log rather than emailing something unusable.
 */
async function resolveEmailLinkOrigin(): Promise<string | null> {
  const configured = resolveConfiguredSiteUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV === "development") {
    const origin = await resolveOrigin();
    return origin || null;
  }
  return null;
}

/**
 * Bound directly to the login form's password-disclosure `action`
 * attribute (useActionState), so submission works with JavaScript disabled
 * — a real POST, not a client-invoked RPC. `lang` travels as a hidden
 * field for the same reason.
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error || !data.user) {
    return { ok: false, messageKey: "invalidCredentials" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(signedInLandingTarget(toRole(profile?.role), lang));
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

  // Turnstile still guards this endpoint even though Supabase's mailer is no
  // longer involved — an unprotected "email this address" endpoint is a way
  // to make the server mail college addresses on demand. The token is only
  // checked for presence here, exactly as before; Cloudflare's server-side
  // siteverify is the project-level setting, not this action's job.
  if (isTurnstileConfigured && !readCaptchaToken(formData)) {
    return { ok: false, messageKey: "captchaFailed" };
  }

  // Everything below is best-effort and MUST NOT change the response.
  // `{ ok: true }` is returned whether the address is registered, throttled,
  // or the mail server refused us — that uniformity is the entire
  // account-enumeration guard, and a "too many requests" or "no such
  // account" message would hand back precisely what it hides. Failures are
  // logged instead, so a wrong App Password is visible in the server log
  // rather than indistinguishable from a successful send.
  const origin = await resolveEmailLinkOrigin();
  if (!origin) {
    console.error(
      "[requestPasswordReset] no site URL configured — set NEXT_PUBLIC_SITE_URL; link not sent."
    );
    return { ok: true };
  }

  const userId = await findUserIdByEmail(parsed.data.email);
  if (!userId) return { ok: true };

  const minted = await mintToken(userId);
  if (minted.status !== "ok") return { ok: true };

  const dict = await getDictionary(lang);
  const link = `${origin}/${lang}/auth/set-password?token=${encodeURIComponent(minted.token)}`;

  await sendMail(buildPasswordLinkEmail({ to: parsed.data.email, link, dict }));

  return { ok: true };
}

/**
 * Spends the emailed link and sets the password. THE POST, not the GET, is
 * what consumes the token — see app/[lang]/auth/set-password/route.ts for
 * why (email scanners follow links).
 *
 * The caller is NOT signed in — that is the whole point of a password
 * reset — so this cannot go through the caller's own session the way it did
 * when Supabase issued a recovery session. It goes through the service-role
 * client instead, which is the first unauthenticated path to that key in
 * this codebase. What authorises it is the token, and nothing else:
 *
 *   1. a raw token arrived in an httpOnly cookie this app set itself,
 *   2. it hashed to a row that was unused and unexpired,
 *   3. that row was spent by ONE atomic UPDATE, which returned its user_id,
 *   4. the new password passed newPasswordSchema.
 *
 * The account acted on is step 3's returned user_id. No form field, cookie
 * or query parameter anywhere in this action names a user.
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

  // The password is validated FIRST, before the token is spent, so a typo'd
  // confirmation costs a retry rather than the whole link.
  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: fieldErrorKey(rawKey, "passwordTooShort") };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(HANDOFF_COOKIE_NAME)?.value;

  if (!isWellFormedToken(token)) {
    return { ok: false, messageKey: "sessionExpired" };
  }

  const userId = await consumeToken(token);
  if (!userId) {
    return { ok: false, messageKey: "sessionExpired" };
  }

  // Past this point the token is spent even if the update fails, so a retry
  // needs a fresh link. That is the right way round: the alternative —
  // reviving a token after a failed write — is a token that can be used more
  // than once, and this failure (the admin API rejecting a password that
  // already passed newPasswordSchema) is rare enough not to trade single-use
  // away for.
  const result = await applyNewPassword(userId, parsed.data.password);
  if (!result.ok) {
    return { ok: false, messageKey: "updateFailed" };
  }

  // The token is spent either way now, so the cookie is dead weight — and a
  // dead credential left in a browser is worth clearing rather than waiting
  // out its 15 minutes.
  cookieStore.delete(HANDOFF_COOKIE_NAME);

  // Land on /login rather than straight into the app: this action
  // establishes no session (there is no session to establish — the whole
  // flow ran unauthenticated), so the password has to be used once to get
  // in, which also confirms to the user that it works.
  redirect(`/${lang}/login?notice=${result.firstTime ? "signupComplete" : "passwordUpdated"}`);
}

/**
 * The single sign-in/sign-up entry point — restricted to @udontech.ac.th.
 * `hd` is a UI hint to Google's account picker only — it is NOT enforcement
 * and a user can bypass it by picking a different account than the one it
 * suggests. The actual boundary is profiles.email's CHECK constraint
 * (0001), which a non-college address fails at signup, plus the explicit
 * re-check in the callback route as defence in depth. Bound to the login
 * form's `action` (not an onClick handler) so it still works — as a real
 * redirect-driving POST — with JavaScript disabled.
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

/**
 * Task 3: fixes sign-out not visibly working. Bound via `signOut.bind(null,
 * lang)` to a real `<form action={...}>` in both user-menu.tsx and
 * mobile-nav.tsx — not an `onClick={() => void signOut(lang)}` handler like
 * before, which fired the redirect outside any transition/form-action
 * context and could get its rejection silently swallowed by the bare
 * `void`. A real form action also gives the no-JS guarantee sign-IN already
 * has (§30.9) and a genuine useFormStatus pending state.
 *
 * `revalidatePath("/", "layout")` before the redirect is the actual fix for
 * the reported symptom: without it, Next's client Router Cache can keep
 * serving an RSC payload rendered while signed in, so the nav still shows
 * the avatar menu after "signing out" even though the session cookie really
 * is gone — indistinguishable from "logout doesn't work" to the user.
 *
 * The signOut() call itself is wrapped in try/catch: a GoTrue network
 * hiccup must not strand the user signed-in-looking. The cookie deletions
 * @supabase/ssr's adapter performs are what actually end the session
 * locally; redirect() must stay OUTSIDE the try/catch since NEXT_REDIRECT
 * is a Next.js control-flow signal, not an error (the same lesson already
 * documented in services/dashboard.ts for requirePermission's redirect()).
 */
export async function signOut(lang: Locale, formData?: FormData) {
  void formData; // present only so this satisfies a <form action> signature when bound
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[signOut]", error);
  }
  revalidatePath("/", "layout");
  redirect(`/${lang}`);
}
