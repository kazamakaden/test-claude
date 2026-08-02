import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listDocuments } from "@/services/documents";
import { BookShelf } from "@/components/documents/book-shelf";
import type { Locale } from "@/lib/i18n/config";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const [dict, documents] = await Promise.all([getDictionary(lang), listDocuments()]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {dict.nav.documents}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.documents.description}</p>
      </div>

      <BookShelf documents={documents} lang={lang} dict={dict} />
    </div>
  );
}
