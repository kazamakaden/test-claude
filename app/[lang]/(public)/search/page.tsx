import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { search } from "@/services/search";
import { parseSearchParams, MIN_QUERY_LENGTH } from "@/schemas/search";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import type { Locale } from "@/lib/i18n/config";
import type { SearchEntity } from "@/types/search";

/**
 * §18 global search as a real page.
 *
 * This exists so search is not JavaScript-only (§30.9 item 3): the nav's
 * command palette is a convenience on top, and this plain GET form is the
 * thing that actually works everywhere. It is also what makes a result set
 * linkable — /search?q=... can be shared, which a dropdown cannot.
 *
 * Public, not (app): search_all (0059) is SECURITY INVOKER, so a guest running
 * it sees exactly the public content they could already browse — official
 * projects and documents, published books, public activities and the member
 * directory 0026 deliberately made public. Gating the page would hide a
 * capability the database already grants, without adding any protection.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const { q } = parseSearchParams(await searchParams);

  const results = q ? await search(q, lang, 20) : { groups: [], total: 0 };
  const entityLabels = dict.search.entities as Record<SearchEntity, string>;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {dict.search.title}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.search.description}</p>
      </header>

      <form method="GET" action={`/${lang}/search`} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="sr-only">{dict.search.placeholder}</span>
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={dict.search.placeholder}
            minLength={MIN_QUERY_LENGTH}
            autoComplete="off"
          />
        </label>
        <Button type="submit">{dict.search.submit}</Button>
      </form>

      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        {!q ? (
          <p className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {dict.search.prompt}
          </p>
        ) : results.total === 0 ? (
          <p className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {dict.search.empty}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {results.groups.map((group) => (
              <section key={group.entity} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <SearchIcon className="size-3.5" aria-hidden="true" />
                  {entityLabels[group.entity]}
                </h2>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {group.hits.map((hit) => (
                    <li key={`${hit.entity}-${hit.id}`}>
                      <Link
                        href={hit.href}
                        className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        <span className="text-sm text-foreground">{hit.title}</span>
                        {hit.subtitle ? (
                          <span className="text-xs text-muted-foreground">{hit.subtitle}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardBoundary>
    </div>
  );
}
