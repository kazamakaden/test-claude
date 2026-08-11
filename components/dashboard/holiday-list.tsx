import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { CardEmpty } from "@/components/dashboard/card-states";
import type { Holiday } from "@/types/holidays";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * §8 "ปฏิทินวันหยุด" — the right-hand panel of the merged calendar card
 * (see CalendarCard), not its own Card: the calendar owns the card chrome,
 * this owns only the heading + list. Purely presentational — `holidays` is
 * fetched once by CalendarCard and shared with CalendarGrid, so this list
 * and the grid's day markers can never disagree.
 */
export function HolidayList({ holidays, lang, dict }: { holidays: Holiday[]; lang: Locale; dict: Dictionary }) {
  const d = dict.dashboard.holidays;
  const locale = lang === "th" ? th : enUS;

  // The array from getHolidays() also covers the month currently displayed in
  // the grid, which may be in the past (so past months still get day markers).
  // This panel is specifically "upcoming holidays", so it filters those out
  // rather than listing dates that have already been and gone.
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = holidays.filter((h) => h.date >= todayIso);

  return (
    <div className="flex flex-col">
      <h3 className="font-heading text-sm font-medium">{d.title}</h3>
      <p className="text-sm text-muted-foreground">{d.description}</p>

      {/* Explicit max-height, not `h-full`/`flex-1`: those only constrain when
          the PARENT is bounded, and this panel's grid row is sized by its
          tallest child — itself — so the list stretched instead of scrolling
          and dragged the whole card past the viewport. A fixed cap holds for
          any list length. */}
      <div className="mt-4">
        {upcoming.length === 0 ? (
          <CardEmpty icon={CalendarHeart} message={d.empty} ctaLabel={d.emptyCta} ctaHref="/calendar" lang={lang} />
        ) : (
          <ul data-holiday-scroll className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
            {upcoming.map((h) => (
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

      {upcoming.length > 0 ? (
        <Link
          href={`/${lang}/calendar`}
          className="mt-3 rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {d.emptyCta}
        </Link>
      ) : null}
    </div>
  );
}
