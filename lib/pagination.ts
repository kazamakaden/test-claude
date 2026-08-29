import "server-only";
import { redirect } from "next/navigation";

/**
 * Send a viewer stranded past the last page back to page 1.
 *
 * A list page reached with an out-of-range `?page=` renders nothing, and the
 * pagination bar cannot rescue it: "previous" only steps back one page at a
 * time, so from `?page=99` on a 3-page list it takes 96 clicks. It is reachable
 * without typing a URL — delete rows until the list shrinks below the page you
 * are on (the revalidate re-renders at the same `?page=`), or follow a stale
 * bookmark.
 *
 * The same guard /notifications already carries, lifted here now that three
 * more pages need it — the `common.pagination` / `common.levels` precedent.
 *
 * Called from inside the page's Suspense child, which is where `rows` is
 * known. `redirect()` throws a Next control-flow signal; CardBoundary re-throws
 * it via `unstable_rethrow`, so it propagates instead of being caught as an
 * error.
 */
export function redirectIfPageOutOfRange({
  rows,
  page,
  pathname,
  searchParams,
}: {
  rows: readonly unknown[];
  page: number;
  pathname: string;
  searchParams: URLSearchParams;
}): void {
  if (rows.length > 0 || page <= 1) return;

  // Keep every other param — dropping the filters would answer "this page is
  // empty" by silently showing the viewer a different query's results.
  const params = new URLSearchParams(searchParams.toString());
  params.delete("page");
  const query = params.toString();
  redirect(query ? `${pathname}?${query}` : pathname);
}
