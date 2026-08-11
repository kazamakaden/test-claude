import { NotificationItem } from "@/components/notifications/notification-item";
import { Bell } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { notificationMessage } from "@/lib/notifications";
import type { AppNotification, NotificationFilter } from "@/types/notifications";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function NotificationsList({
  notifications,
  filter,
  lang,
  dict,
}: {
  notifications: AppNotification[];
  filter: NotificationFilter;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.notifications;
  const locale = lang === "th" ? th : enUS;

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <Bell className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-heading text-base font-medium text-foreground">
          {filter === "unread" ? d.emptyUnread : d.empty}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {filter === "unread" ? d.emptyUnreadDescription : d.emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {notifications.map((n) => {
        const message = notificationMessage(dict, n);
        const body = (
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors duration-200",
              n.link && "hover:border-primary/50",
              !n.read && "border-l-4 border-l-primary"
            )}
          >
            <Badge variant={n.read ? "secondary" : "default"} className="mt-0.5 shrink-0">
              {d.types[n.type]}
            </Badge>
            <div className="flex min-w-0 flex-col gap-1">
              <p className={cn("text-sm", n.read ? "text-muted-foreground" : "font-medium text-foreground")}>
                {message}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <time dateTime={n.createdAt}>
                  {format(new Date(n.createdAt), "d MMM yyyy HH:mm", { locale })}
                </time>
                {!n.read && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {d.unreadBadge}
                  </span>
                )}
              </div>
            </div>
          </div>
        );

        return (
          <li key={n.id}>
            <NotificationItem
              id={n.id}
              href={n.link}
              read={n.read}
              lang={lang}
              markLabel={d.markAsRead}
            >
              {body}
            </NotificationItem>
          </li>
        );
      })}
    </ul>
  );
}
