import { z } from "zod";
import { BOOK_COLLECTIONS } from "@/lib/book-collections";
import type { BookCollection } from "@/types/books";

const bookIdSchema = z.uuid();

/** A malformed id can never reach a real row, so treat it as "not found" rather than a 500. */
export function parseBookId(id: string): string | null {
  const result = bookIdSchema.safeParse(id);
  return result.success ? result.data : null;
}

const PER_PAGE = 12;
export const BOOKS_PER_PAGE_SIZE = PER_PAGE;

const sortColumns = ["publishedAt", "title", "academicYear"] as const;

/** §3 shelf list filters — same construction as schemas/members.ts/documents.ts. */
export const booksFiltersSchema = z.object({
  collection: z.enum(BOOK_COLLECTIONS),
  search: z.string().trim().max(100).catch(""),
  academicYear: z.coerce.number().int().nullable().catch(null),
  season: z.coerce.number().int().min(1).max(3).nullable().catch(null),
  sort: z.enum(sortColumns).catch("publishedAt"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().positive().catch(1),
});

/**
 * `collection` is a parameter, not a search param, on purpose. /documents picks
 * it from `?list=` and /admin-info pins it; either way the PAGE has already
 * decided which shelf it is rendering, so letting a query string override that
 * would only create a way for one page to quietly show another page's books.
 */
export function parseBooksSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  collection: BookCollection
) {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return booksFiltersSchema.parse({
    collection,
    search: single(searchParams.search) ?? "",
    academicYear: single(searchParams.year) ?? null,
    season: single(searchParams.season) ?? null,
    sort: single(searchParams.sort) ?? "publishedAt",
    direction: single(searchParams.dir) ?? "desc",
    page: single(searchParams.page) ?? "1",
  });
}

const yearField = z.coerce
  .number({ message: "yearInvalid" })
  .int({ message: "yearInvalid" })
  .min(2500, { message: "yearInvalid" })
  .max(2699, { message: "yearInvalid" });

const seasonField = z.coerce
  .number({ message: "seasonInvalid" })
  .int({ message: "seasonInvalid" })
  .min(1, { message: "seasonInvalid" })
  .max(3, { message: "seasonInvalid" });

/** Task 2's minimal create step: name, year, season -> draft. Everything else is edited afterward. */
export const createBookSchema = z.object({
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
  /**
   * No .catch() and no default: 0074 makes the column NOT NULL with no default
   * precisely so a missing collection is a refusal (23502) rather than a silent
   * bucket somebody has to notice later. The same call createActivitySchema
   * makes for `category`.
   */
  collection: z.enum(BOOK_COLLECTIONS, { message: "collectionRequired" }),
  academicYear: yearField,
  season: seasonField,
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
  // Editable, so a book filed on the wrong shelf is fixable in place. An
  // ordinary owner edit — books_update_own_draft already covers it, no new
  // policy and no privilege attached (0074).
  collection: z.enum(BOOK_COLLECTIONS, { message: "collectionRequired" }),
  // No .catch() — an over-length description must surface
  // descriptionTooLong to the caller, not be silently discarded on save
  // (the same class of bug already fixed once for schemas/members.ts's
  // studentId field).
  description: z.string().trim().max(2000, { message: "descriptionTooLong" }).nullable(),
  academicYear: yearField,
  season: seasonField,
  // Storage object paths, written by the two-phase upload flow (browser ->
  // Storage directly, then this hidden field carries the resulting path
  // into the ordinary Server Action) — never a raw file, since Server
  // Actions have a 1MB body default this codebase does not want to raise.
  pdfPath: z.string().trim().max(500).nullable().catch(null),
  coverPath: z.string().trim().max(500).nullable().catch(null),
});
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const deleteBookSchema = z.object({ id: z.uuid() });

export const publishBookSchema = z.object({ id: z.uuid() });
export const unpublishBookSchema = z.object({ id: z.uuid() });
