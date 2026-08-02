import Link from "next/link";
import { Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getQuickActions } from "@/services/dashboard";
import type { Role } from "@/types/auth";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function QuickActionsCard({
  role,
  lang,
  dict,
}: {
  role: Role;
  lang: Locale;
  dict: Dictionary;
}) {
  const actions = getQuickActions(role);
  const d = dict.dashboard.quickActions;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant="outline"
            className="justify-start"
            nativeButton={false}
            render={<Link href={`/${lang}${action.href}`} />}
          >
            <Zap className="size-4" aria-hidden />
            {d[action.key as keyof typeof d]}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
