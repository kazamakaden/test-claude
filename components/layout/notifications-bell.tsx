import { NotificationsButton } from "@/components/layout/notifications-button";
import { getUnreadNotificationCount } from "@/services/notifications";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Split from the button so the count can stream in behind <Suspense>: the top
 * nav renders on every page, and making it await a notification query would
 * delay every route's first byte for a decorative dot.
 */
export async function NotificationsBell({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const unreadCount = await getUnreadNotificationCount();

  return <NotificationsButton lang={lang} dict={dict} unreadCount={unreadCount} />;
}
