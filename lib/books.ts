import { isFlipHtml5EmbedUrl, toFlipHtml5EmbedUrl } from "@/lib/fliphtml5";

export { isFlipHtml5EmbedUrl, toFlipHtml5EmbedUrl };

export type BookSource = { kind: "flipbook"; embedUrl: string } | { kind: "pdf" } | { kind: "none" };

/**
 * Single source of truth for which reader a book uses. FlipHTML5 wins when
 * both are set — an embedded reader is a strictly better experience than
 * the <object>-tag PDF fallback (components/books/pdf-viewer.tsx), whose
 * inline rendering is unreliable on mobile Chrome/iOS Safari. Callers that
 * also want to offer the PDF as a secondary download check pdfPath
 * themselves — this only decides the primary reader.
 */
export function resolveBookSource(book: { flipbookUrl: string | null; pdfPath: string | null }): BookSource {
  if (book.flipbookUrl && isFlipHtml5EmbedUrl(book.flipbookUrl)) {
    const embedUrl = toFlipHtml5EmbedUrl(book.flipbookUrl);
    if (embedUrl) return { kind: "flipbook", embedUrl };
  }
  if (book.pdfPath) return { kind: "pdf" };
  return { kind: "none" };
}

export const BOOK_PDF_MAX_BYTES = 25 * 1024 * 1024;
export const BOOK_COVER_MAX_BYTES = 2 * 1024 * 1024;

export const SEASON_LABELS_TH = ["", "ภาคเรียนที่ 1", "ภาคเรียนที่ 2", "ภาคฤดูร้อน"] as const;
export const SEASON_LABELS_EN = ["", "Semester 1", "Semester 2", "Summer"] as const;

/**
 * §12 document -> shelf bridge (services/documents.ts#approveDocument).
 * `books.academic_year`/`season` have no equivalent field in the plain
 * document workflow, so an auto-listed book's year/season is derived from
 * the approval date via the Thai academic-calendar convention: a year
 * "starts" in June and "ends" the following May, split into semester 1
 * (Jun–Oct), semester 2 (Nov–Mar), and summer (Apr–May) — so a January
 * approval belongs to the academic year that started the PREVIOUS June,
 * not the current Gregorian year. This is only a starting default; staff
 * can correct it afterward from the book's own edit form like any other
 * book (the bridge inserts directly as published, so only staff —
 * books_staff_all, 0028 — can edit it, not the original document owner).
 */
export function deriveAcademicYearAndSeason(date: Date): { academicYear: number; season: number } {
  const buddhistYear = date.getFullYear() + 543;
  const month = date.getMonth() + 1;

  if (month >= 6 && month <= 10) return { academicYear: buddhistYear, season: 1 };
  if (month === 11 || month === 12) return { academicYear: buddhistYear, season: 2 };
  if (month >= 1 && month <= 3) return { academicYear: buddhistYear - 1, season: 2 };
  return { academicYear: buddhistYear - 1, season: 3 };
}
