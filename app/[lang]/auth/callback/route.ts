import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedInLandingTarget } from "@/lib/auth/require-role";
import { isLocale, defaultLocale } from "@/lib/i18n/config";

/**
 * Google OAuth landing point (password recovery has its own route,
 * app/[lang]/auth/reset/route.ts, since a recovery code must land on
 * /reset-password rather than here). The redirect target is fixed at
 * /set-password, /dashboard, or /pending — never reflects a caller-supplied
 * `next` param (that would be an open redirect).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : defaultLocale;

  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createClient();

  // Supabase's PKCE `code` is one-time-use — a second exchange attempt for
  // the same code fails with flow_state_already_used. That second attempt
  // is a real, observed occurrence here (not hypothetical): a slow network
  // or an intermediary retrying a slow GET can deliver this exact request
  // twice, and the FIRST attempt already set a valid session cookie by the
  // time the retry lands. Checking for an existing session before ever
  // touching `code` makes the retry a no-op success instead of a visible
  // error — if this request already carries a valid session, there is
  // nothing left to exchange.
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  let user = existingUser;

  if (!user && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user: exchangedUser },
      } = await supabase.auth.getUser();
      user = exchangedUser;
    }
  }

  if (!user) {
    return NextResponse.redirect(new URL(`/${lang}/login?error=auth`, request.url));
  }

  // Defence in depth for the Google OAuth path specifically. The real
  // enforcement is profiles.email's CHECK constraint (0001) —
  // handle_new_user() inserting a non-college address fails it, which
  // rolls back the whole auth.users row the trigger fired from, so this
  // should already be unreachable for a brand-new Google signup. This
  // check exists for the case that constraint doesn't cover: an existing
  // session somehow carrying a non-college email (Google account email
  // changed after linking, a future auth path that doesn't route through
  // handle_new_user, etc.) — sign it out rather than trust it, and surface
  // the same friendly message signIn already uses instead of a raw
  // Postgres error.
  if (!user.email?.endsWith("@udontech.ac.th")) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(`/${lang}/login?error=wrongDomain`, request.url));
  }

  // Every fresh signup lands 'pending' (0020) — route them to the waiting
  // page instead of a dashboard requirePermission() would just bounce
  // them out of anyway.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, password_set")
    .eq("id", user.id)
    .single();

  // 0023's handle_new_user() only copies Google's name/photo at signup
  // INSERT time — an account that signed up with a password and linked
  // Google later never gets one. Re-sync on every Google sign-in instead,
  // under the user's own session (profiles_update_own already permits
  // full_name/avatar_url, see 0025's header). Best-effort: a failure here
  // shouldn't block sign-in.
  const fromGoogle = user.app_metadata.providers?.includes("google") ?? false;
  if (fromGoogle) {
    const googleName = user.user_metadata.full_name ?? user.user_metadata.name ?? null;
    const googleAvatar = user.user_metadata.avatar_url ?? user.user_metadata.picture ?? null;
    if (googleName || (googleAvatar && googleAvatar.startsWith("https://"))) {
      await supabase
        .from("profiles")
        .update({
          ...(googleName ? { full_name: String(googleName).slice(0, 100) } : {}),
          ...(googleAvatar && googleAvatar.startsWith("https://") ? { avatar_url: googleAvatar } : {}),
        })
        .eq("id", user.id);
    }
  }

  // Google OAuth is the only sign-in path now, and Supabase never emails a
  // Google user (the identity is already verified) — so a brand-new
  // account has no password at all until it goes through the set-password
  // flow below. Checked ahead of the normal dashboard/pending landing,
  // since an account can't meaningfully use the app's password-based
  // recovery path without one yet.
  if (profile && !profile.password_set) {
    return NextResponse.redirect(new URL(`/${lang}/set-password`, request.url));
  }

  const target = signedInLandingTarget(profile?.role ?? "guest", lang);
  return NextResponse.redirect(new URL(target, request.url));
}
