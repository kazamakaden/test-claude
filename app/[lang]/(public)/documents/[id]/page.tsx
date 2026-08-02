import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDocument } from "@/services/documents";
import { parseDocumentId } from "@/schemas/documents";
import { FlipbookViewer } from "@/components/documents/flipbook-viewer";
import type { Locale } from "@/lib/i18n/config";

export default async function DocumentReaderPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id: rawId } = await params;
  const lang = rawLang as Locale;
  const id = parseDocumentId(rawId);

  // A malformed id can never match a real row — treat it the same as "not
  // found" (below) rather than a 500, and never leak whether an id exists.
  const [dict, document] = await Promise.all([
    getDictionary(lang),
    id ? getDocument(id) : Promise.resolve(null),
  ]);

  if (!document) notFound();

  const d = dict.documents;
  const locale = lang === "th" ? th : enUS;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/${lang}/documents`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {d.backToShelf}
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {document.title}
        </h1>
        {document.description ? (
          <p className="text-sm text-muted-foreground">{document.description}</p>
        ) : null}
        {document.publishedAt ? (
          <p className="text-xs text-muted-foreground">
            {d.publishedAt} {format(new Date(document.publishedAt), "d MMM yyyy", { locale })}
          </p>
        ) : null}
      </div>

      <FlipbookViewer title={document.title} flipbookUrl={document.flipbookUrl} dict={dict} />
    </div>
  );
}
