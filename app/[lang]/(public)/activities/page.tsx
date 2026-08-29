import { Suspense } from "react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { getRole, getSessionUserId } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { parseActivitiesSearchParams, ACTIVITIES_PER_PAGE_SIZE } from "@/schemas/activities";
import { listActivities, getActivityCounts } from "@/services/activities";
import { getDepartments, getClubs, getFilterOptions } from "@/services/members";
import { ActivitiesFilters } from "@/components/activities/activities-filters";
import { ActivitiesTable } from "@/components/activities/activities-table";
import { ActivitiesStats } from "@/components/activities/activities-stats";
import { Pagination } from "@/components/table/pagination";
import { redirectIfPageOutOfRange } from "@/lib/pagination";
import { ActivitiesTableSkeleton } from "@/components/activities/activities-table-skeleton";
import type { ActivityFilters } from "@/types/activities";

async function ActivitiesResults({
  filters,
  pathname,
  searchParams,
  lang,
  dict,
}: {
  filters: ActivityFilters;
  pathname: string;
  searchParams: URLSearchParams;
  lang: Locale;
  dict: Dictionary;
}) {
  // Who the viewer is and what they hold, for the per-row delete affordance.
  // Mirrors activities_delete_owner (0061) — owner OR admin — and nothing
  // more: deleteActivityAction re-checks and RLS refuses regardless, so this
  // only decides whether the button is offered.
  //
  // getSessionUserId(), not a Supabase client opened here: it is what
  // getRole() already reads and it is cache()d, so the pair costs one round
  // trip rather than two. Every other page that needs "who is looking at
  // this" (documents/manage, projects/[id]) uses it for the same reason.
  const [{ rows, total }, counts, role, viewerId] = await Promise.all([
    listActivities(filters),
    getActivityCounts(),
    getRole(),
    getSessionUserId(),
  ]);

  redirectIfPageOutOfRange({ rows, page: filters.page, pathname, searchParams });

  return (
    <div className="flex flex-col gap-4">
      <ActivitiesStats
        counts={counts}
        activeStatus={filters.status}
        pathname={pathname}
        searchParams={searchParams}
        dict={dict}
      />
      <ActivitiesTable
        activities={rows}
        filters={filters}
        pathname={pathname}
        searchParams={searchParams}
        viewerId={viewerId}
        isAdmin={can(role, "activity:delete")}
        canManage={can(role, "activity:manage")}
        lang={lang}
        dict={dict}
      />
      <Pagination
        page={filters.page}
        perPage={ACTIVITIES_PER_PAGE_SIZE}
        total={total}
        pathname={pathname}
        searchParams={searchParams}
        dict={dict}
      />
    </div>
  );
}

export default async function ActivitiesPage({
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

  const filters = parseActivitiesSearchParams(rawParams);
  const pathname = `/${lang}/activities`;
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
          {dict.nav.activities}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.activities.description}</p>
      </div>

      <ActivitiesFilters
        departments={departments}
        clubs={clubs}
        years={filterOptions.years}
        dict={dict}
      />

      <Suspense key={suspenseKey} fallback={<ActivitiesTableSkeleton />}>
        <ActivitiesResults
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
