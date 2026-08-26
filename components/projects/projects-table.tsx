import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, FolderKanban } from "lucide-react";
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
import type { Project, ProjectFilters, ProjectSortColumn, ProjectStatus } from "@/types/projects";
import { projectsParamKeys, type ProjectsParamKeys } from "@/schemas/projects";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDate } from "@/lib/datetime";

const SORTABLE_COLUMNS: { key: ProjectSortColumn; labelKey: "columnTitle" | "columnStatus" | "columnUpdated" }[] = [
  { key: "title", labelKey: "columnTitle" },
  { key: "status", labelKey: "columnStatus" },
  { key: "updatedAt", labelKey: "columnUpdated" },
];

const STATUS_VARIANT: Record<ProjectStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  teacher_review: "secondary",
  admin_approval: "secondary",
  official: "default",
};

function sortHref(
  pathname: string,
  searchParams: URLSearchParams,
  column: ProjectSortColumn,
  filters: ProjectFilters,
  paramKeys: ProjectsParamKeys
) {
  const params = new URLSearchParams(searchParams.toString());
  const nextDirection = filters.sort === column && filters.direction === "asc" ? "desc" : "asc";
  params.set(paramKeys.sort, column);
  params.set(paramKeys.dir, nextDirection);
  // Sorting invalidates the current page — otherwise the viewer stays on
  // page 3 of a list that just reordered under them.
  params.delete(paramKeys.page);
  return `${pathname}?${params.toString()}`;
}

export function ProjectsTable({
  projects,
  filters,
  pathname,
  searchParams,
  lang,
  dict,
  paramKeys = projectsParamKeys(),
  canCreate,
}: {
  projects: Project[];
  filters: ProjectFilters;
  pathname: string;
  searchParams: URLSearchParams;
  lang: Locale;
  dict: Dictionary;
  /** Namespaced URL param names when two lists share one page. */
  paramKeys?: ProjectsParamKeys;
  /**
   * Whether the viewer holds project:draft:submit. The empty state's CTA
   * links to /projects/new, which guards on that permission -- a read-only
   * `student` holds workspace:access and so reaches this page, but would be
   * bounced by the destination. Required, not defaulted: a default here would
   * silently re-introduce the bug at any new call site.
   */
  canCreate: boolean;
}) {
  const d = dict.projects;
  const locale = lang === "th" ? th : enUS;

  if (projects.length === 0) {
    return (
      <CardEmpty
        icon={FolderKanban}
        message={d.empty}
        ctaLabel={canCreate ? d.newProjectCta : undefined}
        ctaHref={canCreate ? "/projects/new" : undefined}
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
                  href={sortHref(pathname, searchParams, key, filters, paramKeys)}
                  className="flex items-center gap-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-sort={active ? (filters.direction === "asc" ? "ascending" : "descending") : "none"}
                >
                  {d[labelKey]}
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                </Link>
              </TableHead>
            );
          })}
          <TableHead>{d.columnOwner}</TableHead>
          <TableHead>{d.columnDepartment}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium text-foreground">
              <Link
                href={`/${lang}/projects/${p.id}`}
                className="outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {p.title}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[p.status]}>{d.status[p.status]}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {format(bangkokDate(p.updatedAt), "d MMM yyyy", { locale })}
            </TableCell>
            <TableCell className="text-muted-foreground">{p.ownerName ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{p.departmentName ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
