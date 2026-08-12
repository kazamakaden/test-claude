import Link from "next/link";
import { Plus } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUserId } from "@/lib/auth/get-role";
import { requirePermission } from "@/lib/auth/require-role";
import { parseDocumentsSearchParams, DOCUMENTS_PER_PAGE_SIZE } from "@/schemas/documents";
import { listMyDocuments } from "@/services/documents";
import { DocumentsFilters } from "@/components/documents/documents-filters";
import { DocumentsTable } from "@/components/documents/documents-table";
import { Pagination } from "@/components/table/pagination";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

export default async function ManageDocumentsPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  await requirePermission("document:sign", lang);

  const rawParams = await rawSearchParams;
  const dict = await getDictionary(lang);
  const viewerUserId = await getSessionUserId();

  const filters = parseDocumentsSearchParams(rawParams);
  const { rows, total } = viewerUserId ? await listMyDocuments(viewerUserId, filters) : { rows: [], total: 0 };

  const pathname = `/${lang}/documents/manage`;
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );

  const d = dict.documents.manage;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {d.title}
          </h1>
          <p className="text-sm text-muted-foreground">{d.description}</p>
        </div>
        <Button nativeButton={false} render={<Link href={`/${lang}/documents/manage/new`} />}>
          <Plus className="size-4" aria-hidden />
          {d.newDocumentCta}
        </Button>
      </div>

      <DocumentsFilters dict={dict} />

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
    </div>
  );
}
