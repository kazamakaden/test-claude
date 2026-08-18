import { NextResponse, type NextRequest } from "next/server";
import { isWellFormedToken, HANDOFF_COOKIE_MAX_AGE_S, HANDOFF_COOKIE_NAME } from "@/lib/password-tokens";
import { peekToken } from "@/services/password-setup";
import { isLocale, defaultLocale } from "@/lib/i18n/config";

/**
 * Landing point for the link this app emails itself (0064) — the replacement
 * for Supabase's recovery `code`, whose route (app/[lang]/auth/reset) this
 * supersedes.
 *
 * THIS HANDLER DOES NOT CONSUME THE TOKEN, and that is the single most
 * important thing about it.
 *
 * Gmail, Outlook and corporate antivirus all fetch links in mail before a
 * human sees them. A token spent by that fetch is dead by the time the
 * recipient clicks — intermittently, depending on whose mail server saw it
 * first, which is the worst possible failure to diagnose. So the GET only
 * *validates*; setting the password (the POST in actions/auth.ts) is what
 * spends it. Single-use is intact: "use" means setting a password.
 *
 * THE COOKIE CARRIES THE RAW TOKEN, NOT THE ROW ID. Handing the row's id to
 * the browser instead would turn a database primary key into a bearer
 * credential — anyone who could guess one could set that account's password.
 * The token is 256 bits of randomness minted for exactly this purpose; the
 * id is not a secret and was never designed to be one.
 *
 * Moving it out of the URL and into an httpOnly cookie also gets the secret
 * out of the address bar before the password screen renders, so it cannot
 * leak through a Referer header, a shared screenshot or browser history.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : defaultLocale;

  const token = request.nextUrl.searchParams.get("token");

  // Shape-checked before the database is touched at all, so a garbage or
  // oversized query param never becomes a query.
  if (!isWellFormedToken(token) || !(await peekToken(token))) {
    return NextResponse.redirect(new URL(`/${lang}/login?error=sessionExpired`, request.url));
  }

  const response = NextResponse.redirect(new URL(`/${lang}/reset-password`, request.url));

  response.cookies.set(HANDOFF_COOKIE_NAME, token, {
    httpOnly: true,
    // Off only on plain-HTTP localhost; every deployed environment is HTTPS.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: HANDOFF_COOKIE_MAX_AGE_S,
    // Site-wide rather than scoped to /{lang}/reset-password, deliberately.
    // The narrow path is tempting and wrong: the header's language toggle
    // rewrites the locale segment, and a cookie scoped to /th/reset-password
    // silently vanishes on a switch to /en/reset-password — the flow would
    // break for a reason no user could ever guess. The cost of the wider
    // path is that an httpOnly, lax, 15-minute cookie rides along on
    // same-site requests to our own origin, which is not a meaningful
    // exposure; the token is single-use and unreadable from JavaScript.
    path: "/",
  });

  return response;
}
