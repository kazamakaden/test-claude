import Link from "next/link";
import { addMonths, format, subMonths } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonthParam } from "@/schemas/calendar";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/** Plain <Link>s (not client-side handlers) — navigation works with JS disabled. */
export function MonthNav({
  month,
  pathname,
  lang,
  dict,
}: {
  month: Date;
  pathname: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.calendar;
  const locale = lang === "th" ? th : enUS;

  const hrefFor = (target: Date) => `${pathname}?month=${formatMonthParam(target)}`;

  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
        {format(month, "MMMM yyyy", { locale })}
      </h1>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          nativeButton={false}
          render={<Link href={hrefFor(subMonths(month, 1))} aria-label={d.previousMonth} />}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={pathname} />}
        >
          {d.today}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          nativeButton={false}
          render={<Link href={hrefFor(addMonths(month, 1))} aria-label={d.nextMonth} />}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
