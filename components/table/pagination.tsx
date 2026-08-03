import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/types/i18n";

export function Pagination({
  page,
  perPage,
  total,
  pathname,
  searchParams,
  dict,
  /**
   * Which URL param carries the page number. Defaults to "page"; a page
   * rendering two independent lists (e.g. /projects/review) passes a
   * namespaced name so paging one list doesn't move the other.
   */
  pageParam = "page",
}: {
  page: number;
  perPage: number;
  total: number;
  pathname: string;
  searchParams: URLSearchParams;
  dict: Dictionary;
  pageParam?: string;
}) {
  const d = dict.common.pagination;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const hrefForPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(pageParam, String(p));
    return `${pathname}?${params.toString()}`;
  };

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-sm text-muted-foreground">
        {d.summary
          .replace("{start}", String((page - 1) * perPage + 1))
          .replace("{end}", String(Math.min(page * perPage, total)))
          .replace("{total}", String(total))}
      </p>
      <div className="flex items-center gap-1">
        {page <= 1 ? (
          <Button variant="outline" size="icon-sm" disabled aria-label={d.previousPage}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={hrefForPage(page - 1)} aria-label={d.previousPage} />}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
        )}
        <span className="px-2 text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        {page >= totalPages ? (
          <Button variant="outline" size="icon-sm" disabled aria-label={d.nextPage}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={hrefForPage(page + 1)} aria-label={d.nextPage} />}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
