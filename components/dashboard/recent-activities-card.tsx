import { Activity } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getRecentActivities } from "@/services/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDate } from "@/lib/datetime";

export async function RecentActivitiesCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const activities = await getRecentActivities();
  const d = dict.dashboard.recentActivities;
  const locale = lang === "th" ? th : enUS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <CardEmpty
            icon={Activity}
            message={d.empty}
            ctaLabel={d.emptyCta}
            ctaHref="/activities"
            lang={lang}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {activities.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.department} · {format(bangkokDate(a.occurredAt), "d MMM", { locale })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
