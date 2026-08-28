import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { tryCreateClient } from "@/lib/supabase/server";
import { parseBooksSearchParams, BOOKS_PER_PAGE_SIZE } from "@/schemas/books";
import { listBooks, getBookYears, getSignedUrlMap } from "@/services/books";
import { BooksFilters } from "@/components/books/books-filters";
import { BooksFiltersSkeleton } from "@/components/books/books-filters-skeleton";
import { BooksShelf } from "@/components/books/books-shelf";
import { BooksShelfSkeleton } from "@/components/books/books-shelf-skeleton";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import { Pagination } from "@/components/table/pagination";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { BookCollection } from "@/types/books";
import type { Dictionary } from "@/types/i18n";

/**
 * One shelf, rendered by both /documents (two lists, 0074) and /admin-info
 * (one). Extracted rather than copied so the two cannot drift — the second
 * page is the same feature with a different collection pinned, and a
 * near-copy would mean every later fix has to be found twice.
 */

/**
 * Isolated behind its own Suspense + CardBoundary so a failing
 * getBookYears() (unconfigured Supabase, a network blip, RLS) degrades to
 * an error card in place of the filter bar rather than taking the whole
 * route down — the exact fatal-Promise.all shape this page used to have
 * (see CLAUDE.md's §0 "documents" fix entry).
 */
async function BooksFiltersSection({
  collection,
  lang,
  dict,
}: {
  collection: BookCollection;
  lang: Locale;
  dict: Dictionary;
}) {
  const years = await getBookYears(collection);
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

  // Two batched Storage calls for the whole page rather than two per card.
  const [coverUrls, pdfUrls] = await Promise.all([
    getSignedUrlMap("book-covers", rows.flatMap((b) => (b.coverPath ? [b.coverPath] : []))),
    getSignedUrlMap("books", rows.flatMap((b) => (b.pdfPath ? [b.pdfPath] : []))),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BooksShelf
        books={rows}
        coverUrls={coverUrls}
        pdfUrls={pdfUrls}
        viewerId={user?.id ?? null}
        isStaff={isStaff}
        lang={lang}
        dict={dict}
      />
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

export async function BookShelfPage({
  collection,
  title,
  description,
  pathname,
  rawParams,
  tabs,
  lang,
  dict,
}: {
  collection: BookCollection;
  title: string;
  description: string;
  pathname: string;
  rawParams: Record<string, string | string[] | undefined>;
  /** The 11 ดี / 11 เก่ง switcher. Absent on the single-list shelf. */
  tabs?: ReactNode;
  lang: Locale;
  dict: Dictionary;
}) {
  const role = await getRole();

  const filters = parseBooksSearchParams(rawParams, collection);
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );
  const suspenseKey = JSON.stringify(filters);
  // document:draft:submit, NOT workspace:access — a read-only student holds
  // the latter, but books_insert_own (0028/0049) only admits aft/teacher/admin,
  // so the button would have opened a form whose save could never succeed.
  const canAdd = can(role, "document:draft:submit");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {canAdd ? (
          <Button
            nativeButton={false}
            render={<Link href={`/${lang}/books/new?collection=${collection}`} />}
          >
            <Plus className="size-4" aria-hidden />
            {dict.documents.addBookCta}
          </Button>
        ) : null}
      </div>

      {tabs}

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Suspense fallback={<BooksFiltersSkeleton />}>
          <BooksFiltersSection collection={collection} lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Suspense key={suspenseKey} fallback={<BooksShelfSkeleton />}>
          <BooksResults
            filters={filters}
            pathname={pathname}
            searchParams={searchParams}
            lang={lang}
            dict={dict}
          />
        </Suspense>
      </CardBoundary>
    </div>
  );
}
