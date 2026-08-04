import { CalendarHeart } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getHolidays } from "@/services/holidays";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * §8 "ปฏิทินวันหยุด" — sits beside CalendarCard (md:col-span-2, so this
 * lands in the otherwise-empty third xl column and stacks below it at
 * smaller widths). A fixed-height internally-scrolling list rather than
 * growing to fit its content, so it stays visually balanced next to the
 * calendar grid instead of stretching the row.
 */
export async function HolidayCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const holidays = await getHolidays(lang);
  const d = dict.dashboard.holidays;
  const locale = lang === "th" ? th : enUS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {holidays.length === 0 ? (
          <CardEmpty icon={CalendarHeart} message={d.empty} ctaLabel={d.emptyCta} ctaHref="/calendar" lang={lang} />
        ) : (
          <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {holidays.map((h) => (
              <li key={h.date} className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">{h.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(h.date), "d MMM yyyy", { locale })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
