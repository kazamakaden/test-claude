"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEASON_LABELS_TH, SEASON_LABELS_EN } from "@/lib/books";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const DEBOUNCE_MS = 300;
const ALL = "__all__";

export function BooksFilters({
  years,
  lang,
  dict,
}: {
  years: number[];
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const d = dict.documents;
  const seasonLabels = lang === "th" ? SEASON_LABELS_TH : SEASON_LABELS_EN;

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  };

  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);
  useEffect(() => {
    if (debouncedSearch !== (searchParams.get("search") ?? "")) {
      setParam("search", debouncedSearch || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const hasFilters = searchParams.get("search") || searchParams.get("year") || searchParams.get("season");

  const clearAll = () => {
    setSearch("");
    startTransition(() => router.replace(pathname));
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-48 flex-1 sm:max-w-64">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={d.searchPlaceholder}
          className="pl-8"
          aria-label={d.searchPlaceholder}
        />
      </div>

      <Select value={searchParams.get("year") ?? ALL} onValueChange={(v) => setParam("year", v)}>
        <SelectTrigger aria-label={d.filterYear}>
          <SelectValue placeholder={d.filterYear}>
            {(value: string) => (value === ALL ? d.allYears : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{d.allYears}</SelectItem>
          {years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("season") ?? ALL} onValueChange={(v) => setParam("season", v)}>
        <SelectTrigger aria-label={d.filterSeason}>
          <SelectValue placeholder={d.filterSeason}>
            {(value: string) => (value === ALL ? d.allSeasons : seasonLabels[Number(value)])}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{d.allSeasons}</SelectItem>
          {[1, 2, 3].map((season) => (
            <SelectItem key={season} value={String(season)}>
              {seasonLabels[season]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="size-4" aria-hidden />
          {d.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
