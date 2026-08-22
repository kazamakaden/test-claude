export type BookStatus = "draft" | "published";

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
