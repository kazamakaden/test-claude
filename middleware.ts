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
  /**
   * Everything except Next internals, route handlers, and static files.
   *
   * The file exclusion is anchored to a real extension at the END of the path
   * (`\\.(?:png|...)$`) rather than the usual "contains a dot anywhere"
   * (`.*\\..*`), and that is load-bearing, not tidiness. A §13 check-in URL is
   * `/{lang}/attend/<10-char slug>.<8 hex>` — schemas/attendance.ts — so the
   * unanchored form matched EVERY QR scan and skipped middleware on it.
   *
   * That mattered because lib/supabase/server.ts cannot write cookies from a
   * Server Component ("middleware.ts owns session refresh", in its own words).
   * With middleware skipped, a student whose access token had expired rotated a
   * refresh token that was never persisted, so the next request replayed a
   * consumed one and they read as signed out — on the exact page a scan lands
   * on. The 12-hour session cap was skipped there too.
   *
   * Add an extension here rather than reaching for `.*\\..*` if a new static
   * asset type ever needs excluding.
   */
  matcher: [
    "/((?!_next|api|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|mjs|map|txt|xml|json|pdf|woff|woff2|ttf|eot)$).*)",
  ],
};
