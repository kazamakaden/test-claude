import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import type { ContentBlock } from "@/types/content";
import type { UpdateContentBlockInput } from "@/schemas/content";

const CONTENT_BLOCK_COLUMNS = "slug, title_th, title_en, body_th, body_en, updated_at";

function toContentBlock(row: {
  slug: string;
  title_th: string;
  title_en: string | null;
  body_th: string;
  body_en: string | null;
  updated_at: string;
}): ContentBlock {
  return {
    slug: row.slug,
    titleTh: row.title_th,
    titleEn: row.title_en,
    bodyTh: row.body_th,
    bodyEn: row.body_en,
    updatedAt: row.updated_at,
  };
}

/**
 * Public read (content_blocks_select_all, 0032) — fails soft to null so a
 * page can render its normal "not found"/empty handling instead of
 * crashing before Supabase is configured, same contract as every other
 * read function in this codebase (services/books.ts, services/activities.ts).
 */
export async function getContentBlock(slug: string): Promise<ContentBlock | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("content_blocks")
    .select(CONTENT_BLOCK_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return toContentBlock(data);
}

/**
 * Staff write (content_blocks_update_staff, 0032). `.select().maybeSingle()`
 * on the UPDATE is what turns an RLS denial into a detectable `{ ok: false }`
 * rather than a false success — the same idiom actions/activities.ts's
 * update path uses.
 */
export async function updateContentBlock(
  input: UpdateContentBlockInput,
  updatedBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_blocks")
    .update({
      title_th: input.titleTh,
      title_en: input.titleEn,
      body_th: input.bodyTh,
      body_en: input.bodyEn,
      updated_by: updatedBy,
    })
    .eq("slug", input.slug)
    .select("slug")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}
