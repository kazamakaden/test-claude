import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { toRole } from "@/types/auth";
import { createClient } from "@/lib/supabase/server";
import { signedInLandingTarget } from "@/lib/auth/require-role";
import { attendanceTokenSchema } from "@/schemas/attendance";
import { resolveConfiguredSiteUrl } from "@/lib/site-url";
import {
  exchangeCodeForIdToken,
  verifyGoogleIdToken,
  OAUTH_ATTEND_COOKIE,
  OAUTH_LANG_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from "@/lib/google-oauth";
import { isLocale, defaultLocale } from "@/lib/i18n/config";

/**
 * Where Google returns after consent, for this app's own OAuth flow.
 *
 * Supabase is handed only the finished, verified identity
 * (signInWithIdToken) — it still issues the session, so auth.uid() and every
 * RLS policy behave exactly as before. What changed is who ran the OAuth: our
 * client id, our secret, our callback, on our domain.
 *
 * The redirect target is never caller-supplied — the same property
 * /auth/callback has. It is one of /set-password or the signed-in landing
 * page (now `/`, via signedInLandingTarget), and
 * the locale comes from a cookie we set ourselves, not from a query param.
 */
function fail(request: NextRequest, lang: string, reason: string, errorKey = "oauthFailed") {
  console.error(`[google-oauth] ${reason}`);
  const response = NextResponse.redirect(new URL(`/${lang}/login?error=${errorKey}`, request.url));
  clearOAuthCookies(response);
  return response;
}

function clearOAuthCookies(response: NextResponse) {
  for (const name of [
    OAUTH_STATE_COOKIE,
    OAUTH_NONCE_COOKIE,
    OAUTH_VERIFIER_COOKIE,
    OAUTH_LANG_COOKIE,
    // Cleared with the rest: a leftover token would send the NEXT ordinary
    // sign-in to a stale scan instead of the homepage.
    OAUTH_ATTEND_COOKIE,
  ]) {
    response.cookies.delete(name);
  }
}

export async function GET(request: NextRequest) {
  const cookieLang = request.cookies.get(OAUTH_LANG_COOKIE)?.value ?? "";
  const lang = isLocale(cookieLang) ? cookieLang : defaultLocale;

  // Google reports consent failures (access_denied, etc.) here rather than
  // sending a code. Treat it as a plain cancellation, not an error worth
  // alarming the user about.
  const googleError = request.nextUrl.searchParams.get("error");
  if (googleError) {
    return fail(request, lang, `google returned ${googleError}`);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const nonce = request.cookies.get(OAUTH_NONCE_COOKIE)?.value ?? "";
  const codeVerifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value ?? "";

  if (!code || !expectedState || !nonce || !codeVerifier) {
    // Usually a stale or replayed callback: the cookies expired, or this URL
    // was opened directly.
    return fail(request, lang, "missing code or flow cookies");
  }

  // CSRF. Length-checked first because timingSafeEqual throws on a mismatch,
  // which would leak the expected length through the exception.
  const stateOk =
    state.length === expectedState.length &&
    crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
  if (!stateOk) {
    return fail(request, lang, "state mismatch");
  }

  const origin = resolveConfiguredSiteUrl() ?? request.nextUrl.origin;
  const idToken = await exchangeCodeForIdToken({ code, codeVerifier, origin });
  if (!idToken) {
    return fail(request, lang, "code exchange returned no id_token");
  }

  // Signature, issuer, audience, expiry, our nonce, email_verified and the
  // @udontech.ac.th rule — all enforced here, before Supabase sees anything.
  const identity = await verifyGoogleIdToken(idToken, nonce);
  if (!identity) {
    // The domain rule is the most likely reason a real person lands here, so
    // it gets the friendly message signIn already uses rather than a generic
    // failure. verifyGoogleIdToken deliberately does not say which check
    // failed, so this cannot distinguish "wrong domain" from "bad token" —
    // and the wrong-domain wording is the more useful of the two.
    return fail(request, lang, "id_token rejected", "wrongDomain");
  }

  // Supabase verifies the token independently against Google's keys and its
  // own Authorized Client IDs, then issues the session. The nonce is
  // deliberately NOT passed on: it has already been checked above against the
  // value this app generated, and the provider-specific hashed-vs-raw nonce
  // conventions differ enough that passing it adds a failure mode without
  // adding a check.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error || !data.user) {
    return fail(request, lang, `signInWithIdToken failed: ${error?.message ?? "no user"}`);
  }

  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, password_set")
    .eq("id", user.id)
    .single();

  // handle_new_user() only copies Google's name/photo at signup INSERT time,
  // so an account created another way never gets one. Re-sync on every Google
  // sign-in, under the user's own session (profiles_update_own already permits
  // these two columns). Best-effort — a failure must not block sign-in.
  if (identity.fullName || identity.avatarUrl?.startsWith("https://")) {
    await supabase
      .from("profiles")
      .update({
        ...(identity.fullName ? { full_name: identity.fullName.slice(0, 100) } : {}),
        ...(identity.avatarUrl?.startsWith("https://") ? { avatar_url: identity.avatarUrl } : {}),
      })
      .eq("id", user.id);
  }

  // A QR token the student scanned before signing in, stashed by the start
  // route. The path is BUILT here from a regex-validated token
  // (^[a-z0-9]{10}\.[0-9a-f]{8}$ -- no slash, colon or second dot), never taken
  // from the request as a URL, so this keeps the "redirect target is never
  // caller-supplied" property the rest of this route relies on.
  //
  // set-password still wins: an account that has not finished onboarding must
  // not be routed past it, and the scan can be repeated afterwards.
  const attend = attendanceTokenSchema.safeParse(
    request.cookies.get(OAUTH_ATTEND_COOKIE)?.value ?? ""
  );

  const target =
    profile && !profile.password_set
      ? `/${lang}/set-password`
      : attend.success
        ? `/${lang}/attend/${attend.data}`
        : signedInLandingTarget(toRole(profile?.role), lang);

  const response = NextResponse.redirect(new URL(target, request.url));
  clearOAuthCookies(response);
  return response;
}
