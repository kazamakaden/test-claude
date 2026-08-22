import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { parseDocumentsSearchParams, DOCUMENTS_PER_PAGE_SIZE } from "@/schemas/documents";
import { listReviewDocuments } from "@/services/documents";
import { DocumentsTable } from "@/components/documents/documents-table";
import { Pagination } from "@/components/table/pagination";
import type { Locale } from "@/lib/i18n/config";

export default async function DocumentsReviewPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  await requirePermission("document:approve", lang);

  const rawParams = await rawSearchParams;
  const dict = await getDictionary(lang);
  const filters = parseDocumentsSearchParams(rawParams);
  const d = dict.documents.review;

  const pathname = `/${lang}/documents/review`;
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );

  const { rows, total } = await listReviewDocuments(filters);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.title}
        </h1>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{d.empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <DocumentsTable
            documents={rows}
            filters={filters}
            pathname={pathname}
            searchParams={searchParams}
            lang={lang}
            dict={dict}
          />
          <Pagination
            page={filters.page}
            perPage={DOCUMENTS_PER_PAGE_SIZE}
            total={total}
            pathname={pathname}
            searchParams={searchParams}
            dict={dict}
          />
        </div>
      )}
    </div>
  );
}
