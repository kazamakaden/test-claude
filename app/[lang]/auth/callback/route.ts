import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocale, defaultLocale } from "@/lib/i18n/config";

/**
 * Magic-link landing point. The redirect target is fixed at /dashboard —
 * never reflects a caller-supplied `next` param (that would be an open
 * redirect).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : defaultLocale;

  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(`/${lang}/dashboard`, request.url));
    }
  }

  return NextResponse.redirect(new URL(`/${lang}/login?error=auth`, request.url));
}
