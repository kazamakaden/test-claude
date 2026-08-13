import Link from "next/link";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getActor } from "@/lib/auth/get-role";
import { can, canAs, type Actor } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { parseMembersSearchParams, PER_PAGE_SIZE } from "@/schemas/members";
import { getClubs, getDepartments, getFilterOptions, getMembers } from "@/services/members";
import { listPendingProfiles } from "@/services/profiles";
import { ApproveUserCard } from "@/components/approvals/approve-user-card";
import { MembersFilters } from "@/components/members/members-filters";
import { MembersTable } from "@/components/members/members-table";
import { MemberCreateSheet } from "@/components/members/member-create-sheet";
import { Pagination } from "@/components/table/pagination";
import { MembersTableSkeleton } from "@/components/members/members-table-skeleton";
import { CardBoundary } from "@/components/dashboard/card-boundary";

async function MembersResults({
  filters,
  pathname,
  searchParams,
  departments,
  clubs,
  actor,
  lang,
  dict,
}: {
  filters: ReturnType<typeof parseMembersSearchParams>;
  pathname: string;
  searchParams: URLSearchParams;
  departments: Awaited<ReturnType<typeof getDepartments>>;
  clubs: Awaited<ReturnType<typeof getClubs>>;
  actor: Actor;
  lang: Locale;
  dict: Dictionary;
}) {
  // §5: guests read name/student id/class/year/department/club only —
  // email stays hidden. includeEmail is decided here, by role, not left to
  // the service (services/members.ts stays role-agnostic by design).
  const includeEmail = can(actor.role, "workspace:access");
  // canAs: an อวท. officer holds member:approve through their office, which
  // can() (role-only) would miss — the officer would see a read-only table.
  const canEdit = canAs(actor, "member:approve");
  const canManage = can(actor.role, "member:manage");
  const { rows, total } = await getMembers(filters, { includeEmail });

  return (
    <div className="flex flex-col gap-4">
      <MembersTable
        members={rows}
        filters={filters}
        pathname={pathname}
        searchParams={searchParams}
        departments={departments}
        clubs={clubs}
        canEdit={canEdit}
        canManage={canManage}
        actorRole={actor.role}
        lang={lang}
        dict={dict}
      />
      <Pagination
        page={filters.page}
        perPage={PER_PAGE_SIZE}
        total={total}
        pathname={pathname}
        searchParams={searchParams}
        dict={dict}
      />
    </div>
  );
}

/**
 * Pending signups, folded in from the old /approvals route so member
 * management lives in one place. Rendered only for member:approve holders —
 * officers and admin — and its own async component so the (possibly slow)
 * pending query never blocks the directory table beside it.
 */
async function PendingApprovals({
  actor,
  lang,
  dict,
}: {
  actor: Actor;
  lang: Locale;
  dict: Dictionary;
}) {
  const [pending, departments] = await Promise.all([listPendingProfiles(), getDepartments()]);
  if (pending.length === 0) return null;

  const d = dict.approvals;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{d.title}</h2>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>
      {pending.map((profile) => (
        <ApproveUserCard
          key={profile.id}
          profile={profile}
          departments={departments}
          actorRole={actor.role}
          lang={lang}
          dict={dict}
        />
      ))}
    </section>
  );
}

export default async function MembersPage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const rawParams = await rawSearchParams;
  const [dict, actor, departments, clubs, filterOptions] = await Promise.all([
    getDictionary(lang),
    getActor(),
    getDepartments(),
    getClubs(),
    getFilterOptions(),
  ]);

  const filters = parseMembersSearchParams(rawParams);
  const pathname = `/${lang}/members`;
  const searchParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );
  const suspenseKey = JSON.stringify(filters);
  const canManage = can(actor.role, "member:manage");
  const canApprove = canAs(actor, "member:approve");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {dict.nav.members}
          </h1>
          <p className="text-sm text-muted-foreground">{dict.members.description}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Plain <Link>, not a dialog: the autoinput page is a real route,
                so it works with JS disabled up to the point the live parsing
                itself needs it. Same member:manage gate as Add user, and
                re-checked server-side by the page and both its actions. */}
            <Button variant="secondary" size="sm" render={<Link href={`/${lang}/members/autoinput`} />}>
              <Wand2 className="size-4" aria-hidden />
              {dict.members.autoinput.title}
            </Button>
            <MemberCreateSheet departments={departments} clubs={clubs} lang={lang} dict={dict} />
          </div>
        ) : null}
      </div>

      {canApprove ? (
        <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
          <Suspense fallback={null}>
            <PendingApprovals actor={actor} lang={lang} dict={dict} />
          </Suspense>
        </CardBoundary>
      ) : null}

      {/* Each isolated behind its own CardBoundary so a throw in one
          (a render bug, or a Supabase call that starts failing) degrades
          to an error card in place, instead of taking the whole page
          (including the nav) down to the route-level error.tsx — the exact
          gap /documents already closed for the same shape (see
          CLAUDE.md's §0 "documents/members dying on a failing dependency"
          entry; /members never got this half of that fix). */}
      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <MembersFilters
          departments={departments}
          clubs={clubs}
          years={filterOptions.years}
          classNames={filterOptions.classNames}
          dict={dict}
        />
      </CardBoundary>

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Suspense key={suspenseKey} fallback={<MembersTableSkeleton />}>
          <MembersResults
            filters={filters}
            pathname={pathname}
            searchParams={searchParams}
            departments={departments}
            clubs={clubs}
            actor={actor}
            lang={lang}
            dict={dict}
          />
        </Suspense>
      </CardBoundary>
    </div>
  );
}
