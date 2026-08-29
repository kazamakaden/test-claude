"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { manualAttendanceAction } from "@/actions/attendance";
import type { SearchResults } from "@/types/search";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

type Status = "present" | "late" | "absent";

/**
 * Staff adds someone who attended without scanning.
 *
 * The row it creates is marked method='manual' with recorded_by set, so the
 * attendee table can tell a staff assertion apart from a verified scan -- and
 * only manual rows can later be undone.
 *
 * Member lookup reuses /api/search, the same path the co-editor picker uses,
 * rather than a second people-search endpoint.
 */
export function AttendeeAddForm({
  activityId,
  lang,
  dict,
}: {
  activityId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.activities.attendees;
  const dash = dict.activities.dashboard;
  const errors = dict.activities.detailErrors;
  const router = useRouter();
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term, 300);
  const [hits, setHits] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [status, setStatus] = useState<Status>("present");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&lang=${lang}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SearchResults;
        if (cancelled) return;
        const members = data.groups.find((g) => g.entity === "member");
        setHits((members?.hits ?? []).map((h) => ({ id: h.id, name: h.title, code: h.subtitle })));
      } catch {
        // ignore: a dropped lookup must not clear what the user is reading
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, lang]);

  function add(studentId: string) {
    startTransition(async () => {
      const result = await manualAttendanceAction(lang, activityId, studentId, status);
      if (!result.ok) {
        toast.error(errors[result.messageKey as keyof typeof errors] ?? errors.unknown);
        return;
      }
      if (result.outcome !== "recorded") {
        toast.error(errors[result.outcome as keyof typeof errors] ?? errors.unknown);
        return;
      }
      setTerm("");
      setHits([]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{d.addTitle}</h3>
        <p className="text-xs text-muted-foreground">{d.addHint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="attendee-add-search" className="sr-only">
          {d.search}
        </label>
        <Input
          id="attendee-add-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={d.search}
          autoComplete="off"
          className="max-w-xs"
        />
        <label htmlFor="attendee-add-status" className="sr-only">
          {d.columnStatus}
        </label>
        {/* A native select, not the Base UI one: this sits inside a list of
            actions and needs no portal, and it keeps the control keyboard- and
            screen-reader-native with no extra state. */}
        <select
          id="attendee-add-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="present">{dash.present}</option>
          <option value="late">{dash.late}</option>
          <option value="absent">{dash.absent}</option>
        </select>
      </div>

      {debounced.trim().length >= 2 && (
        <ul className="rounded-lg border border-border">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{dict.activities.editors.noResults}</li>
          ) : (
            hits.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  {h.name}
                  {h.code && <span className="ml-2 text-muted-foreground tabular-nums">{h.code}</span>}
                </span>
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => add(h.id)}>
                  <UserPlus aria-hidden className="mr-1 size-3.5" />
                  {d.add}
                </Button>
              </li>
            ))
          )}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">{d.qrOnlyNote}</p>
    </div>
  );
}
