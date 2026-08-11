import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { parseNotificationSearchParams, NOTIFICATIONS_PER_PAGE } from "@/schemas/notifications";
import { listNotifications, getUnreadNotificationCount } from "@/services/notifications";
import { NotificationFilters } from "@/components/notifications/notification-filters";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { Pagination } from "@/components/table/pagination";
import type { Locale } from "@/lib/i18n/config";

export default async function NotificationsPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  // §5 lists Notifications under Authenticated only. Re-checked server-side;
  // the nav filter is UI, never the boundary (§19).
  await requirePermission("notification:read", lang);

  const rawParams = await rawSearchParams;
  const dict = await getDictionary(lang);
  const filters = parseNotificationSearchParams(rawParams);

  const [{ rows, total }, unreadCount] = await Promise.all([
    listNotifications(filters),
    getUnreadNotificationCount(),
  ]);

  // `total` is read off the returned rows, so an out-of-range page yields
  // total 0 — and Pagination renders nothing at total 0, which would strand
  // the viewer on an empty page with no link back. Send them to page 1 of the
  // same filter instead of rendering a dead end.
  if (rows.length === 0 && filters.page > 1) {
    const back = new URLSearchParams();
    if (filters.filter !== "all") back.set("filter", filters.filter);
    const query = back.toString();
    redirect(`/${lang}/notifications${query ? `?${query}` : ""}`);
  }

  const pathname = `/${lang}/notifications`;
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );

  const d = dict.notifications;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {d.title}
          </h1>
          <p className="text-sm text-muted-foreground">{d.description}</p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton lang={lang} dict={dict} />}
      </div>

      <NotificationFilters
        active={filters.filter}
        unreadCount={unreadCount}
        lang={lang}
        dict={dict}
      />

      <div className="flex flex-col gap-4">
        <NotificationsList
          notifications={rows}
          filter={filters.filter}
          lang={lang}
          dict={dict}
        />
        <Pagination
          page={filters.page}
          perPage={NOTIFICATIONS_PER_PAGE}
          total={total}
          pathname={pathname}
          searchParams={searchParams}
          dict={dict}
        />
      </div>
    </div>
  );
}
