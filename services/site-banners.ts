import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import type { DeleteBannerGroupInput } from "@/schemas/site-banners";
import type { SiteBanner, SiteBannerGroup } from "@/types/site-banners";

export const SITE_BANNER_BUCKET = "site-banners";

const BANNER_COLUMNS =
  "id, storage_path, status, academic_year, term, source, created_at";

type BannerRow = {
  id: string;
  storage_path: string;
  status: string;
  academic_year: number | null;
  term: number | null;
  source: string;
  created_at: string;
};

/**
 * Storage URL for a banner. getPublicUrl is a pure string build, not a network
 * call — the bucket is public (0065) — so a page of banners costs zero round
 * trips, unlike services/books.ts which must sign every private object.
 */
function toBanner(
  supabase: NonNullable<Awaited<ReturnType<typeof tryCreateClient>>>,
  row: BannerRow
): SiteBanner {
  return {
    id: row.id,
    storagePath: row.storage_path,
    url: supabase.storage.from(SITE_BANNER_BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
    status: row.status === "published" ? "published" : "draft",
    academicYear: row.academic_year,
    term: row.term,
    source: row.source === "facebook" ? "facebook" : "upload",
    createdAt: row.created_at,
  };
}

// Newest first: latest academic year, then latest เทอม, then most recently
// added. Matches site_banners_published_idx exactly, so paging is an index scan
// rather than a sort. Repeated in both readers below rather than extracted --
// postgrest-js builds its row type through the chain, and a generic wrapper
// collapses it to GenericStringError.
/**
 * The homepage carousel. Explicitly filtered to published even though
 * site_banners_select_published (0065) already scopes anon that way: a signed-in
 * STAFF viewer also holds site_banners_select_staff, and permissive policies OR
 * together, so RLS alone would put their unreviewed drafts on the public
 * homepage. Same lesson 0038's list_notifications records for admins.
 *
 * Fail-soft to [] on any problem, like every other list service here.
 */
export async function listPublishedBanners(): Promise<SiteBanner[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("site_banners")
    .select(BANNER_COLUMNS)
    .eq("status", "published")
    .order("academic_year", { ascending: false, nullsFirst: false })
    .order("term", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => toBanner(supabase, row));
}

/**
 * Everything the caller may see, drafts included. No status filter here on
 * purpose — RLS is the scope, so a non-staff caller gets exactly the published
 * rows and staff get the drafts too, with no second copy of the rule in TS.
 */
export async function listManageableBanners(): Promise<SiteBanner[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("site_banners")
    .select(BANNER_COLUMNS)
    .order("academic_year", { ascending: false, nullsFirst: false })
    .order("term", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => toBanner(supabase, row));
}

/** The year + เทอม pairs that actually have published banners, for the delete picker. */
export function groupBanners(banners: SiteBanner[]): SiteBannerGroup[] {
  const groups = new Map<string, SiteBannerGroup>();
  for (const b of banners) {
    if (b.academicYear === null || b.term === null) continue;
    const key = `${b.academicYear}-${b.term}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { academicYear: b.academicYear, term: b.term, count: 1 });
  }
  return [...groups.values()].sort(
    (a, b) => b.academicYear - a.academicYear || b.term - a.term
  );
}

type WriteResult = { ok: true } | { ok: false; error: "forbidden" | "unknown" };

/** A missing grant and an RLS refusal both raise 42501, and both mean the same thing here. */
function classify(code: string | undefined): "forbidden" | "unknown" {
  return code === "42501" || code === "PGRST301" ? "forbidden" : "unknown";
}

/**
 * Records an object the browser already uploaded. Always a DRAFT: an image with
 * no year and no เทอม cannot satisfy site_banners_published_needs_term, and that
 * is deliberate — describing it is the review step.
 *
 * createClient(), not tryCreateClient(): a write with no real client should throw.
 */
export async function createBannerDraft(
  storagePath: string,
  userId: string
): Promise<WriteResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("site_banners")
    .insert({ storage_path: storagePath, created_by: userId });

  if (error) return { ok: false, error: classify(error.code) };
  return { ok: true };
}

/**
 * The review step: describe a draft and publish it in one statement, because
 * the CHECK constraint refuses any state where those come apart.
 *
 * `.select()` is load-bearing. RLS FILTERS an UPDATE rather than raising, so a
 * refused statement returns success affecting zero rows — reading the row back
 * is the only way to tell "published" from "silently did nothing".
 */
export async function publishBanner(
  id: string,
  academicYear: number,
  term: number
): Promise<WriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_banners")
    .update({ academic_year: academicYear, term, status: "published" })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: classify(error.code) };
  if (!data) return { ok: false, error: "forbidden" };
  return { ok: true };
}

/**
 * Deletes a whole year + เทอม, or every draft.
 *
 * The Storage objects go too. An orphaned object in a PUBLIC bucket stays
 * fetchable by URL forever, so deleting only the row would leave the image
 * live while the app believes it is gone.
 *
 * Rows first, objects second, and the order matters: if the object delete
 * fails halfway the site shows nothing (correct) with some files left behind
 * (recoverable). Doing it the other way round would leave rows pointing at
 * files that no longer exist, which renders broken images on the homepage.
 */
export async function deleteBannerGroup(
  input: DeleteBannerGroupInput
): Promise<WriteResult & { deleted?: number }> {
  const supabase = await createClient();

  let selectQuery = supabase.from("site_banners").select("id, storage_path");
  selectQuery =
    input.scope === "drafts"
      ? selectQuery.eq("status", "draft")
      : selectQuery
          .eq("status", "published")
          .eq("academic_year", input.academicYear)
          .eq("term", input.term);

  const { data: targets, error: selectError } = await selectQuery;
  if (selectError) return { ok: false, error: classify(selectError.code) };
  if (!targets || targets.length === 0) return { ok: true, deleted: 0 };

  const ids = targets.map((t) => t.id);
  const { data: deleted, error: deleteError } = await supabase
    .from("site_banners")
    .delete()
    .in("id", ids)
    .select("id");

  if (deleteError) return { ok: false, error: classify(deleteError.code) };
  // Zero rows back from a DELETE the caller could see means RLS filtered it.
  if (!deleted || deleted.length === 0) return { ok: false, error: "forbidden" };

  const { error: storageError } = await supabase.storage
    .from(SITE_BANNER_BUCKET)
    .remove(targets.map((t) => t.storage_path));

  // Reported, not fatal: the rows are already gone, so the banner is off the
  // site. A leftover object is a cleanup job, not a failed delete.
  if (storageError) {
    console.error("[site-banners] rows deleted but storage objects remain", storageError);
  }

  return { ok: true, deleted: deleted.length };
}
