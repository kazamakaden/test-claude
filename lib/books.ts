export const BOOK_PDF_MAX_BYTES = 25 * 1024 * 1024;
export const BOOK_COVER_MAX_BYTES = 2 * 1024 * 1024;

export const SEASON_LABELS_TH = ["", "ภาคเรียนที่ 1", "ภาคเรียนที่ 2", "ภาคฤดูร้อน"] as const;
export const SEASON_LABELS_EN = ["", "Semester 1", "Semester 2", "Summer"] as const;

/**
 * Whether a viewer may open this book's file.
 *
 * `published` is the rule (§12 publish guard) — and after migration 0053 a
 * published book is GUARANTEED to have a pdf_path, since
 * books_published_needs_pdf refuses otherwise. The owner and staff may also
 * open their own drafts, which is what lets them check a file before
 * publishing it; that is the same audience books_select_own /
 * books_select_staff (0028) already lets see the row at all, so this grants
 * no visibility RLS hasn't already granted.
 *
 * A guest therefore can never reach a draft here: RLS never returns the row
 * to them in the first place, and canManage is false regardless.
 */
export function canOpenBookPdf(
  book: { status: "draft" | "published"; pdfPath: string | null },
  canManage: boolean
): boolean {
  if (!book.pdfPath) return false;
  return book.status === "published" || canManage;
}

/**
 * A stable, safe filename for a book's downloaded PDF. Strips characters
 * that are legal in a book title (this project's titles are often Thai) but
 * not in a Content-Disposition filename — quotes and control/path
 * characters specifically, since those are what could corrupt the header or
 * smuggle a path segment, not Thai script itself, which is a legitimate
 * filename character on every OS this app targets (§2: Windows dev, Linux
 * prod).
 */
export function bookPdfFilename(title: string): string {
  const safeTitle = title.replace(/["\\/:*?<>|\x00-\x1f]/g, "").trim();
  return `${safeTitle || "document"}.pdf`;
}
