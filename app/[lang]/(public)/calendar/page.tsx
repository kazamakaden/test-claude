import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getMonthActivities } from "@/services/activities";
import { parseMonthParam } from "@/schemas/calendar";
import { MonthNav } from "@/components/calendar/month-nav";
import { MonthGrid } from "@/components/calendar/month-grid";
import { MonthEventList } from "@/components/calendar/month-event-list";
import type { Locale } from "@/lib/i18n/config";

export default async function CalendarPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const rawParams = await rawSearchParams;
  const monthParam = Array.isArray(rawParams.month) ? rawParams.month[0] : rawParams.month;

  const month = parseMonthParam(monthParam);
  const [dict, events] = await Promise.all([getDictionary(lang), getMonthActivities(month)]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm text-muted-foreground">{dict.calendar.description}</p>
      <MonthNav month={month} pathname={`/${lang}/calendar`} lang={lang} dict={dict} />
      <MonthGrid month={month} events={events} lang={lang} dict={dict} />
      <MonthEventList events={events} lang={lang} dict={dict} />
    </div>
  );
}
