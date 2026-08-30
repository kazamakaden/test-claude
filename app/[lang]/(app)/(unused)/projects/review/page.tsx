import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireAnyPermission } from "@/lib/auth/require-role";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import {
  parseProjectsSearchParams,
  projectsParamKeys,
  PROJECTS_PER_PAGE_SIZE,
} from "@/schemas/projects";
import { listReviewProjects } from "@/services/projects";
import { ProjectsTable } from "@/components/projects/projects-table";
import { Pagination } from "@/components/table/pagination";
import { redirectIfPageOutOfRange } from "@/lib/pagination";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { ProjectsResult } from "@/types/projects";

/**
 * Both queues render on one page, so each gets its own URL param namespace —
 * sharing them made paging or sorting one queue silently move the other.
 */
const TEACHER_PREFIX = "t";
const ADMIN_PREFIX = "a";

function ReviewQueue({
  title,
  queue,
  prefix,
  rawParams,
  pathname,
  searchParams,
  lang,
  dict,
}: {
  title: string;
  queue: ProjectsResult;
  prefix: string;
  rawParams: Record<string, string | string[] | undefined>;
  pathname: string;
  searchParams: URLSearchParams;
  lang: Locale;
  dict: Dictionary;
}) {
  const filters = parseProjectsSearchParams(rawParams, prefix);
  const paramKeys = projectsParamKeys(prefix);

  // Out of range this queue renders its "nothing to review" state, which is
  // actively wrong — there IS something, on another page. Send the viewer back
  // to page 1 of THIS queue, keeping the other queue's params (hence
  // pageParam: the un-prefixed "page" is not the key here).
  redirectIfPageOutOfRange({
    rows: queue.rows,
    page: filters.page,
    pathname,
    searchParams,
    pageParam: paramKeys.page,
  });

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      {queue.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.projects.review.empty}</p>
      ) : (
        <>
          <ProjectsTable
            projects={queue.rows}
            filters={filters}
            pathname={pathname}
            searchParams={searchParams}
            lang={lang}
            dict={dict}
            paramKeys={paramKeys}
            // Unreachable: this queue renders its own empty state above, so
            // ProjectsTable's empty branch never runs here. False rather than
            // true because a REVIEW queue is not a place to offer "create a
            // project" even if it somehow did.
            canCreate={false}
          />
          <Pagination
            page={filters.page}
            perPage={PROJECTS_PER_PAGE_SIZE}
            total={queue.total}
            pathname={pathname}
            searchParams={searchParams}
            dict={dict}
            pageParam={paramKeys.page}
          />
        </>
      )}
    </section>
  );
}

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
    showTeacherQueue
      ? listReviewProjects("teacher_review", parseProjectsSearchParams(rawParams, TEACHER_PREFIX))
      : Promise.resolve(null),
    showAdminQueue
      ? listReviewProjects("admin_approval", parseProjectsSearchParams(rawParams, ADMIN_PREFIX))
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.review.title}
        </h1>
      </div>

      {teacherQueue ? (
        <ReviewQueue
          title={d.review.teacherQueueTitle}
          queue={teacherQueue}
          prefix={TEACHER_PREFIX}
          rawParams={rawParams}
          pathname={pathname}
          searchParams={searchParams}
          lang={lang}
          dict={dict}
        />
      ) : null}

      {adminQueue ? (
        <ReviewQueue
          title={d.review.adminQueueTitle}
          queue={adminQueue}
          prefix={ADMIN_PREFIX}
          rawParams={rawParams}
          pathname={pathname}
          searchParams={searchParams}
          lang={lang}
          dict={dict}
        />
      ) : null}
    </div>
  );
}
