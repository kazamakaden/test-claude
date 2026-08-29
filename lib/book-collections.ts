import type { BookCollection } from "@/types/books";

/**
 * The three shelves. Mirrors the `book_collection` enum (0074) — the database
 * is the boundary, this is what the app is allowed to send it.
 *
 * Filing is NOT a privilege: no policy references the column and none should,
 * so there is deliberately no permission attached to a collection here. What a
 * viewer may see is still decided by books_select_* (0028), and what they may
 * write by books_insert_own / books_update_own_draft.
 */
export const BOOK_COLLECTIONS = ["aft11_good", "aft11_skilled", "admin_info"] as const;

export function isBookCollection(value: string): value is BookCollection {
  return (BOOK_COLLECTIONS as readonly string[]).includes(value);
}

/**
 * /documents shows two lists side by side, selected with `?list=`. The URL
 * slug is short and stable ("good"/"skilled"); the enum value is what reaches
 * the database. Keeping them separate means a column rename never rewrites
 * everyone's bookmarks, and a slug typo can never smuggle an unknown value
 * into a query.
 */
export const AFT11_LISTS = {
  good: "aft11_good",
  skilled: "aft11_skilled",
} as const satisfies Record<string, BookCollection>;

export type Aft11List = keyof typeof AFT11_LISTS;

export const AFT11_LIST_SLUGS = Object.keys(AFT11_LISTS) as Aft11List[];

/** Unknown/absent falls back to the first list rather than erroring — a bad `?list=` is a stale link, not an attack. */
export function parseAft11List(value: string | undefined): Aft11List {
  return value !== undefined && value in AFT11_LISTS ? (value as Aft11List) : "good";
}

/**
 * Where a book of this collection lives.
 *
 * The detail page is one route (`/documents/{id}`) serving all three shelves,
 * so "back to the shelf" and "where to go after deleting" cannot be a constant
 * — an admin_info book sent the viewer to the 11 ดี list, and a skilled book to
 * the wrong tab of the right page.
 */
export function shelfHref(collection: BookCollection, lang: string): string {
  if (collection === "admin_info") return `/${lang}/admin-info`;
  const slug = collection === "aft11_skilled" ? "skilled" : "good";
  return `/${lang}/documents?list=${slug}`;
}
