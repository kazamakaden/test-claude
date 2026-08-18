import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CardEmpty } from "@/components/dashboard/card-states";
import type { Activity, ActivityFilters, ActivitySortColumn, ActivityStatus } from "@/types/activities";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const SORTABLE_COLUMNS: { key: ActivitySortColumn; labelKey: keyof Dictionary["activities"] }[] = [
  { key: "title", labelKey: "columnTitle" },
  { key: "startsAt", labelKey: "columnDate" },
  { key: "status", labelKey: "columnStatus" },
];

const STATUS_VARIANT: Record<ActivityStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  completed: "default",
  cancelled: "destructive",
};

function sortHref(
  pathname: string,
  searchParams: URLSearchParams,
  column: ActivitySortColumn,
  filters: ActivityFilters
) {
  const params = new URLSearchParams(searchParams.toString());
  const nextDirection = filters.sort === column && filters.direction === "asc" ? "desc" : "asc";
  params.set("sort", column);
  params.set("dir", nextDirection);
  return `${pathname}?${params.toString()}`;
}

export function ActivitiesTable({
  activities,
  filters,
  pathname,
  searchParams,
  lang,
  dict,
}: {
  activities: Activity[];
  filters: ActivityFilters;
  pathname: string;
  searchParams: URLSearchParams;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.activities;
  const locale = lang === "th" ? th : enUS;

  if (activities.length === 0) {
    return (
      <CardEmpty
        icon={Megaphone}
        message={d.empty}
        ctaLabel={d.clearFilters}
        ctaHref="/activities"
        lang={lang}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORTABLE_COLUMNS.map(({ key, labelKey }) => {
            const active = filters.sort === key;
            const Icon = active ? (filters.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
            return (
              <TableHead key={key}>
                <Link
                  href={sortHref(pathname, searchParams, key, filters)}
                  className="flex items-center gap-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-sort={active ? (filters.direction === "asc" ? "ascending" : "descending") : "none"}
                >
                  {d[labelKey] as string}
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                </Link>
              </TableHead>
            );
          })}
          <TableHead>{d.columnLocation}</TableHead>
          <TableHead>{d.columnDepartment}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activities.map((a) => (
          <TableRow key={a.id}>
            <TableCell className="font-medium text-foreground">
              {/* Until now nothing in the UI exposed an activity id, which left
                  /activities/{id}/qr reachable only by typing the URL. */}
              <Link
                href={`/${lang}/activities/${a.id}`}
                className="underline-offset-4 hover:underline"
              >
                {a.title}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {format(new Date(a.startsAt), "d MMM yyyy", { locale })}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[a.status]}>{d.status[a.status]}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{a.location ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{a.departmentName ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
