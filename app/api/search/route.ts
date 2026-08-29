import { NextResponse } from "next/server";
import { search } from "@/services/search";
import { MIN_QUERY_LENGTH } from "@/schemas/search";
import { isLocale, defaultLocale } from "@/lib/i18n/config";

/**
 * Type-ahead results for the nav's command palette.
 *
 * No role check here, deliberately, and it is worth being explicit about why
 * rather than leaving it looking like an omission: search_all (0059) is
 * SECURITY INVOKER, so the database scopes every row to the caller's own
 * policies. A guest hitting this endpoint gets exactly the public content they
 * could already browse. Adding a permission gate would restrict the palette
 * without restricting the data, which is the wrong half.
 *
 * What IS enforced here is the bound on work: a query shorter than the minimum
 * is refused before any round trip, and the RPC clamps its own result count.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const langParam = url.searchParams.get("lang") ?? "";
  const lang = isLocale(langParam) ? langParam : defaultLocale;

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ groups: [], total: 0 });
  }

  const results = await search(q, lang, 5);

  return NextResponse.json(results, {
    // Results depend on the caller's session, so a shared cache must never
    // hold them — one user's reviewer-visible drafts could otherwise be served
    // to the next.
    headers: { "Cache-Control": "no-store, private" },
  });
}
