import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NotificationFilter } from "@/types/notifications";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Plain links, not a client-side toggle: filtering is URL state (same
 * discipline as Members/Activities), so it survives a reload, is shareable,
 * and works with JavaScript disabled (§30.9 item 3).
 */
export function NotificationFilters({
  active,
  unreadCount,
  lang,
  dict,
}: {
  active: NotificationFilter;
  unreadCount: number;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.notifications.filters;
  const tabs: { key: NotificationFilter; label: string; count?: number }[] = [
    { key: "all", label: d.all },
    { key: "unread", label: d.unread, count: unreadCount },
  ];

  return (
    <nav aria-label={dict.notifications.title} className="flex items-center gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.key === "all" ? `/${lang}/notifications` : `/${lang}/notifications?filter=unread`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-200",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-medium tabular-nums",
                  isActive ? "bg-primary-foreground/20" : "bg-muted text-foreground"
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
