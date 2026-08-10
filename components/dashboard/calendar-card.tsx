import { Suspense } from "react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getMonthActivities } from "@/services/activities";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { CalendarGrid } from "@/components/dashboard/calendar-grid";
import { HolidayList } from "@/components/dashboard/holiday-list";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import { ListCardSkeleton } from "@/components/dashboard/dashboard-skeletons";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Server shell only — fetches the month's activities and the viewer's
 * activity:manage capability (aft_teacher/admin, 0011), then hands both to
 * CalendarGrid (the client boundary that owns click state and the day
 * sheet). `todayIso` is computed once here and passed down as a stable
 * string, rather than letting CalendarGrid call `new Date()` itself — a
 * live clock read inside a Client Component would risk a hydration
 * mismatch if the server render and the browser hydration straddle
 * midnight.
 *
 * ปฏิทิน and ปฏิทินวันหยุด (HolidayList) share this one card — a two-column
 * split at `xl`, stacked with a divider below `xl` — rather than being two
 * separate cards. HolidayList gets its own Suspense/CardBoundary here
 * because it does a live fetch to a third-party calendar host
 * (services/holidays.ts) that must not block the month grid from
 * streaming, and must not take the whole merged card down if that host is
 * unreachable.
 */
export async function CalendarCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const today = new Date();
  const [events, role] = await Promise.all([getMonthActivities(today), getRole()]);
  const d = dict.dashboard.calendar;
  const locale = lang === "th" ? th : enUS;
  const canManage = can(role, "activity:manage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>
          {format(today, "MMMM yyyy", { locale })} — {d.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <CalendarGrid
            todayIso={today.toISOString()}
            events={events}
            canManage={canManage}
            lang={lang}
            dict={dict}
          />
          <div className="border-t pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            <CardBoundary errorTitle={dict.dashboard.errorTitle} retryLabel={dict.dashboard.errorRetry}>
              <Suspense fallback={<ListCardSkeleton />}>
                <HolidayList lang={lang} dict={dict} />
              </Suspense>
            </CardBoundary>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
