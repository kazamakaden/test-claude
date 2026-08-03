import { BookOpen } from "lucide-react";
import { BookCard } from "@/components/books/book-card";
import { CardEmpty } from "@/components/dashboard/card-states";
import type { BookSummary } from "@/types/books";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function BooksShelf({
  books,
  viewerId,
  isStaff,
  lang,
  dict,
}: {
  books: BookSummary[];
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
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          canDelete={isStaff || (viewerId !== null && book.ownerId === viewerId)}
          lang={lang}
          dict={dict}
        />
      ))}
    </div>
  );
}
