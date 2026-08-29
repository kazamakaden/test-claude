import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { BookCreateForm } from "@/components/books/book-create-form";
import { isBookCollection } from "@/lib/book-collections";
import type { BookCollection } from "@/types/books";
import type { Locale } from "@/lib/i18n/config";

/**
 * Lives under /books, not /documents/manage/new — that path already means
 * "create a §12 workflow document"; a second unrelated meaning one segment
 * away would be a confusing collision, not a shared feature.
 */
export default async function NewBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  // Which shelf the "add" button was clicked from, so the form opens on the
  // right one. Only a PRESELECTION — the control is visible and the value is
  // re-validated in createBookAction, so a hand-edited query string picks a
  // different default at most, never a different outcome.
  const rawCollection = (await searchParams).collection;
  const collectionParam = Array.isArray(rawCollection) ? rawCollection[0] : rawCollection;
  const defaultCollection: BookCollection =
    collectionParam && isBookCollection(collectionParam) ? collectionParam : "aft11_good";

  // document:draft:submit — books_insert_own (0028/0049) admits only
  // aft/teacher/admin, and a read-only student holds workspace:access.
  await requirePermission("document:draft:submit", lang);

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

      <BookCreateForm lang={lang} dict={dict} defaultCollection={defaultCollection} />
    </div>
  );
}
