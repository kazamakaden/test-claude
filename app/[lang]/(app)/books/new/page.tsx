import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { BookCreateForm } from "@/components/books/book-create-form";
import type { Locale } from "@/lib/i18n/config";

/**
 * Lives under /books, not /documents/manage/new — that path already means
 * "create a §12 workflow document"; a second unrelated meaning one segment
 * away would be a confusing collision, not a shared feature.
 */
export default async function NewBookPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  await requirePermission("workspace:access", lang);

  const dict = await getDictionary(lang);
  const d = dict.documents.manage;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.newBookCta}
        </h1>
        <p className="text-sm text-muted-foreground">{d.newBookDescription}</p>
      </div>

      <BookCreateForm lang={lang} dict={dict} />
    </div>
  );
}
