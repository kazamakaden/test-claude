"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/types/i18n";

const ALL = "__all__";

/**
 * The control the §19 audit filter never had.
 *
 * Everything else was already built — `schemas/audit.ts` parses `?action=`,
 * `listAuditLogs` applies it (with `%`/`_` escaped), the out-of-range guard in
 * the page preserves it, and both dictionaries carry `filterAction`,
 * `allActions`, `clearFilters` and a translated label per action. Only the
 * <Select> was missing, so the filter worked solely for someone who hand-typed
 * a query string.
 *
 * Options come from `dict.audit.actions`, NOT from a distinct-scan of the
 * table: `audit_logs` is append-only and is the one table here with no natural
 * ceiling, so populating a dropdown by reading every row would make the whole
 * trail load on each page view. The dictionary already enumerates every action
 * any 0057 trigger writes, and offering one nobody has performed yet is
 * harmless — it simply returns no rows.
 *
 * No search box: an audit trail is filtered by category, and free-text over
 * actor/entity is the sort of thing that helps someone find and then bury a
 * specific entry. Same reasoning as `schemas/audit.ts`'s deliberate lack of a
 * sort parameter.
 */
export function AuditFilters({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const d = dict.audit;
  const labels = d.actions as Record<string, string | undefined>;
  const actions = Object.keys(labels);

  // Base UI types onValueChange as `string | null`, so accept null rather than
  // narrowing at the call site.
  const setAction = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) params.set("action", value);
    else params.delete("action");
    // Page 1 of the new filter — keeping the old page number is how a viewer
    // lands past the end of a narrower result set. Same call all three existing
    // filter components make.
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  };

  const current = searchParams.get("action") ?? ALL;
  const hasFilters = searchParams.get("action") !== null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={current} onValueChange={setAction}>
        <SelectTrigger aria-label={d.filterAction} className="sm:w-72">
          {/* Base UI renders the raw stored value without this — the "__all__"
              defect already fixed once on the members filters. */}
          <SelectValue placeholder={d.filterAction}>
            {(value: string) => (value === ALL ? d.allActions : (labels[value] ?? value))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{d.allActions}</SelectItem>
          {actions.map((action) => (
            <SelectItem key={action} value={action}>
              {labels[action] ?? action}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => setAction(ALL)}>
          <X className="size-4" aria-hidden />
          {d.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
