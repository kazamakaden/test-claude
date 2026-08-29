import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { getMonthActivities } from "@/services/activities";
import { parseMonthParam } from "@/schemas/calendar";
import { MonthNav } from "@/components/calendar/month-nav";
import { MonthGrid } from "@/components/calendar/month-grid";
import { MonthEventList } from "@/components/calendar/month-event-list";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import type { Locale } from "@/lib/i18n/config";

/**
 * Two pages behind one route.
 *
 * A guest gets the plain public month view this page has always been. A
 * signed-in viewer gets the full §8 dashboard grid, which moved here when
 * /{lang}/dashboard was folded away — it carries its own month grid and Thai
 * holiday panel, so rendering the simple view as well would put two calendars
 * on one page.
 *
 * `workspace:access` is the same predicate the old (app) route group's layout
 * enforced, so nothing became visible to a role that could not already see it.
 * It is a display split, not the security boundary: every service behind those
 * cards is RLS-scoped to the caller on its own.
 */
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
  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);

  if (can(role, "workspace:access")) {
    return <DashboardGrid month={month} role={role} lang={lang} dict={dict} />;
  }

  const events = await getMonthActivities(month);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm text-muted-foreground">{dict.calendar.description}</p>
      <MonthNav month={month} pathname={`/${lang}/calendar`} lang={lang} dict={dict} />
      <MonthGrid month={month} events={events} lang={lang} dict={dict} />
      <MonthEventList events={events} lang={lang} dict={dict} />
    </div>
  );
}
