"use client";

import { departmentOptionLabel, type StudentLevel } from "@/lib/student-id";

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
import type { Club, Department } from "@/types/members";
import type { Dictionary } from "@/types/i18n";

const DEBOUNCE_MS = 300;
const ALL = "__all__";

export function MembersFilters({
  departments,
  clubs,
  years,
  levels,
  dict,
}: {
  departments: Department[];
  clubs: Club[];
  years: number[];
  levels: Exclude<StudentLevel, null>[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const d = dict.members;

  // สาขา names repeat across levels (เทคโนโลยีสารสนเทศ is 20901, 30901 and
  // 31901), so an option must carry its ปวช./ปวส./ทล.บ. prefix to be
  // distinguishable. Level is derived from the code, never stored.
  const departmentLabel = (id: string) => {
    const dept = departments.find((x) => x.id === id);
    return dept ? departmentOptionLabel(dept.code, dept.nameTh, dict.common.levels) : undefined;
  };

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Any filter change invalidates the current page — otherwise the user
    // can land on a page number past the new, smaller result set.
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

  const hasFilters =
    searchParams.get("search") ||
    searchParams.get("dept") ||
    searchParams.get("year") ||
    searchParams.get("class") ||
    searchParams.get("club");

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

      <Select
        value={searchParams.get("dept") ?? ALL}
        onValueChange={(v) => setParam("dept", v)}
      >
        <SelectTrigger aria-label={d.filterDepartment}>
          <SelectValue placeholder={d.filterDepartment}>
            {(value: string) =>
              value === ALL ? d.allDepartments : departmentLabel(value)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{d.allDepartments}</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {departmentOptionLabel(dept.code, dept.nameTh, dict.common.levels)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("year") ?? ALL}
        onValueChange={(v) => setParam("year", v)}
      >
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

      {/* ระดับชั้น. The stored value is the generated `student_level` (0069), so
          the option list can never be empty the way the old distinct-class_name
          scan always was. The SelectValue children function is not optional —
          without it Base UI renders the raw stored value, which is the exact
          `__all__` defect this project already hit once on these filters. */}
      <Select
        value={searchParams.get("class") ?? ALL}
        onValueChange={(v) => setParam("class", v)}
      >
        <SelectTrigger aria-label={d.filterClass}>
          <SelectValue placeholder={d.filterClass}>
            {(value: string) =>
              value === ALL
                ? d.allClasses
                : dict.common.levels[value as Exclude<StudentLevel, null>]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{d.allClasses}</SelectItem>
          {levels.map((l) => (
            <SelectItem key={l} value={l}>
              {dict.common.levels[l]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("club") ?? ALL}
        onValueChange={(v) => setParam("club", v)}
      >
        <SelectTrigger aria-label={d.filterClub}>
          <SelectValue placeholder={d.filterClub}>
            {(value: string) =>
              value === ALL ? d.allClubs : clubs.find((club) => club.id === value)?.nameTh
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{d.allClubs}</SelectItem>
          {clubs.map((club) => (
            <SelectItem key={club.id} value={club.id}>
              {club.nameTh}
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
