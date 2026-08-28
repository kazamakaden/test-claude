export type BookStatus = "draft" | "published";

/**
 * Which shelf a book sits on (0074). "11 ดี" and "11 เก่ง" are the two lists on
 * /documents; "admin_info" is the flat list on /admin-info. See
 * lib/book-collections.ts for the URL slugs and the runtime list.
 */
export type BookCollection = "aft11_good" | "aft11_skilled" | "admin_info";

/**
 * Shelf-card shape. Carries `ownerId` (unlike documents' DocumentSummary)
 * because the shelf itself renders the delete "x" per card (task 2) — the
 * card needs to compute canDelete = isStaff || ownerId === viewerId without
 * a second round trip.
 */
export interface BookSummary {
  id: string;
  title: string;
  academicYear: number;
  season: number;
  status: BookStatus;
  collection: BookCollection;
  coverPath: string | null;
  /**
   * Carried on the SUMMARY, not just BookDetail, because the shelf card
   * links straight at the PDF — it needs to know whether one is attached
   * without a second round trip, the same reason ownerId is here.
   */
  pdfPath: string | null;
  publishedAt: string | null;
  ownerId: string | null;
}

export interface BookDetail extends BookSummary {
  description: string | null;
  ownerName: string | null;
}

export type BookSortColumn = "publishedAt" | "title" | "academicYear";
export type BookSortDirection = "asc" | "desc";

export interface BookFilters {
  /**
   * Required, not optional. An optional collection would default to "all", and
   * the first caller that forgot to pass one would silently render every
   * shelf's books on a page claiming to be one shelf.
   */
  collection: BookCollection;
  search: string;
  academicYear: number | null;
  season: number | null;
  sort: BookSortColumn;
  direction: BookSortDirection;
  page: number;
}

export interface BooksResult {
  rows: BookSummary[];
  total: number;
}
