import { getDictionary } from "@/lib/i18n/get-dictionary";
import { BookShelfPage } from "@/components/books/book-shelf-page";
import type { Locale } from "@/lib/i18n/config";

/**
 * "สภาพทั่วไปและการบริหารองค์การ" — the same shelf as /documents with one
 * collection pinned and no list switcher, per the confirmed decision (one flat
 * list, no sub-lists, no intro text).
 */
export default async function AdminInfoPage({
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

  return (
    <BookShelfPage
      collection="admin_info"
      title={dict.nav.adminInfo}
      description={dict.adminInfo.description}
      pathname={`/${lang}/admin-info`}
      rawParams={rawParams}
      lang={lang}
      dict={dict}
    />
  );
}
