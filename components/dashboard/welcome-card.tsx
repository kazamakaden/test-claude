import { Card, CardContent } from "@/components/ui/card";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

function greetingKey(hour: number): "welcomeMorning" | "welcomeAfternoon" | "welcomeEvening" {
  if (hour < 12) return "welcomeMorning";
  if (hour < 18) return "welcomeAfternoon";
  return "welcomeEvening";
}

export function WelcomeCard({ role, dict }: { role: Role; dict: Dictionary }) {
  const greeting = dict.dashboard[greetingKey(new Date().getHours())];

  return (
    <Card className="md:col-span-2 xl:col-span-3">
      <CardContent className="flex flex-col gap-1">
        <h2 className="text-gradient-brand font-heading text-xl font-semibold">
          {greeting}
        </h2>
        <p className="text-sm text-muted-foreground">
          {dict.roles[role]}
        </p>
      </CardContent>
    </Card>
  );
}
