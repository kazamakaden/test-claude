import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { getCurrentQrToken } from "@/services/attendance";
import { qrGeometry } from "@/lib/qr";

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
  _request: Request,
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

  const geometry = qrGeometry(token.token);

  return NextResponse.json(
    { size: geometry.size, path: geometry.path, expiresInSeconds: token.expiresInSeconds },
    // A cached rotating token is a token that outlives its rotation.
    { headers: { "Cache-Control": "no-store" } }
  );
}
