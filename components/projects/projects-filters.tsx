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
import type { Dictionary } from "@/types/i18n";

const DEBOUNCE_MS = 300;
const ALL = "__all__";
const STATUSES = ["draft", "teacher_review", "admin_approval", "official"] as const;

export function ProjectsFilters({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const d = dict.projects;

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

  const hasFilters = searchParams.get("search") || searchParams.get("status");

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

      <Select value={searchParams.get("status") ?? ALL} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger aria-label={d.columnStatus}>
          <SelectValue placeholder={d.columnStatus}>
            {(value: string) => (value === ALL ? d.allStatuses : d.status[value as (typeof STATUSES)[number]])}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{d.allStatuses}</SelectItem>
          {STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {d.status[status]}
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
