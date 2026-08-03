import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocale, defaultLocale } from "@/lib/i18n/config";

/**
 * Password-recovery landing point. Separate from app/[lang]/auth/callback,
 * on purpose: exchanging a recovery code must land on /reset-password, not
 * /dashboard, and keeping this as its own route (rather than a `?next=` on
 * the shared callback) preserves that route's "redirect target is never
 * caller-supplied" property untouched. The redirect target here is also
 * fixed — always /reset-password, never reflecting a param.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : defaultLocale;

  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(`/${lang}/reset-password`, request.url));
    }
  }

  return NextResponse.redirect(new URL(`/${lang}/login?error=auth`, request.url));
}
