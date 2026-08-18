import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-role";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAttendanceReport, getMemberReport, getWorkflowReport } from "@/services/reports";
import { getDepartments } from "@/services/members";
import { parseReportSearchParams, type ReportFilters } from "@/schemas/reports";
import { ReportFiltersForm } from "@/components/reports/report-filters";
import {
  AttendanceReportTable,
  MemberReportTable,
  WorkflowReportTable,
} from "@/components/reports/report-tables";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * §18 reports, staff only.
 *
 * `report:view` (aft/teacher/admin), not `workspace:access` — the latter is
 * held by a read-only `student`, who has no §6 basis for org-wide figures.
 * Each RPC re-checks the same boundary for itself (assert_report_viewer,
 * 0058), because they are reachable over REST without this page.
 *
 * Each section is its own async child under <Suspense> + CardBoundary, the
 * §30.7 pattern: three independent aggregates, and one failing must not take
 * the other two down. That is not hypothetical here — it is exactly the
 * failure mode /documents shipped with before CardBoundary was applied to it.
 */

function TableSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

async function AttendanceSection({
  filters,
  lang,
  dict,
}: {
  filters: ReportFilters;
  lang: Locale;
  dict: Dictionary;
}) {
  const rows = await getAttendanceReport(filters);
  return <AttendanceReportTable rows={rows} dict={dict} lang={lang} />;
}

async function MemberSection({ dict }: { dict: Dictionary }) {
  const rows = await getMemberReport();
  return <MemberReportTable rows={rows} dict={dict} />;
}

async function WorkflowSection({ dict }: { dict: Dictionary }) {
  const rows = await getWorkflowReport();
  return <WorkflowReportTable rows={rows} dict={dict} />;
}

async function FiltersSection({
  filters,
  lang,
  dict,
}: {
  filters: ReportFilters;
  lang: Locale;
  dict: Dictionary;
}) {
  const departments = await getDepartments();
  return (
    <ReportFiltersForm filters={filters} departments={departments} lang={lang} dict={dict} />
  );
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  await requirePermission("report:view", lang);

  const dict = await getDictionary(lang);
  const filters = parseReportSearchParams(await searchParams);

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="size-4" aria-hidden="true" />
          {dict.nav.reports}
        </span>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{dict.nav.reports}</h1>
        <p className="text-sm text-muted-foreground">{dict.reports.description}</p>
      </header>

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
          <FiltersSection filters={filters} lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Suspense fallback={<TableSkeleton />}>
          <AttendanceSection filters={filters} lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      <div className="grid gap-6 lg:grid-cols-2">
        <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
          <Suspense fallback={<TableSkeleton />}>
            <MemberSection dict={dict} />
          </Suspense>
        </CardBoundary>

        <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
          <Suspense fallback={<TableSkeleton />}>
            <WorkflowSection dict={dict} />
          </Suspense>
        </CardBoundary>
      </div>
    </main>
  );
}
