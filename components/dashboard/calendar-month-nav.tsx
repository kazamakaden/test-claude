import Link from "next/link";
import { addMonths, format, isSameMonth, subMonths } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonthParam } from "@/schemas/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Compact `‹ สิงหาคม 2026 ›` — the dashboard calendar's CardAction, not
 * `components/calendar/month-nav.tsx`'s full `/calendar` page header (that
 * one renders its own <h1>, which would both duplicate CardTitle and
 * visually dwarf a dashboard card). Shares the same URL contract, though:
 * plain <Link>s built with the same `formatMonthParam` schemas/calendar.ts
 * already exports, so paging works with JS disabled exactly like /calendar.
 * "วันนี้" only appears once the viewed month has actually moved away from
 * the real current month, read from `todayIso` — the same server-computed
 * value CalendarGrid uses, not a fresh `new Date()` here.
 */
export function CalendarMonthNav({
  month,
  todayIso,
  pathname,
  lang,
  dict,
}: {
  month: Date;
  todayIso: string;
  pathname: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.calendar;
  const locale = lang === "th" ? th : enUS;
  const today = new Date(todayIso);
  const isCurrentMonth = isSameMonth(month, today);

  const hrefFor = (target: Date) => `${pathname}?month=${formatMonthParam(target)}`;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href={hrefFor(subMonths(month, 1))} aria-label={d.previousMonth} />}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <span className="min-w-28 text-center text-sm font-medium">
        {format(month, "MMMM yyyy", { locale })}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href={hrefFor(addMonths(month, 1))} aria-label={d.nextMonth} />}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
      {!isCurrentMonth ? (
        <Button
          variant="outline"
          size="xs"
          nativeButton={false}
          render={<Link href={pathname} />}
        >
          {d.today}
        </Button>
      ) : null}
    </div>
  );
}
