import Link from "next/link";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { X } from "lucide-react";
import { BookCover } from "@/components/documents/book-cover";
import { DeleteBookButton } from "@/components/books/delete-book-button";
import { SEASON_LABELS_TH, SEASON_LABELS_EN } from "@/lib/books";
import type { BookSummary } from "@/types/books";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function BookCard({
  book,
  canDelete,
  lang,
  dict,
}: {
  book: BookSummary;
  canDelete: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.documents;
  const locale = lang === "th" ? th : enUS;
  const seasonLabels = lang === "th" ? SEASON_LABELS_TH : SEASON_LABELS_EN;

  return (
    <div className="group relative flex flex-col gap-2">
      <Link
        href={`/${lang}/documents/${book.id}`}
        className="flex flex-col gap-2 rounded-lg outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
      >
        <BookCover title={book.title} className="transition-transform group-hover:-translate-y-1" />
        <p className="line-clamp-2 text-sm font-medium text-foreground">{book.title}</p>
        <p className="text-xs text-muted-foreground">
          {seasonLabels[book.season]} {book.academicYear}
          {book.status === "draft" ? ` · ${d.draftBadge}` : ""}
        </p>
        {book.publishedAt ? (
          <p className="text-xs text-muted-foreground">
            {d.publishedAt} {format(new Date(book.publishedAt), "d MMM yyyy", { locale })}
          </p>
        ) : null}
      </Link>

      {canDelete ? (
        <DeleteBookButton
          bookId={book.id}
          title={book.title}
          lang={lang}
          dict={dict}
          trigger={
            <button
              type="button"
              aria-label={`${d.deleteConfirmTitle} ${book.title}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className="absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded-full bg-card/90 text-muted-foreground opacity-0 shadow-sm outline-none transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:opacity-100"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          }
        />
      ) : null}
    </div>
  );
}
