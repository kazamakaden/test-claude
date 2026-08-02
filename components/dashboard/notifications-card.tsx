import { Bell } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getNotifications } from "@/services/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export async function NotificationsCard({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const notifications = await getNotifications();
  const d = dict.dashboard.notifications;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
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
                  {d.types[n.type]}
                </Badge>
                <p className="text-sm text-foreground">{n.title}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
