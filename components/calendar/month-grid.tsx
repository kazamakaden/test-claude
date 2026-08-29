import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { MonthActivity } from "@/types/activities";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDayKey } from "@/lib/datetime";

const WEEKDAY_KEYS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const WEEKDAY_KEYS_EN = ["M", "T", "W", "T", "F", "S", "S"];
const MAX_CHIPS_PER_DAY = 2;

/**
 * Full-size version of components/dashboard/calendar-card.tsx's mini
 * calendar: same Monday-first grid and isToday highlight, but each cell
 * shows up to MAX_CHIPS_PER_DAY event titles plus a "+N" overflow indicator
 * instead of just a dot. At 375px there's no room for this grid at all — see
 * month-event-list.tsx, which is what renders there instead.
 */
export function MonthGrid({
  month,
  events,
  lang,
  dict,
}: {
  month: Date;
  events: MonthActivity[];
  lang: Locale;
  dict: Dictionary;
}) {
  const locale = lang === "th";
  const weekdayLabels = locale ? WEEKDAY_KEYS_TH : WEEKDAY_KEYS_EN;

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Bucket by the event's BANGKOK day, not the runtime's. isSameDay(new Date(iso))
  // compares in whatever timezone the code happens to run in, so on Vercel (UTC)
  // an activity at 00:30 Bangkok landed on the previous day's cell. The day cell
  // itself is already a plain calendar date, so its own fields are the key --
  // the same shape holidayForDay uses just below.
  const eventsForDay = (day: Date) =>
    events.filter((e) => bangkokDayKey(e.startsAt) === format(day, "yyyy-MM-dd"));

  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted-foreground">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const dayEvents = eventsForDay(day);
          const visible = dayEvents.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = dayEvents.length - visible.length;
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              aria-current={today ? "date" : undefined}
              className={cn(
                "flex min-h-24 flex-col gap-1 border-b border-r border-border p-1.5 last:border-r-0",
                !inMonth && "bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs",
                  !inMonth && "text-muted-foreground/40",
                  today && "bg-primary font-semibold text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((e) => (
                  <span
                    key={e.id}
                    className="truncate rounded-md bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground"
                    title={e.title}
                  >
                    {e.title}
                  </span>
                ))}
                {overflow > 0 ? (
                  <span className="px-1.5 text-[11px] text-muted-foreground">
                    {dict.calendar.moreEvents.replace("{count}", String(overflow))}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
