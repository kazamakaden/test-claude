import Link from "next/link";
import { Megaphone, Pin } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { listAnnouncements } from "@/services/announcements";
import {
  ANNOUNCEMENTS_PER_PAGE,
  parseAnnouncementSearchParams,
} from "@/schemas/announcements";
import { redirectIfPageOutOfRange } from "@/lib/pagination";
import { Pagination } from "@/components/table/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * §5 public announcements feed. Replaces the PageShell "coming soon" stub that
 * had been linked from the footer since Phase 1 without a page behind it (B-1).
 *
 * Public: announcements_select_published (0060) admits published rows to
 * anon, so a guest sees the feed — which is the point of an announcement.
 */
async function Feed({
  lang,
  dict,
  page,
  searchParams,
  canManage,
}: {
  lang: Locale;
  dict: Dictionary;
  page: number;
  searchParams: URLSearchParams;
  canManage: boolean;
}) {
  // Staff see their own drafts here, badged. Without this a draft was
  // unreachable the moment its author navigated away from the editor: nothing
  // in the app listed one, and createAnnouncementAction's redirect was the only
  // route to it. This is the books shape (RLS shows staff their drafts and the
  // card renders `status`), NOT the site_banners trap -- a reader never sees a
  // draft, because `includeDrafts` is false for anyone without content:manage
  // and RLS refuses it regardless of what is passed.
  const { rows, total } = await listAnnouncements(lang, { page, includeDrafts: canManage });
  const d = dict.announcements;

  // A stale bookmark or a deleted announcement can leave the viewer past the
  // last page, where the feed renders nothing and the pager cannot walk back
  // more than one page at a time. Same guard the other three list pages carry.
  redirectIfPageOutOfRange({ rows, page, pathname: `/${lang}/announcements`, searchParams });

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-10 text-center">
        <Megaphone className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{d.empty}</p>
        <p className="text-sm text-muted-foreground">{d.emptyDescription}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/${lang}/announcements/${row.id}`}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading text-base font-semibold text-foreground">{row.title}</h2>
              <div className="flex shrink-0 items-center gap-1">
                {row.status === "draft" ? (
                  <Badge variant="outline">{d.draft}</Badge>
                ) : null}
                {row.pinned ? (
                  <Badge variant="outline">
                    <Pin className="mr-1 size-3" aria-hidden="true" />
                    {d.pinned}
                  </Badge>
                ) : null}
              </div>
            </div>
            {row.publishedAt ? (
              <time
                dateTime={row.publishedAt}
                className="text-xs tabular-nums text-muted-foreground"
              >
                {new Date(row.publishedAt).toLocaleDateString(
                  lang === "th" ? "th-TH" : "en-GB",
                  { dateStyle: "long" }
                )}
              </time>
            ) : null}
            {/* line-clamp rather than a substring: cutting a Thai string by
                character count can split a cluster and leave a stray tone
                mark. CSS truncates at the rendered glyph. */}
            <p className="line-clamp-2 text-sm text-muted-foreground">{row.body}</p>
          </Link>
        </li>
      ))}
      </ul>
      <Pagination
        page={page}
        perPage={ANNOUNCEMENTS_PER_PAGE}
        total={total}
        pathname={`/${lang}/announcements`}
        searchParams={searchParams}
        dict={dict}
      />
    </>
  );
}

export default async function AnnouncementsPage({
  params,
  searchParams: rawSearchParamsPromise,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const rawSearchParams = await rawSearchParamsPromise;
  const { page } = parseAnnouncementSearchParams(rawSearchParams);
  // Rebuilt rather than passed through: Pagination and the out-of-range
  // redirect both preserve every other param, so a future filter on this page
  // survives paging without touching either of them.
  const searchParams = new URLSearchParams(
    Object.entries(rawSearchParams).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  );
  const dict = await getDictionary(lang);
  const role = await getRole();
  const canManage = can(role, "content:manage");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Megaphone className="size-4" aria-hidden="true" />
            {dict.nav.announcements}
          </span>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {dict.nav.announcements}
          </h1>
          <p className="text-sm text-muted-foreground">{dict.announcements.description}</p>
        </div>
        {canManage ? (
          <Link
            href={`/${lang}/announcements/manage/new`}
            className={buttonVariants({ variant: "default" })}
          >
            {dict.announcements.newButton}
          </Link>
        ) : null}
      </header>

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Feed
          lang={lang}
          dict={dict}
          page={page}
          searchParams={searchParams}
          canManage={canManage}
        />
      </CardBoundary>
    </div>
  );
}
