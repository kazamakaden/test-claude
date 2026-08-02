import Link from "next/link";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { BookOpen } from "lucide-react";
import { BookCover } from "@/components/documents/book-cover";
import { CardEmpty } from "@/components/dashboard/card-states";
import type { DocumentSummary } from "@/types/documents";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function BookShelf({
  documents,
  lang,
  dict,
}: {
  documents: DocumentSummary[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.documents;
  const locale = lang === "th" ? th : enUS;

  if (documents.length === 0) {
    return (
      <CardEmpty icon={BookOpen} message={d.empty} ctaLabel={dict.nav.home} ctaHref="/" lang={lang} />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {documents.map((doc) => (
        <Link
          key={doc.id}
          href={`/${lang}/documents/${doc.id}`}
          className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BookCover title={doc.title} className="transition-transform group-hover:-translate-y-1" />
          <p className="line-clamp-2 text-sm font-medium text-foreground">{doc.title}</p>
          {doc.publishedAt ? (
            <p className="text-xs text-muted-foreground">
              {d.publishedAt} {format(new Date(doc.publishedAt), "d MMM yyyy", { locale })}
            </p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
