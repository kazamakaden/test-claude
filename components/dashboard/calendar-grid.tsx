"use client";

import { useEffect, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  format,
  isSameMonth,
  isSameDay,
} from "date-fns";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { CalendarDaySheet } from "@/components/dashboard/calendar-day-sheet";
import type { MonthActivity } from "@/types/activities";
import type { Holiday } from "@/types/holidays";
import type { Database } from "@/types/database";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const WEEKDAY_KEYS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const WEEKDAY_KEYS_EN = ["M", "T", "W", "T", "F", "S", "S"];

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

/** Same field mapping as services/activities.ts#getMonthActivities — duplicated,
 * not imported, since that module is `server-only` and this is a Client
 * Component reading the raw postgres_changes row directly. */
function toMonthActivity(row: ActivityRow): MonthActivity {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
  };
}

/**
 * Client boundary for the dashboard's calendar: owns which day is
 * selected and renders CalendarDaySheet on top of the grid. Day cells are
 * real <button>s (not a <div onClick>) so they stay keyboard-reachable
 * (§24) — Enter/Space opens the sheet the same as a click.
 *
 * `holidays` is the same list HolidayList renders beside this grid
 * (fetched once by CalendarCard) — matched here by ISO date so a holiday
 * day gets a ring + tinted date number in the grid itself, and its name
 * surfaces in CalendarDaySheet when that day is opened, keeping the panel
 * and the grid in sync rather than two independent views of holidays.
 *
 * `monthIso` is the month being *displayed* (driven by the dashboard's
 * `?month=` URL param, CalendarMonthNav) — independent of `todayIso`,
 * which is always the real current day. Comparing cells against `todayIso`
 * (not date-fns's `isToday()`, which reads the browser clock directly)
 * keeps the "today" highlight correct even while a past/future month is
 * being viewed, and preserves the original hydration-safety intent: the
 * server and the client agree on what "today" is because they're both
 * reading the same passed-down value.
 *
 * `initialEvents` seeds local state rather than being read directly, so a
 * live `postgres_changes` subscription (0035_activities_realtime.sql) can
 * append/replace/remove entries as staff add/edit/delete activities —
 * §10's "realtime" half, applied here first since the calendar is where it
 * matters most. Supabase evaluates the connecting viewer's own SELECT RLS
 * before delivering a change, the same scoping a manual refetch would get,
 * so this never shows a row the viewer couldn't already query directly.
 * State resets from `initialEvents` whenever the server-provided list
 * changes (a month navigation re-render), so paging months doesn't leave
 * stale realtime-appended rows from the previously viewed month behind.
 */
export function CalendarGrid({
  monthIso,
  todayIso,
  events: initialEvents,
  holidays,
  canManage,
  lang,
  dict,
}: {
  monthIso: string;
  todayIso: string;
  events: MonthActivity[];
  holidays: Holiday[];
  canManage: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const month = new Date(monthIso);
  const today = new Date(todayIso);
  const weekdayLabels = lang === "th" ? WEEKDAY_KEYS_TH : WEEKDAY_KEYS_EN;

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    // createClient() (lib/supabase/client.ts) asserts its env vars are
    // present and throws immediately when they're not — fine for a write
    // action, but this runs inside an effect with no local error boundary
    // of its own, so an unconfigured environment (no live Supabase project,
    // this dev-fixture path) would otherwise bubble up to the page's
    // CardBoundary and take the whole calendar card down. Same
    // fail-soft-when-unconfigured discipline this project already applies
    // via tryCreateClient() on the server side (services/*.ts) — realtime
    // is a progressive enhancement, not a hard requirement.
    if (!isSupabaseConfigured) return;

    const rangeStart = startOfMonth(new Date(monthIso)).toISOString();
    const rangeEnd = startOfMonth(addMonths(new Date(monthIso), 1)).toISOString();

    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-activities-${monthIso}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities" },
        (payload: RealtimePostgresChangesPayload<ActivityRow>) => {
          if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            if (!deletedId) return;
            setEvents((prev) => prev.filter((e) => e.id !== deletedId));
            return;
          }

          const mapped = toMonthActivity(payload.new);
          const stillInMonth = mapped.startsAt >= rangeStart && mapped.startsAt < rangeEnd;
          setEvents((prev) => {
            const withoutExisting = prev.filter((e) => e.id !== mapped.id);
            if (!stillInMonth) return withoutExisting;
            return [...withoutExisting, mapped].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [monthIso]);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.startsAt), day));
  const holidayForDay = (day: Date) => holidays.find((h) => h.date === format(day, "yyyy-MM-dd"));

  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="py-1 font-medium">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const today_ = isSameDay(day, today);
          const hasEvent = eventsForDay(day).length > 0;
          const holiday = holidayForDay(day);
          const dayLabel = today_ ? `${dict.dashboard.calendar.today} ${format(day, "d")}` : format(day, "d");
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDate(day)}
              aria-current={today_ ? "date" : undefined}
              aria-label={holiday ? `${dayLabel} — ${dict.dashboard.calendar.holidayLabel}: ${holiday.name}` : dayLabel}
              className={cn(
                "relative flex h-12 items-center justify-center rounded-md text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                !inMonth && "text-muted-foreground/40",
                holiday && !today_ && "text-primary ring-1 ring-inset ring-primary/30",
                today_ && "bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
              )}
            >
              {format(day, "d")}
              {hasEvent && !today_ ? (
                <span className="absolute bottom-1 size-1 rounded-full bg-accent-glow" aria-hidden />
              ) : null}
              {holiday ? (
                <span
                  className={cn(
                    "absolute top-1 size-1 rounded-full",
                    today_ ? "bg-primary-foreground" : "bg-primary"
                  )}
                  aria-hidden
                />
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
        holiday={selectedDate ? (holidayForDay(selectedDate) ?? null) : null}
        canManage={canManage}
        lang={lang}
        dict={dict}
      />
    </>
  );
}
