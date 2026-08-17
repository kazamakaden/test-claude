"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MIN_QUERY_LENGTH } from "@/schemas/search";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { SearchEntity, SearchResults } from "@/types/search";

/**
 * §18 global search in the top bar.
 *
 * A TRIGGER, not an always-open input. This nav is tight — CLAUDE.md records a
 * 768px overflow regression that had to be fixed by moving the desktop/mobile
 * switch to `lg`, and English labels are wider than their Thai equivalents.
 * An expanded field would reintroduce exactly that. So the bar shows an icon
 * button and the search itself opens in an overlay.
 *
 * §18 asks for a 300ms debounce, reusing hooks/use-debounced-value.ts — the
 * same hook /members and /activities already use, rather than a third timer.
 *
 * Not the whole feature: /search is a real page with a plain GET form, so
 * search works with JavaScript disabled. This is the convenience layer.
 */
export function GlobalSearch({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const d = dict.search;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ groups: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(query, 300);

  // Cmd/Ctrl+K to open, Escape to close. Escape is handled here rather than by
  // a Dialog because this overlay is deliberately not one: a focus-trapping
  // modal would fight the browser's own find-in-page and screen-reader cursor
  // for what is really a menu.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setResults({ groups: [], total: 0 });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(term)}&lang=${lang}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { groups: [], total: 0 }))
      .then((data: SearchResults) => {
        // Guard against an earlier request resolving after a later one and
        // overwriting fresher results with stale ones.
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setResults({ groups: [], total: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, lang]);

  const entityLabels = d.entities as Record<SearchEntity, string>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={d.open}
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SearchIcon className="size-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-4 pt-24 backdrop-blur-sm">
          {/* Click-away. A sibling overlay rather than a wrapper, so a click
              inside the panel never bubbles out and closes it. */}
          <button
            type="button"
            aria-label={d.close}
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (query.trim().length >= MIN_QUERY_LENGTH) {
                  setOpen(false);
                  router.push(`/${lang}/search?q=${encodeURIComponent(query.trim())}`);
                }
              }}
              className="flex items-center gap-2 border-b border-border px-4"
            >
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={d.placeholder}
                aria-label={d.placeholder}
                autoComplete="off"
                className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </form>

            <div className="max-h-80 overflow-y-auto">
              {query.trim().length < MIN_QUERY_LENGTH ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{d.prompt}</p>
              ) : loading ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{d.searching}</p>
              ) : results.total === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{d.empty}</p>
              ) : (
                <>
                  {results.groups.map((group) => (
                    <section key={group.entity}>
                      <h2 className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {entityLabels[group.entity]}
                      </h2>
                      <ul>
                        {group.hits.map((hit) => (
                          <li key={`${hit.entity}-${hit.id}`}>
                            <a
                              href={hit.href}
                              className="flex flex-col gap-0.5 px-4 py-2 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                            >
                              <span className="text-sm text-foreground">{hit.title}</span>
                              {hit.subtitle ? (
                                <span className="text-xs text-muted-foreground">
                                  {hit.subtitle}
                                </span>
                              ) : null}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  <a
                    href={`/${lang}/search?q=${encodeURIComponent(query.trim())}`}
                    className="block border-t border-border px-4 py-3 text-center text-sm text-primary transition-colors hover:bg-muted/50"
                  >
                    {d.viewAll}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
