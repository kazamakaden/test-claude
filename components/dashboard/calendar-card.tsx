import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { getMonthActivities } from "@/services/activities";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { CalendarGrid } from "@/components/dashboard/calendar-grid";
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
 * Renders as a plain section, not its own `<Card>` — the dashboard page
 * mounts one shared card containing this and HolidayCard side by side, so
 * the holiday list's height can be driven by this column (see
 * holiday-card.tsx's docblock).
 */
export async function CalendarCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const today = new Date();
  const [events, role] = await Promise.all([getMonthActivities(today), getRole()]);
  const d = dict.dashboard.calendar;
  const locale = lang === "th" ? th : enUS;
  const canManage = can(role, "activity:manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>
          {format(today, "MMMM yyyy", { locale })} — {d.description}
        </CardDescription>
      </div>
      {/* CalendarGrid returns a fragment (grid + CalendarDaySheet) — wrapped
          in a div so it behaves as one flex item, not two, under gap-4. */}
      <div>
        <CalendarGrid
          todayIso={today.toISOString()}
          events={events}
          canManage={canManage}
          lang={lang}
          dict={dict}
        />
      </div>
    </div>
  );
}
