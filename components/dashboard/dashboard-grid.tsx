import { Suspense } from "react";
import { can } from "@/lib/auth/permissions";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { NotificationsCard } from "@/components/dashboard/notifications-card";
import { UpcomingMeetingsCard } from "@/components/dashboard/upcoming-meetings-card";
import { CalendarCard } from "@/components/dashboard/calendar-card";
import { ActivityStatsCard } from "@/components/dashboard/activity-stats-card";
import { DraftDocumentsCard } from "@/components/dashboard/draft-documents-card";
import { RecentProjectsCard } from "@/components/dashboard/recent-projects-card";
import { RecentActivitiesCard } from "@/components/dashboard/recent-activities-card";
import { MemberStatsCard } from "@/components/dashboard/member-stats-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import {
  ListCardSkeleton,
  ChartCardSkeleton,
  CalendarCardSkeleton,
  WelcomeCardSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { getActivityStats, getMemberStats } from "@/services/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

async function ActivityStatsChart({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const { stats, attendanceScope } = await getActivityStats();
  return (
    <ActivityStatsCard
      stats={stats}
      attendanceScope={attendanceScope}
      lang={lang}
      dict={dict}
    />
  );
}

async function MemberStatsChart({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const stats = await getMemberStats(lang);
  return <MemberStatsCard stats={stats} lang={lang} dict={dict} />;
}

/**
 * The §8 dashboard grid. Lived at /{lang}/dashboard until that route was
 * folded into /{lang}/calendar — the ten cards moved here unchanged so the
 * calendar page can render them for a signed-in viewer and the plain public
 * month view for a guest, without either page owning the other's JSX.
 *
 * Every card keeps its own <Suspense> + CardBoundary. That per-card isolation
 * is the whole reason one failing card cannot take the grid down (§30.7), and
 * it would have been easy to lose in the move.
 *
 * The caller is responsible for the permission gate — this component renders
 * whatever it is given. /calendar checks `workspace:access` before reaching
 * for it; the services behind these cards enforce RLS on their own regardless.
 */
export function DashboardGrid({
  month,
  role,
  lang,
  dict,
}: {
  month: Date;
  role: Role;
  lang: Locale;
  dict: Dictionary;
}) {
  const isReviewer = can(role, "project:draft:review");

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-8 sm:px-6 md:grid-cols-2 lg:px-8 xl:grid-cols-3">
      <Suspense fallback={<WelcomeCardSkeleton />}>
        <WelcomeCard role={role} dict={dict} />
      </Suspense>

      <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
        <Suspense fallback={<ListCardSkeleton />}>
          <NotificationsCard lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
        <Suspense fallback={<ListCardSkeleton />}>
          <UpcomingMeetingsCard lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      <QuickActionsCard role={role} lang={lang} dict={dict} />

      <div className="md:col-span-2 xl:col-span-3">
        <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
          <Suspense fallback={<CalendarCardSkeleton />}>
            <CalendarCard month={month} lang={lang} dict={dict} />
          </Suspense>
        </CardBoundary>
      </div>

      <div className="md:col-span-2">
        <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
          <Suspense fallback={<ChartCardSkeleton />}>
            <ActivityStatsChart lang={lang} dict={dict} />
          </Suspense>
        </CardBoundary>
      </div>

      <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
        <Suspense fallback={<ListCardSkeleton />}>
          <DraftDocumentsCard role={role} lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
        <Suspense fallback={<ListCardSkeleton />}>
          <RecentProjectsCard lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
        <Suspense fallback={<ListCardSkeleton />}>
          <RecentActivitiesCard lang={lang} dict={dict} />
        </Suspense>
      </CardBoundary>

      {isReviewer ? (
        <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
          <Suspense fallback={<ChartCardSkeleton />}>
            <MemberStatsChart lang={lang} dict={dict} />
          </Suspense>
        </CardBoundary>
      ) : null}
    </div>
  );
}
