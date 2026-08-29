import Link from "next/link";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Settings2, X } from "lucide-react";
import { BookCover } from "@/components/documents/book-cover";
import { DeleteBookButton } from "@/components/books/delete-book-button";
import { SEASON_LABELS_TH, SEASON_LABELS_EN } from "@/lib/books";
import type { BookSummary } from "@/types/books";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDate } from "@/lib/datetime";

/**
 * A shelf card. Clicking it opens the book's PDF in a new tab, handed to
 * the browser's own viewer — no embedded reader, no third-party host.
 *
 * `pdfUrl` is null when the viewer may not open this book: no file
 * uploaded, or an unpublished draft they don't own (see
 * lib/books.ts#canOpenBookPdf). In that case the card falls back to the
 * detail page rather than rendering a dead link — and since RLS only ever
 * shows a draft to its owner or to staff, and a published book is
 * guaranteed a PDF by books_published_needs_pdf (0053), the fallback is
 * only ever reachable by someone who can actually do something about it.
 *
 * Synchronous by design: the signed URLs are minted in one batch upstream
 * (services/books.ts#getSignedUrlMap) rather than per card.
 */
export function BookCard({
  book,
  coverUrl,
  pdfUrl,
  canManage,
  lang,
  dict,
}: {
  book: BookSummary;
  coverUrl: string | null;
  pdfUrl: string | null;
  canManage: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.documents;
  const locale = lang === "th" ? th : enUS;
  const seasonLabels = lang === "th" ? SEASON_LABELS_TH : SEASON_LABELS_EN;
  const detailHref = `/${lang}/documents/${book.id}`;

  const linkClassName =
    "flex flex-col gap-2 rounded-lg outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50";

  const body = (
    <>
      <BookCover
        title={book.title}
        coverUrl={coverUrl}
        className="transition-transform group-hover:-translate-y-1"
      />
      <p className="line-clamp-2 text-sm font-medium text-foreground">
        {book.title}
        {/* Appended to the accessible name rather than replacing it via
            aria-label, so the visible text stays a prefix of what a screen
            reader announces (WCAG 2.5.3 Label in Name). */}
        {pdfUrl ? <span className="sr-only"> ({d.opensInNewTab})</span> : null}
      </p>
      <p className="text-xs text-muted-foreground">
        {seasonLabels[book.season]} {book.academicYear}
        {book.status === "draft" ? ` · ${d.draftBadge}` : ""}
      </p>
      {book.publishedAt ? (
        <p className="text-xs text-muted-foreground">
          {d.publishedAt} {format(bangkokDate(book.publishedAt), "d MMM yyyy", { locale })}
        </p>
      ) : null}
    </>
  );

  return (
    <div className="group relative flex flex-col gap-2">
      {pdfUrl ? (
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          {body}
        </a>
      ) : (
        <Link href={detailHref} className={linkClassName}>
          {body}
        </Link>
      )}

      {canManage ? (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {/* The card itself now goes to the file, so managing the book
              needs its own way in. Kept to owners and staff — the only
              people the detail page's controls do anything for. */}
          <Link
            href={detailHref}
            aria-label={`${d.manageBook} ${book.title}`}
            className="flex size-6 items-center justify-center rounded-full bg-card/90 text-muted-foreground opacity-0 shadow-sm outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100"
          >
            <Settings2 className="size-3.5" aria-hidden />
          </Link>
          <DeleteBookButton
            bookId={book.id}
            title={book.title}
            lang={lang}
            dict={dict}
            stopTriggerPropagation
            trigger={
              <button
                type="button"
                aria-label={`${d.deleteConfirmTitle} ${book.title}`}
                className="flex size-6 items-center justify-center rounded-full bg-card/90 text-muted-foreground opacity-0 shadow-sm outline-none transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
