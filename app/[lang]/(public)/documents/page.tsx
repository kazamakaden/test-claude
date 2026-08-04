import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { tryCreateClient } from "@/lib/supabase/server";
import { parseBooksSearchParams, BOOKS_PER_PAGE_SIZE } from "@/schemas/books";
import { listBooks, getBookYears } from "@/services/books";
import { BooksFilters } from "@/components/books/books-filters";
import { BooksFiltersSkeleton } from "@/components/books/books-filters-skeleton";
import { BooksShelf } from "@/components/books/books-shelf";
import { BooksShelfSkeleton } from "@/components/books/books-shelf-skeleton";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import { Pagination } from "@/components/table/pagination";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Isolated behind its own Suspense + CardBoundary so a failing
 * getBookYears() (unconfigured Supabase, a network blip, RLS) degrades to
 * an error card in place of the filter bar rather than taking the whole
 * route down — the exact fatal-Promise.all shape this page used to have
 * (see CLAUDE.md's §0 "documents" fix entry).
 */
async function BooksFiltersSection({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const years = await getBookYears();
  return <BooksFilters years={years} lang={lang} dict={dict} />;
}

async function BooksResults({
  filters,
  pathname,
  searchParams,
  lang,
  dict,
}: {
  filters: ReturnType<typeof parseBooksSearchParams>;
  pathname: string;
  searchParams: URLSearchParams;
  lang: Locale;
  dict: Dictionary;
}) {
  const [role, { rows, total }] = await Promise.all([getRole(), listBooks(filters)]);
  const supabase = await tryCreateClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const isStaff = can(role, "document:approve");

  return (
    <div className="flex flex-col gap-4">
      <BooksShelf books={rows} viewerId={user?.id ?? null} isStaff={isStaff} lang={lang} dict={dict} />
      <Pagination
        page={filters.page}
        perPage={BOOKS_PER_PAGE_SIZE}
        total={total}
        pathname={pathname}
        searchParams={searchParams}
        dict={dict}
      />
    </div>
  );
}

export default async function DocumentsPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const rawParams = await rawSearchParams;
  // getDictionary() reads a local JSON import and getRole() already fails
  // closed to "guest" on any error — neither can throw. getBookYears() can
  // (a Supabase call), so it's deliberately NOT in this Promise.all — see
  // BooksFiltersSection below, which isolates it behind its own boundary.
  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);

  const filters = parseBooksSearchParams(rawParams);
  const pathname = `/${lang}/documents`;
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );
  const suspenseKey = JSON.stringify(filters);
  const canAdd = can(role, "workspace:access");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {dict.nav.documents}
          </h1>
          <p className="text-sm text-muted-foreground">{dict.documents.description}</p>
        </div>
        {canAdd ? (
          <Button nativeButton={false} render={<Link href={`/${lang}/books/new`} />}>
            <Plus className="size-4" aria-hidden />
            {dict.documents.addBookCta}
          </Button>
        ) : null}
      </div>

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Suspense fallback={<BooksFiltersSkeleton />}>
          <BooksFiltersSection lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Suspense key={suspenseKey} fallback={<BooksShelfSkeleton />}>
          <BooksResults filters={filters} pathname={pathname} searchParams={searchParams} lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>
    </div>
  );
}
