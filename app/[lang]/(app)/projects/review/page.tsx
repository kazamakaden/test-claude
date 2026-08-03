import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireAnyPermission } from "@/lib/auth/require-role";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { parseProjectsSearchParams, PROJECTS_PER_PAGE_SIZE } from "@/schemas/projects";
import { listReviewProjects } from "@/services/projects";
import { ProjectsTable } from "@/components/projects/projects-table";
import { Pagination } from "@/components/table/pagination";
import type { Locale } from "@/lib/i18n/config";

export default async function ProjectsReviewPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  await requireAnyPermission(["project:recommend", "project:approve"], lang);

  const rawParams = await rawSearchParams;
  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);
  const filters = parseProjectsSearchParams(rawParams);
  const d = dict.projects;

  const pathname = `/${lang}/projects/review`;
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );

  const showTeacherQueue = can(role, "project:recommend");
  const showAdminQueue = can(role, "project:approve");

  const [teacherQueue, adminQueue] = await Promise.all([
    showTeacherQueue ? listReviewProjects("teacher_review", filters) : Promise.resolve(null),
    showAdminQueue ? listReviewProjects("admin_approval", filters) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.review.title}
        </h1>
      </div>

      {showTeacherQueue && teacherQueue ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {d.review.teacherQueueTitle}
          </h2>
          {teacherQueue.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{d.review.empty}</p>
          ) : (
            <>
              <ProjectsTable
                projects={teacherQueue.rows}
                filters={filters}
                pathname={pathname}
                searchParams={searchParams}
                lang={lang}
                dict={dict}
              />
              <Pagination
                page={filters.page}
                perPage={PROJECTS_PER_PAGE_SIZE}
                total={teacherQueue.total}
                pathname={pathname}
                searchParams={searchParams}
                dict={dict}
              />
            </>
          )}
        </section>
      ) : null}

      {showAdminQueue && adminQueue ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {d.review.adminQueueTitle}
          </h2>
          {adminQueue.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{d.review.empty}</p>
          ) : (
            <>
              <ProjectsTable
                projects={adminQueue.rows}
                filters={filters}
                pathname={pathname}
                searchParams={searchParams}
                lang={lang}
                dict={dict}
              />
              <Pagination
                page={filters.page}
                perPage={PROJECTS_PER_PAGE_SIZE}
                total={adminQueue.total}
                pathname={pathname}
                searchParams={searchParams}
                dict={dict}
              />
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
