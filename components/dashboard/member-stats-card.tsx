import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CardEmpty } from "@/components/dashboard/card-states";
import { DepartmentBarChart } from "@/components/charts/department-bar-chart";
import { Users } from "lucide-react";
import type { DepartmentStat } from "@/types/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function MemberStatsCard({
  stats,
  lang,
  dict,
}: {
  stats: DepartmentStat[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.dashboard.memberStats;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <CardEmpty
            icon={Users}
            message={d.empty}
            ctaLabel={dict.nav.members}
            ctaHref="/members"
            lang={lang}
          />
        ) : (
          <DepartmentBarChart stats={stats} />
        )}
      </CardContent>
    </Card>
  );
}
