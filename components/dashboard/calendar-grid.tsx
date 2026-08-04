"use client";

import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarDaySheet } from "@/components/dashboard/calendar-day-sheet";
import type { MonthActivity } from "@/types/activities";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const WEEKDAY_KEYS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const WEEKDAY_KEYS_EN = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Client boundary for the dashboard's calendar: owns which day is
 * selected and renders CalendarDaySheet on top of the grid. Day cells are
 * real <button>s (not a <div onClick>) so they stay keyboard-reachable
 * (§24) — Enter/Space opens the sheet the same as a click.
 */
export function CalendarGrid({
  todayIso,
  events,
  canManage,
  lang,
  dict,
}: {
  todayIso: string;
  events: MonthActivity[];
  canManage: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const today = new Date(todayIso);
  const weekdayLabels = lang === "th" ? WEEKDAY_KEYS_TH : WEEKDAY_KEYS_EN;

  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.startsAt), day));

  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="py-1 font-medium">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, today);
          const today_ = isToday(day);
          const hasEvent = eventsForDay(day).length > 0;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDate(day)}
              aria-current={today_ ? "date" : undefined}
              aria-label={today_ ? `${dict.dashboard.calendar.today} ${format(day, "d")}` : format(day, "d")}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                !inMonth && "text-muted-foreground/40",
                today_ && "bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
              )}
            >
              {format(day, "d")}
              {hasEvent && !today_ ? (
                <span className="absolute bottom-1 size-1 rounded-full bg-accent-glow" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      <CalendarDaySheet
        date={selectedDate}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
        events={selectedDate ? eventsForDay(selectedDate) : []}
        canManage={canManage}
        lang={lang}
        dict={dict}
      />
    </>
  );
}
