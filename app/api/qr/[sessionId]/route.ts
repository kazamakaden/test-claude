import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { getCurrentQrToken } from "@/services/attendance";
import { attendUrl, qrGeometry } from "@/lib/qr";
import { resolveConfiguredSiteUrl } from "@/lib/site-url";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

/**
 * The rotating token for a live QR display, polled by the staff page.
 *
 * A route handler rather than a Server Action because this is a plain read on a
 * timer: an action would mean a POST and a router refresh every rotation.
 *
 * Authorised twice over. `activity:manage` is checked here so an unauthorised
 * caller gets a clean 403 and learns nothing, and current_qr_token() (0056)
 * checks the same thing again for itself — it is SECURITY DEFINER, so it
 * cannot assume this handler ran. Note this endpoint sits under /api, which
 * middleware.ts deliberately excludes from its matcher, so there is no session
 * refresh in front of it; getRole() reads the session directly and fails closed
 * to "guest".
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const role = await getRole();
  if (!can(role, "activity:manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { sessionId } = await params;
  const token = await getCurrentQrToken(sessionId);

  // Null covers expired, revoked, unknown, and "not allowed" alike. Not
  // distinguished on purpose: the page's only correct response to any of them
  // is to stop displaying a code.
  if (!token) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }

  // Encode the same absolute URL the first render does, NOT the bare token.
  // This endpoint used to encode `token.token`, so the code worked when the
  // page loaded and degraded to un-openable text on the first rotation --
  // which is most scans. attendUrl() is now the single builder for both.
  //
  // `lang` is read from the query and validated against the locale list before
  // it goes anywhere near a URL; an unknown value falls back rather than being
  // interpolated. The caller is already proven to hold activity:manage above,
  // but a permitted caller is still not a reason to trust a raw query string.
  const requested = new URL(request.url).searchParams.get("lang");
  const lang = requested && isLocale(requested) ? requested : defaultLocale;
  const geometry = qrGeometry(attendUrl(resolveConfiguredSiteUrl() ?? "", lang, token.token));

  return NextResponse.json(
    { size: geometry.size, path: geometry.path, expiresInSeconds: token.expiresInSeconds },
    // A cached rotating token is a token that outlives its rotation.
    { headers: { "Cache-Control": "no-store" } }
  );
}
