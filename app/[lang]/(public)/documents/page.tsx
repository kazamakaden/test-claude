import { getDictionary } from "@/lib/i18n/get-dictionary";
import { BookShelfPage } from "@/components/books/book-shelf-page";
import { BooksListTabs } from "@/components/books/books-list-tabs";
import { AFT11_LISTS, parseAft11List } from "@/lib/book-collections";
import type { Locale } from "@/lib/i18n/config";

/**
 * "11 ดี 11 เก่ง อวท." — two lists over the same shelf, selected with `?list=`.
 *
 * This route used to be the general เอกสาร shelf and keeps its URL: it is in
 * bookmarks and every book detail page links back to it. What changed is which
 * books it shows (0074's collection) and what it is called.
 */
export default async function Aft11DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const rawParams = await searchParams;

  const dict = await getDictionary(lang);
  const rawList = rawParams.list;
  const list = parseAft11List(Array.isArray(rawList) ? rawList[0] : rawList);
  const pathname = `/${lang}/documents`;

  return (
    <BookShelfPage
      collection={AFT11_LISTS[list]}
      title={dict.nav.aft11}
      description={dict.documents.description}
      pathname={pathname}
      rawParams={rawParams}
      tabs={<BooksListTabs pathname={pathname} active={list} dict={dict} />}
      lang={lang}
      dict={dict}
    />
  );
}
