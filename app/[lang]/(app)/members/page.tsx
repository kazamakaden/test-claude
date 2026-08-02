import { Suspense } from "react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { parseMembersSearchParams, PER_PAGE_SIZE } from "@/schemas/members";
import { getClubs, getDepartments, getFilterOptions, getMembers } from "@/services/members";
import { MembersFilters } from "@/components/members/members-filters";
import { MembersTable } from "@/components/members/members-table";
import { MembersPagination } from "@/components/members/members-pagination";
import { MembersTableSkeleton } from "@/components/members/members-table-skeleton";

async function MembersResults({
  filters,
  pathname,
  searchParams,
  lang,
  dict,
}: {
  filters: ReturnType<typeof parseMembersSearchParams>;
  pathname: string;
  searchParams: URLSearchParams;
  lang: Locale;
  dict: Dictionary;
}) {
  const { rows, total } = await getMembers(filters);

  return (
    <div className="flex flex-col gap-4">
      <MembersTable
        members={rows}
        filters={filters}
        pathname={pathname}
        searchParams={searchParams}
        lang={lang}
        dict={dict}
      />
      <MembersPagination
        page={filters.page}
        perPage={PER_PAGE_SIZE}
        total={total}
        pathname={pathname}
        searchParams={searchParams}
        dict={dict}
      />
    </div>
  );
}

export default async function MembersPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const rawParams = await rawSearchParams;
  const [dict, departments, clubs, filterOptions] = await Promise.all([
    getDictionary(lang),
    getDepartments(),
    getClubs(),
    getFilterOptions(),
  ]);

  const filters = parseMembersSearchParams(rawParams);
  const pathname = `/${lang}/members`;
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );
  const suspenseKey = JSON.stringify(filters);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {dict.nav.members}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.members.description}</p>
      </div>

      <MembersFilters
        departments={departments}
        clubs={clubs}
        years={filterOptions.years}
        classNames={filterOptions.classNames}
        dict={dict}
      />

      <Suspense key={suspenseKey} fallback={<MembersTableSkeleton />}>
        <MembersResults
          filters={filters}
          pathname={pathname}
          searchParams={searchParams}
          lang={lang}
          dict={dict}
        />
      </Suspense>
    </div>
  );
}
