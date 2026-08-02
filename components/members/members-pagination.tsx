import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/types/i18n";

export function MembersPagination({
  page,
  perPage,
  total,
  pathname,
  searchParams,
  dict,
}: {
  page: number;
  perPage: number;
  total: number;
  pathname: string;
  searchParams: URLSearchParams;
  dict: Dictionary;
}) {
  const d = dict.members;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const hrefForPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `${pathname}?${params.toString()}`;
  };

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-sm text-muted-foreground">
        {d.paginationSummary
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
