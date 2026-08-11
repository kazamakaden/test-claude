import { Bell } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getRecentNotifications } from "@/services/notifications";
import { notificationMessage } from "@/lib/notifications";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export async function NotificationsCard({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const notifications = await getRecentNotifications();
  const d = dict.dashboard.notifications;
  const n18n = dict.notifications;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
        {notifications.length > 0 && (
          <CardAction>
            <Link
              href={`/${lang}/notifications`}
              className="text-sm text-primary underline-offset-4 hover:underline focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {d.emptyCta}
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <CardEmpty
            icon={Bell}
            message={d.empty}
            ctaLabel={d.emptyCta}
            ctaHref="/notifications"
            lang={lang}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-2">
                <Badge variant={n.read ? "secondary" : "default"} className="mt-0.5 shrink-0">
                  {n18n.types[n.type]}
                </Badge>
                <p className="text-sm text-foreground">
                  {notificationMessage(dict, n)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
