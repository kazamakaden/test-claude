import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getMonthActivities } from "@/services/activities";
import { getHolidays } from "@/services/holidays";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { CalendarGrid } from "@/components/dashboard/calendar-grid";
import { HolidayList } from "@/components/dashboard/holiday-list";
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
export async function CalendarCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const today = new Date();
  const [events, role, holidays] = await Promise.all([
    getMonthActivities(today),
    getRole(),
    getHolidays(lang),
  ]);
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
            holidays={holidays}
            canManage={canManage}
            lang={lang}
            dict={dict}
          />
          <div className="border-t pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            <HolidayList holidays={holidays} lang={lang} dict={dict} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
