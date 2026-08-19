import "server-only";
import crypto from "node:crypto";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { SITE_BANNER_BUCKET } from "@/services/site-banners";

const GRAPH_VERSION = "v21.0";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

// Must stay a subset of the bucket's own allowed_mime_types (0065). The bucket
// is the boundary; this is what turns a rejected upload into a clear log line.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Unset means "no Facebook banner", which is real graceful degradation — the
 * uploaded banners keep working and the homepage never notices. That is why
 * these two are deliberately NOT in lib/env-guard.ts, unlike SMTP or Turnstile,
 * where a missing value locks the front door. Same argument that file already
 * makes for the VAPID keys.
 */
export const isFacebookImportConfigured = Boolean(
  process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN
);

export type FacebookImportResult =
  | { ok: true; outcome: "imported"; postId: string }
  | { ok: true; outcome: "already_imported"; postId: string }
  | { ok: true; outcome: "no_posts" }
  | { ok: false; reason: string };

type GraphPhoto = {
  id?: string;
  images?: { source?: string; width?: number; height?: number }[];
};

/**
 * Copies the Page's newest photo into our own Storage as a DRAFT.
 *
 * COPIED, not hotlinked, and that is the point of the whole design: a Page
 * access token expires (~60 days for a long-lived one) and Facebook's CDN URLs
 * are signed and short-lived, so a homepage that linked straight to them would
 * go blank on its own schedule. Once the bytes are in our bucket the banner
 * survives the token, the post being deleted, and Facebook rate limits alike.
 *
 * ALWAYS A DRAFT. A post carries no academic year and no เทอม, so it cannot
 * satisfy site_banners_published_needs_term (0065) — an admin describes it and
 * publishes. That review step is also the only thing standing between the
 * college homepage and whatever was posted last, which is worth the manual step.
 *
 * Service-role client throughout: there is no user session on a cron run, and
 * `source` / `facebook_post_id` are granted to nobody, so this is the only
 * caller that can write a row claiming a Facebook origin.
 */
export async function importLatestFacebookBanner(): Promise<FacebookImportResult> {
  if (!isFacebookImportConfigured) return { ok: false, reason: "not_configured" };
  if (!isSupabaseAdminConfigured) return { ok: false, reason: "supabase_not_configured" };

  const pageId = process.env.FACEBOOK_PAGE_ID!;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;

  // type=uploaded, not tagged: photos the Page itself posted, not ones it was
  // tagged in — the latter is other people's content on our homepage.
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/photos` +
    `?type=uploaded&fields=id,images&limit=1&access_token=${encodeURIComponent(token)}`;

  let photo: GraphPhoto | undefined;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      // The token expiring is the expected failure, and it is silent unless it
      // says so here — docs/facebook-banner.md points at this exact line.
      const body = await response.text();
      console.error(`[facebook-banner] graph ${response.status}: ${body.slice(0, 500)}`);
      return { ok: false, reason: `graph_${response.status}` };
    }
    const json = (await response.json()) as { data?: GraphPhoto[] };
    photo = json.data?.[0];
  } catch (error) {
    console.error("[facebook-banner] graph request failed", error);
    return { ok: false, reason: "graph_unreachable" };
  }

  if (!photo?.id) return { ok: true, outcome: "no_posts" };
  const postId = photo.id;

  // Widest variant: Graph returns the same photo at several sizes, largest
  // first in practice but not by contract, so it is picked rather than assumed.
  const best = (photo.images ?? [])
    .filter((i) => typeof i.source === "string")
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  if (!best?.source) return { ok: false, reason: "no_image_url" };

  const supabase = createAdminClient();

  // Dedupe BEFORE downloading: a daily poll on an unchanged Page must not
  // re-fetch several MB every morning, and must never accumulate a copy a day.
  const { data: existing, error: existingError } = await supabase
    .from("site_banners")
    .select("id")
    .eq("facebook_post_id", postId)
    .maybeSingle();

  if (existingError) {
    console.error("[facebook-banner] dedupe lookup failed", existingError);
    return { ok: false, reason: "dedupe_lookup_failed" };
  }
  if (existing) return { ok: true, outcome: "already_imported", postId };

  let bytes: ArrayBuffer;
  let contentType: string;
  try {
    const response = await fetch(best.source, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: `image_${response.status}` };

    contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!ALLOWED_TYPES.includes(contentType)) {
      return { ok: false, reason: `unsupported_type_${contentType || "unknown"}` };
    }

    bytes = await response.arrayBuffer();
  } catch (error) {
    console.error("[facebook-banner] image download failed", error);
    return { ok: false, reason: "image_unreachable" };
  }

  // Checked here as well as by the bucket's own file_size_limit: Content-Length
  // is absent or wrong often enough that the byte count after the read is the
  // only number worth trusting, and refusing early is cheaper than a rejected
  // upload.
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "image_too_large" };
  }

  const path = `${crypto.randomUUID()}.${EXTENSION_BY_TYPE[contentType]}`;
  const { error: uploadError } = await supabase.storage
    .from(SITE_BANNER_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });

  if (uploadError) {
    console.error("[facebook-banner] storage upload failed", uploadError);
    return { ok: false, reason: "upload_failed" };
  }

  const { error: insertError } = await supabase.from("site_banners").insert({
    storage_path: path,
    source: "facebook",
    facebook_post_id: postId,
    // created_by stays null: a cron run has no author, and the column is
    // nullable precisely so this does not have to invent one.
  });

  if (insertError) {
    // Roll the object back rather than leave an orphan in a public bucket.
    await supabase.storage.from(SITE_BANNER_BUCKET).remove([path]);
    console.error("[facebook-banner] insert failed", insertError);
    return { ok: false, reason: "insert_failed" };
  }

  return { ok: true, outcome: "imported", postId };
}

