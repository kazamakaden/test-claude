import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function getLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isLocale(cookieLocale)) return cookieLocale;
  return defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  let response: NextResponse;

  if (pathnameHasLocale) {
    response = NextResponse.next();
  } else {
    const locale = getLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.redirect(url);
  }

  // Session refresh only — authorization stays server-side in the page via
  // requirePermission() (§30.5). The 12-hour hard session cap is the one
  // exception: updateSession() itself decides expiry (server-verified
  // last_sign_in_at), middleware only acts on its verdict.
  if (isSupabaseConfigured) {
    // Prefer the locale actually in the URL over the cookie, so the
    // sessionTimedOut redirect lands in the same locale the viewer was on.
    const pathLocale = pathname.split("/")[1];
    const locale = pathnameHasLocale && isLocale(pathLocale) ? pathLocale : getLocale(request);
    const loginPath = `/${locale}/login`;
    const { response: refreshed, sessionExpired } = await updateSession(request, response);

    if (sessionExpired && !pathname.startsWith(loginPath)) {
      const url = request.nextUrl.clone();
      url.pathname = loginPath;
      url.search = "?error=sessionTimedOut";
      const redirectResponse = NextResponse.redirect(url);
      // Carries the sign-out cookie deletions from updateSession() onto the
      // redirect response — dropping this would leave the expired session
      // cookie in place and loop forever, the same trap updateSession's own
      // doc comment already warns about for its own caller.
      refreshed.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }

    return refreshed;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
