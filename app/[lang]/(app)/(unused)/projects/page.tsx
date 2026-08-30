import Link from "next/link";
import { Plus } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole, getSessionUserId } from "@/lib/auth/get-role";
import { requirePermission } from "@/lib/auth/require-role";
import { can } from "@/lib/auth/permissions";
import { parseProjectsSearchParams, PROJECTS_PER_PAGE_SIZE } from "@/schemas/projects";
import { listMyProjects } from "@/services/projects";
import { ProjectsFilters } from "@/components/projects/projects-filters";
import { ProjectsTable } from "@/components/projects/projects-table";
import { Pagination } from "@/components/table/pagination";
import { redirectIfPageOutOfRange } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

export default async function ProjectsPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  // §5 lists Projects only under Authenticated — re-checked server-side, the
  // nav filter alone is UI only.
  await requirePermission("workspace:access", lang);
  // The button below links to /projects/new, which guards on
  // project:draft:submit -- a stricter permission than this page's. A
  // read-only `student` holds workspace:access, so without this the button
  // rendered for them and the destination bounced them straight back.
  const canCreate = can(await getRole(), "project:draft:submit");

  const rawParams = await rawSearchParams;
  const dict = await getDictionary(lang);
  const viewerUserId = await getSessionUserId();

  const filters = parseProjectsSearchParams(rawParams);
  const { rows, total } = viewerUserId ? await listMyProjects(viewerUserId, filters) : { rows: [], total: 0 };

  const pathname = `/${lang}/projects`;
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );

  // A stale bookmark, or a project leaving this list after a status change, can
  // strand the viewer past the last page: the table renders empty and the pager
  // clamps to a page number the URL disagrees with. Same guard the other list
  // pages carry.
  redirectIfPageOutOfRange({ rows, page: filters.page, pathname, searchParams });

  const d = dict.projects;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {dict.nav.projects}
          </h1>
          <p className="text-sm text-muted-foreground">{d.description}</p>
        </div>
        {canCreate ? (
          <Button nativeButton={false} render={<Link href={`/${lang}/projects/new`} />}>
            <Plus className="size-4" aria-hidden />
            {d.newProjectCta}
          </Button>
        ) : null}
      </div>

      <ProjectsFilters dict={dict} />

      <div className="flex flex-col gap-4">
        <ProjectsTable
          projects={rows}
          filters={filters}
          pathname={pathname}
          searchParams={searchParams}
          lang={lang}
          dict={dict}
          canCreate={canCreate}
        />
        <Pagination
          page={filters.page}
          perPage={PROJECTS_PER_PAGE_SIZE}
          total={total}
          pathname={pathname}
          searchParams={searchParams}
          dict={dict}
        />
      </div>
    </div>
  );
}
