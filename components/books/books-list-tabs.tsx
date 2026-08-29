import Link from "next/link";
import { cn } from "@/lib/utils";
import { AFT11_LISTS, AFT11_LIST_SLUGS, type Aft11List } from "@/lib/book-collections";
import type { Dictionary } from "@/types/i18n";

/**
 * The two lists on /documents — 11 ดี and 11 เก่ง.
 *
 * Plain <Link>s driven by `?list=`, not client state: the selection is
 * shareable, survives a reload, and works with JavaScript disabled (§30.9
 * item 3) — the same choice /activities' status tiles and the calendar month
 * nav already make.
 *
 * Switching lists intentionally drops every other search param. A year that
 * exists on one list often does not exist on the other, so carrying filters
 * across would land the viewer on an empty page that looks broken; `page` is
 * the same argument in a starker form.
 */
export function BooksListTabs({
  pathname,
  active,
  dict,
}: {
  pathname: string;
  active: Aft11List;
  dict: Dictionary;
}) {
  return (
    <nav aria-label={dict.documents.listLabel} className="flex flex-wrap gap-2">
      {AFT11_LIST_SLUGS.map((slug) => {
        const isActive = slug === active;
        return (
          <Link
            key={slug}
            href={`${pathname}?list=${slug}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {dict.documents.collections[AFT11_LISTS[slug]]}
          </Link>
        );
      })}
    </nav>
  );
}
