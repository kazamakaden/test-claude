import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { importLatestFacebookBanner, isFacebookImportConfigured } from "@/services/facebook-banner";

/**
 * Daily Facebook banner import, called by Vercel Cron (see vercel.json).
 *
 * GET because that is what Vercel Cron issues. Not idempotent in the strict
 * sense — it can create a row — but it is deduped on facebook_post_id, so a
 * retried or double-fired run is a no-op rather than a second copy.
 *
 * Node runtime: the import streams an image through node:crypto for its path
 * uuid and uses the service-role Supabase client.
 */
export const runtime = "nodejs";
// Never cached: a cached 200 would mean the poll silently stops running.
export const dynamic = "force-dynamic";

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is
 * set on the project. Using the platform's own convention rather than inventing
 * a header keeps this to ONE secret with no custom wiring — and the same bearer
 * works for a manual curl when someone wants to trigger an import by hand.
 *
 * Timing-safe, and hashed first so the compare is length-independent — same
 * shape as lib/push-server.ts#isValidDispatchSecret.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !presented) return false;
  const a = crypto.createHash("sha256").update(presented).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  // Authenticate before anything else. This endpoint makes the server fetch a
  // remote image and store it, so an unauthenticated caller must not even learn
  // whether the import is configured.
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isFacebookImportConfigured) {
    // 200, not 500: a scheduler that gets a 5xx retries forever against a box
    // that can never succeed. Same reasoning as /api/push/dispatch.
    return NextResponse.json({ skipped: "not_configured" });
  }

  const result = await importLatestFacebookBanner();

  // A failed import is reported as 200 with a reason for the same reason: the
  // usual cause is an expired Page token, which retrying cannot fix. The server
  // log carries the detail; this body is what a human sees in the cron history.
  return NextResponse.json(result);
}
