import { Suspense } from "react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
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

async function ActivityStatsChart({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const stats = await getActivityStats();
  return <ActivityStatsCard stats={stats} lang={lang} dict={dict} />;
}

async function MemberStatsChart({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const stats = await getMemberStats(lang);
  return <MemberStatsCard stats={stats} lang={lang} dict={dict} />;
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);
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

      <div className="md:col-span-2 xl:col-span-3">
        <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
          <Suspense fallback={<CalendarCardSkeleton />}>
            <CalendarCard lang={lang} dict={dict} />
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

      <QuickActionsCard role={role} lang={lang} dict={dict} />
    </div>
  );
}
