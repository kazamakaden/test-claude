import { z } from "zod";

/**
 * §18 search input.
 *
 * A minimum length of 2 is a real control, not polish: a single character
 * matches most of the directory, which turns a search box into a bulk export
 * of every member's name and student ID. The RPC caps its own result count as
 * well (0059), so this is the outer of two bounds rather than the only one.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, { message: "tooShort" }).max(100).catch(""),
});

export function parseSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): { q: string } {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const raw = single(searchParams.q) ?? "";

  // .catch("") above turns a too-short or over-long query into an empty one,
  // which the page renders as "type something" rather than an error — the same
  // fail-soft filter parsing every other list page here uses.
  const parsed = searchQuerySchema.safeParse({ q: raw });
  return { q: parsed.success ? parsed.data.q : "" };
}

/** Shared by the page and the API route so both bound the query identically. */
export const MIN_QUERY_LENGTH = 2;
