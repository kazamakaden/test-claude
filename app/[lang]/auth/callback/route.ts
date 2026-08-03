import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocale, defaultLocale } from "@/lib/i18n/config";

/**
 * Magic-link and Google OAuth landing point. The redirect target is fixed
 * at /dashboard or /pending — never reflects a caller-supplied `next`
 * param (that would be an open redirect).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : defaultLocale;

  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Defence in depth for the Google OAuth path specifically. The real
      // enforcement is profiles.email's CHECK constraint (0001) —
      // handle_new_user() inserting a non-college address fails it, which
      // rolls back the whole auth.users row the trigger fired from, so this
      // should already be unreachable for a brand-new Google signup. This
      // check exists for the case that constraint doesn't cover: an
      // existing session somehow carrying a non-college email (Google
      // account email changed after linking, a future auth path that
      // doesn't route through handle_new_user, etc.) — sign it out rather
      // than trust it, and surface the same friendly message signIn already
      // uses instead of a raw Postgres error.
      if (user && !user.email?.endsWith("@udontech.ac.th")) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL(`/${lang}/login?error=wrongDomain`, request.url));
      }

      // Every fresh signup lands 'pending' (0020) — route them to the
      // waiting page instead of a dashboard requirePermission() would just
      // bounce them out of anyway.
      const { data: profile } = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).single()
        : { data: null };

      const target = profile?.role === "pending" ? "pending" : "dashboard";
      return NextResponse.redirect(new URL(`/${lang}/${target}`, request.url));
    }
  }

  return NextResponse.redirect(new URL(`/${lang}/login?error=auth`, request.url));
}
