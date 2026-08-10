import { CalendarHeart } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getHolidays } from "@/services/holidays";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * §8 "ปฏิทินวันหยุด" — the right-hand panel of the merged calendar card
 * (see CalendarCard), not its own Card: the calendar owns the card chrome,
 * this owns only the heading + list. Rows stack name-over-date instead of
 * sharing one baseline, so a long Thai holiday name gets the panel's full
 * width to wrap in rather than fighting the date for room.
 */
export async function HolidayList({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const holidays = await getHolidays(lang);
  const d = dict.dashboard.holidays;
  const locale = lang === "th" ? th : enUS;

  return (
    <div>
      <h3 className="font-heading text-sm font-medium">{d.title}</h3>
      <p className="text-sm text-muted-foreground">{d.description}</p>

      <div className="mt-4">
        {holidays.length === 0 ? (
          <CardEmpty icon={CalendarHeart} message={d.empty} ctaLabel={d.emptyCta} ctaHref="/calendar" lang={lang} />
        ) : (
          <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
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
    </div>
  );
}
