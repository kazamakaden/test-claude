import "server-only";
import { tryCreateClient } from "@/lib/supabase/server";
import { isSearchEntity, searchEntities, type SearchEntity, type SearchHit, type SearchResults } from "@/types/search";
import type { Locale } from "@/lib/i18n/config";
import { MIN_QUERY_LENGTH } from "@/schemas/search";

/**
 * §18 global search.
 *
 * All the access control lives in public.search_all (0059), which is SECURITY
 * INVOKER so each table's own RLS scopes the rows. That is why this file has
 * no role checks and must never gain any: adding a filter here would create a
 * second, weaker copy of the rules that can drift from the policies.
 *
 * It also must never use the admin client. That would bypass every policy the
 * design depends on and turn one query into a cross-user leak — the SEC-4
 * failure this feature was most at risk of.
 */

/** Where a hit points. Built here rather than in SQL so routes stay in one language. */
function hrefFor(entity: SearchEntity, id: string, lang: Locale): string {
  switch (entity) {
    case "member":
      // No per-member route exists; the directory with the row's id as a search
      // term is the closest honest destination.
      return `/${lang}/members`;
    case "activity":
      return `/${lang}/activities`;
    case "project":
      return `/${lang}/projects/${id}`;
    case "document":
      // The §12 workflow page, NOT /documents/{id} — that route is the BOOK
      // detail page (it calls getBook), so a documents.id never resolves there
      // and every document hit 404'd. The document -> book bridge was dropped
      // deliberately in 0053; this map was the last place still assuming it.
      // There is no public document page at all, so for a viewer without
      // document:sign this redirects to login — a coherent "sign in to see
      // this" rather than a 404 claiming the row does not exist.
      return `/${lang}/documents/manage/${id}`;
    case "book":
      // Correct as-is: /documents/{id} IS the book detail route, and it serves
      // all three collections (0074).
      return `/${lang}/documents/${id}`;
  }
}

export async function search(query: string, lang: Locale, limit = 5): Promise<SearchResults> {
  const trimmed = query.trim();
  // Short-circuit before the round trip; the RPC bounds itself too.
  if (trimmed.length < MIN_QUERY_LENGTH) return { groups: [], total: 0 };

  const supabase = await tryCreateClient();
  if (!supabase) return { groups: [], total: 0 };

  const { data, error } = await supabase.rpc("search_all", {
    p_query: trimmed,
    p_limit: limit,
  });

  if (error || !data) return { groups: [], total: 0 };

  const hits: SearchHit[] = data
    // Narrow rather than trust: an entity the UI has no label or route for
    // would otherwise render blank and link nowhere.
    .filter((r) => isSearchEntity(r.entity))
    .map((r) => ({
      entity: r.entity as SearchEntity,
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      href: hrefFor(r.entity as SearchEntity, r.id, lang),
    }));

  // Grouped in a fixed order so the dropdown does not reshuffle between
  // keystrokes as counts change.
  const groups = searchEntities
    .map((entity) => ({ entity, hits: hits.filter((h) => h.entity === entity) }))
    .filter((g) => g.hits.length > 0);

  return { groups, total: hits.length };
}
