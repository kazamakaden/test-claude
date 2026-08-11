import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Presentational only — the count is fetched by NotificationsBell, so this
 * renders identically for the Suspense fallback (count 0) and the resolved
 * state, and the nav never blocks on a notification query.
 *
 * The accessible name carries the count instead of a separate sr-only span:
 * an aria-label overrides element content, so the previous version's extra
 * span was unreachable to a screen reader and the count was never announced.
 */
export function NotificationsButton({
  lang,
  dict,
  unreadCount = 0,
}: {
  lang: Locale;
  dict: Dictionary;
  unreadCount?: number;
}) {
  const d = dict.notifications;
  const label =
    unreadCount > 0
      ? interpolate(d.bellUnread, { count: String(unreadCount) })
      : d.bellLabel;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className="relative"
      nativeButton={false}
      render={<Link href={`/${lang}/notifications`} />}
    >
      <Bell />
      {unreadCount > 0 ? (
        <span
          className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent-glow ring-2 ring-card"
          aria-hidden
        />
      ) : null}
    </Button>
  );
}
