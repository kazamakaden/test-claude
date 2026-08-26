import { CalendarClock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getUpcomingMeetings } from "@/services/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDate } from "@/lib/datetime";

export async function UpcomingMeetingsCard({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const meetings = await getUpcomingMeetings();
  const d = dict.dashboard.meetings;
  const locale = lang === "th" ? th : enUS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.title}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <CardEmpty
            icon={CalendarClock}
            message={d.empty}
            ctaLabel={d.emptyCta}
            ctaHref="/calendar"
            lang={lang}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {meetings.map((m) => (
              <li key={m.id} className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{m.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {format(bangkokDate(m.startsAt), "d MMM yyyy, HH:mm", { locale })}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden />
                  {m.location}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
