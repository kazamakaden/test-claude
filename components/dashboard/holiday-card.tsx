import { CalendarHeart } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getHolidays } from "@/services/holidays";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * §8 "ปฏิทินวันหยุด" — renders as a plain section beside CalendarCard inside
 * one shared card (dashboard/page.tsx), not its own `<Card>`.
 *
 * getHolidays() returns every future holiday in Google's feed (dozens,
 * spanning years) — too many to show unclipped, so the list still needs to
 * scroll. But it must scroll *within the calendar's height*, not stretch
 * the row to its own (much taller) intrinsic height. Below `xl` this is a
 * normal static block capped at max-h-80, same as before the merge. At
 * `xl`, the root goes `absolute inset-0` inside the page's `relative`
 * grid cell — contributing zero intrinsic height, so the row height is set
 * purely by the calendar column — and the list becomes `flex-1 min-h-0
 * overflow-y-auto` to fill exactly that height and scroll past it.
 */
export async function HolidayCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const holidays = await getHolidays(lang);
  const d = dict.dashboard.holidays;
  const locale = lang === "th" ? th : enUS;

  return (
    <div className="flex flex-col gap-4 xl:absolute xl:inset-0">
      <div className="flex flex-col gap-1">
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </div>
      {holidays.length === 0 ? (
        <CardEmpty icon={CalendarHeart} message={d.empty} ctaLabel={d.emptyCta} ctaHref="/calendar" lang={lang} />
      ) : (
        <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto xl:max-h-none xl:min-h-0 xl:flex-1">
          {holidays.map((h) => (
            <li key={h.date} className="flex flex-col gap-0.5">
              <span className="text-sm text-foreground">{h.name}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(h.date), "d MMM yyyy", { locale })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
