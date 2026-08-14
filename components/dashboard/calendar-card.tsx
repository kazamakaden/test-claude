import { Card, CardHeader, CardTitle, CardAction, CardDescription, CardContent } from "@/components/ui/card";
import { getMonthActivities } from "@/services/activities";
import { getHolidays } from "@/services/holidays";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { CalendarGrid } from "@/components/dashboard/calendar-grid";
import { CalendarMonthNav } from "@/components/dashboard/calendar-month-nav";
import { HolidayList } from "@/components/dashboard/holiday-list";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Server shell only — fetches the displayed month's activities and the
 * viewer's activity:manage capability (aft_teacher/admin, 0011), then hands
 * both to CalendarGrid (the client boundary that owns click state and the
 * day sheet). `month` comes from the dashboard page's `?month=` URL param
 * (schemas/calendar.ts#parseMonthParam, same contract /calendar already
 * uses) — CalendarMonthNav pages it with plain <Link>s, so month navigation
 * works with JS disabled. `todayIso` is separately computed once here and
 * passed down as a stable string, rather than letting CalendarGrid call
 * `new Date()` itself — a live clock read inside a Client Component would
 * risk a hydration mismatch if the server render and the browser hydration
 * straddle midnight, and CalendarGrid needs a real "today" independent of
 * whatever month is currently being viewed.
 *
 * ปฏิทิน and ปฏิทินวันหยุด (HolidayList) share this one card and now share
 * one data fetch: `getHolidays()` is awaited here, alongside events/role,
 * so the SAME holiday list that renders in the side panel is also what
 * marks day cells in the month grid and shows up in the day sheet — one
 * source of truth, not two independent reads that could drift. This
 * deliberately trades the previous pass's "don't block the grid on a
 * third-party fetch" isolation for that sync guarantee; `getHolidays()`
 * already fails soft to `[]` on any network/parse problem
 * (services/holidays.ts), so a slow/unreachable calendar host degrades to
 * "no holidays marked," not a broken card.
 */
export async function CalendarCard({
  month,
  lang,
  dict,
}: {
  month: Date;
  lang: Locale;
  dict: Dictionary;
}) {
  const today = new Date();
  const [events, role, holidayFeed] = await Promise.all([
    getMonthActivities(month),
    getRole(),
    getHolidays(lang, month),
  ]);
  const d = dict.dashboard.calendar;
  const canManage = can(role, "activity:manage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
        <CardAction>
          <CalendarMonthNav
            month={month}
            todayIso={today.toISOString()}
            pathname={`/${lang}/dashboard`}
            lang={lang}
            dict={dict}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <CalendarGrid
            monthIso={month.toISOString()}
            todayIso={today.toISOString()}
            events={events}
            holidays={holidayFeed.holidays}
            canManage={canManage}
            lang={lang}
            dict={dict}
          />
          <div className="border-t pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            <HolidayList feed={holidayFeed} lang={lang} dict={dict} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
