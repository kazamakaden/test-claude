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
import { th, enUS } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCalendarEvents } from "@/services/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const WEEKDAY_KEYS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const WEEKDAY_KEYS_EN = ["M", "T", "W", "T", "F", "S", "S"];

export async function CalendarCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const today = new Date();
  const events = await getCalendarEvents(today);
  const d = dict.dashboard.calendar;
  const locale = lang === "th" ? th : enUS;
  const weekdayLabels = lang === "th" ? WEEKDAY_KEYS_TH : WEEKDAY_KEYS_EN;

  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const hasEvent = (day: Date) => events.some((e) => isSameDay(new Date(e.date), day));

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>
          {format(today, "MMMM yyyy", { locale })} — {d.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {weekdayLabels.map((label, i) => (
            <div key={i} className="py-1 font-medium">
              {label}
            </div>
          ))}
          {days.map((day) => {
            const inMonth = isSameMonth(day, today);
            const today_ = isToday(day);
            return (
              <div
                key={day.toISOString()}
                aria-current={today_ ? "date" : undefined}
                aria-label={today_ ? d.today : undefined}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-md text-sm",
                  !inMonth && "text-muted-foreground/40",
                  today_ && "bg-primary text-primary-foreground font-semibold"
                )}
              >
                {format(day, "d")}
                {hasEvent(day) && !today_ ? (
                  <span
                    className="absolute bottom-1 size-1 rounded-full bg-accent-glow"
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
