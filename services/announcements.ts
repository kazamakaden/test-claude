import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/config";
import type { Announcement, AnnouncementDraft } from "@/types/announcements";
import type { AnnouncementInput } from "@/schemas/announcements";

/**
 * §5/§16 announcements.
 *
 * Read paths use tryCreateClient() and fail soft to empty — the convention
 * every list fetcher here follows, so a missing Supabase config degrades to
 * "no announcements" instead of throwing above the page's own boundary. Write
 * paths use createClient(): a write with no real client should throw.
 *
 * No role checks live here. RLS (0060) admits published rows to everyone and
 * drafts only to staff, and the actions re-check content:manage before calling
 * in. Adding a filter here would be a second, weaker copy of the same rule.
 */

// Never select("*"): `notified_at` is outside the column allow-list (0060) and
// a "*" would fail with 42501 — the same trap 0005 set for citizen_id.
const COLUMNS =
  "id, title_th, title_en, body_th, body_en, status, published_at, pinned, created_at";

/** `_en` falls back to `_th` when absent OR blank. */
function localize(value: string | null, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function toAnnouncement(
  row: {
    id: string;
    title_th: string;
    title_en: string | null;
    body_th: string;
    body_en: string | null;
    status: string;
    published_at: string | null;
    pinned: boolean;
    created_at: string;
  },
  lang: Locale
): Announcement {
  return {
    id: row.id,
    title: lang === "en" ? localize(row.title_en, row.title_th) : row.title_th,
    body: lang === "en" ? localize(row.body_en, row.body_th) : row.body_th,
    status: row.status as Announcement["status"],
    publishedAt: row.published_at,
    pinned: row.pinned,
    createdAt: row.created_at,
  };
}

/**
 * The public feed. Pinned first, then newest — matching the index 0060 adds,
 * so this stays an index scan as the table grows.
 *
 * `includeDrafts` does not widen access on its own: RLS decides what comes
 * back, so a student passing true still sees only published rows. It exists so
 * the public page can exclude a staff member's own drafts from the reader-
 * facing list even though they are permitted to see them.
 */
export async function listAnnouncements(
  lang: Locale,
  options: { includeDrafts?: boolean } = {}
): Promise<Announcement[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  let query = supabase.from("announcements").select(COLUMNS);
  if (!options.includeDrafts) query = query.eq("status", "published");

  const { data, error } = await query
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => toAnnouncement(row, lang));
}

export async function getAnnouncement(id: string, lang: Locale): Promise<Announcement | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("announcements")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return toAnnouncement(data, lang);
}

/** The raw column pair, for the staff editor. */
export async function getAnnouncementDraft(id: string): Promise<AnnouncementDraft | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("announcements")
    .select("id, title_th, title_en, body_th, body_en, status, pinned")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    titleTh: data.title_th,
    titleEn: data.title_en,
    bodyTh: data.body_th,
    bodyEn: data.body_en,
    status: data.status as AnnouncementDraft["status"],
    pinned: data.pinned,
  };
}

export async function createAnnouncement(
  input: AnnouncementInput,
  authorId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title_th: input.titleTh,
      title_en: input.titleEn,
      body_th: input.bodyTh,
      body_en: input.bodyEn,
      pinned: input.pinned,
      // announcements_insert_staff requires this to equal auth.uid(), so a
      // forged author is refused by the database, not just unoffered by the UI.
      author_id: authorId,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.code === "42501" ? "forbidden" : "unknown" };
  if (!data) return { ok: false, error: "forbidden" };
  return { ok: true, id: data.id };
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({
      title_th: input.titleTh,
      title_en: input.titleEn,
      body_th: input.bodyTh,
      body_en: input.bodyEn,
      pinned: input.pinned,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "unknown" };
  // Zero rows means RLS refused or the id is stale — never a silent success,
  // the discipline updateMember/updateBook already use.
  if (!data) return { ok: false, error: "notFound" };
  return { ok: true };
}

/**
 * Publishing is a status write and nothing else. published_at and the §16
 * broadcast are set by the 0060 triggers, which is why neither column is in
 * this update — nor in the caller's column grant.
 */
export async function setAnnouncementStatus(
  id: string,
  status: "draft" | "published"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({ status })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    // 23514 is announcements_published_needs_body. Matching on SQLSTATE rather
    // than the constraint name deliberately: CLAUDE.md records publishBookAction
    // string-matching a constraint name, which a rename silently breaks into a
    // misleading "not found". This table has exactly one CHECK reachable from
    // a status update, so the code alone identifies it.
    if (error.code === "23514") return { ok: false, error: "bodyRequiredToPublish" };
    return { ok: false, error: "unknown" };
  }
  if (!data) return { ok: false, error: "notFound" };
  return { ok: true };
}

export async function deleteAnnouncement(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "unknown" };
  if (!data) return { ok: false, error: "forbidden" };
  return { ok: true };
}
