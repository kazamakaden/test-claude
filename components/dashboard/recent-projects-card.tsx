import { FolderKanban } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getRecentProjects } from "@/services/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export async function RecentProjectsCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const projects = await getRecentProjects();
  const d = dict.dashboard.recentProjects;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <CardEmpty
            icon={FolderKanban}
            message={d.empty}
            ctaLabel={d.emptyCta}
            ctaHref="/projects"
            lang={lang}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{p.title}</p>
                <Badge
                  variant={p.status === "official" ? "default" : "outline"}
                  className="shrink-0"
                >
                  {d.status[p.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
