import { BookOpen } from "lucide-react";
import { BookCard } from "@/components/books/book-card";
import { CardEmpty } from "@/components/dashboard/card-states";
import { canOpenBookPdf } from "@/lib/books";
import type { BookSummary } from "@/types/books";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function BooksShelf({
  books,
  coverUrls,
  pdfUrls,
  viewerId,
  isStaff,
  lang,
  dict,
}: {
  books: BookSummary[];
  coverUrls: Map<string, string>;
  pdfUrls: Map<string, string>;
  viewerId: string | null;
  isStaff: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.documents;

  if (books.length === 0) {
    return (
      <CardEmpty icon={BookOpen} message={d.empty} ctaLabel={dict.nav.home} ctaHref="/" lang={lang} />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {books.map((book) => {
        const canManage = isStaff || (viewerId !== null && book.ownerId === viewerId);
        // The publish guard. A draft's file is openable only by the people
        // who can act on it; everyone else gets the detail-page fallback,
        // and RLS has already kept the row itself out of a guest's list.
        const pdfUrl =
          book.pdfPath && canOpenBookPdf(book, canManage) ? (pdfUrls.get(book.pdfPath) ?? null) : null;

        return (
          <BookCard
            key={book.id}
            book={book}
            coverUrl={book.coverPath ? (coverUrls.get(book.coverPath) ?? null) : null}
            pdfUrl={pdfUrl}
            canManage={canManage}
            lang={lang}
            dict={dict}
          />
        );
      })}
    </div>
  );
}
