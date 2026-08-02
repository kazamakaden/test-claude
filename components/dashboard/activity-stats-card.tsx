import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CardEmpty } from "@/components/dashboard/card-states";
import { ActivityBarChart } from "@/components/charts/activity-bar-chart";
import { BarChart3 } from "lucide-react";
import type { ActivityStat } from "@/types/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function ActivityStatsCard({
  stats,
  lang,
  dict,
}: {
  stats: ActivityStat[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.dashboard.activityStats;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <CardEmpty
            icon={BarChart3}
            message={d.empty}
            ctaLabel={dict.nav.activities}
            ctaHref="/activities"
            lang={lang}
          />
        ) : (
          <ActivityBarChart
            stats={stats}
            labels={{ attendance: d.attendance, completed: d.completed, pending: d.pending }}
          />
        )}
      </CardContent>
    </Card>
  );
}
