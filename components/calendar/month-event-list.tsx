import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { MapPin } from "lucide-react";
import type { MonthActivity } from "@/types/activities";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDate } from "@/lib/datetime";

/**
 * The same month as a linear list — date, time, title, location. This is
 * what makes /calendar usable at 375px, where MonthGrid's 7-column layout
 * has no room for event chips (MonthGrid hides itself below `md`).
 */
export function MonthEventList({
  events,
  lang,
  dict,
}: {
  events: MonthActivity[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.calendar;
  const locale = lang === "th" ? th : enUS;
  const sorted = [...events].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="font-heading text-base font-medium text-foreground">{d.eventListTitle}</h2>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{d.noEvents}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {sorted.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex w-16 shrink-0 flex-col text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {format(bangkokDate(e.startsAt), "d MMM", { locale })}
                </span>
                <span>{format(bangkokDate(e.startsAt), "HH:mm")}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                {e.location ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden />
                    {e.location}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
