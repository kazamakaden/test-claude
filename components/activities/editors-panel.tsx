"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { addEditorAction, removeEditorAction } from "@/actions/activity-detail";
import type { ActivityEditor } from "@/types/activities";
import type { SearchResults } from "@/types/search";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

interface Candidate {
  id: string;
  name: string;
  code: string | null;
}

/**
 * Grant and revoke per-activity edit rights by name.
 *
 * Lookup reuses /api/search (0059's search_all, SECURITY INVOKER) filtered to
 * member hits, rather than adding a second people-search path that could drift
 * from the first. 300ms debounce, per §18.
 *
 * Rendered only for someone who can already edit, but that is a convenience:
 * GRANTING is owner-and-admin-only, enforced by activity_editors_insert_owner
 * (0061), which reads a.created_by directly rather than calling
 * can_edit_activity(). A co-editor who tries gets a refusal from the database,
 * not a silent success -- that is the guard against a delegate handing the
 * grant onward.
 */
export function EditorsPanel({
  activityId,
  editors,
  lang,
  dict,
}: {
  activityId: string;
  editors: ActivityEditor[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.activities.editors;
  const errors = dict.activities.detailErrors;
  const router = useRouter();
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term, 300);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&lang=${lang}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as SearchResults;
        if (cancelled) return;
        const members = data.groups.find((g) => g.entity === "member");
        setCandidates(
          (members?.hits ?? []).map((h) => ({ id: h.id, name: h.title, code: h.subtitle }))
        );
      } catch {
        // A dropped lookup must not blank a list the user is reading.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, lang]);

  function grant(userId: string) {
    startTransition(async () => {
      const result = await addEditorAction(lang, activityId, userId);
      if (!result.ok) {
        toast.error(errors[result.messageKey as keyof typeof errors] ?? errors.unknown);
        return;
      }
      setTerm("");
      setCandidates([]);
      router.refresh();
    });
  }

  function revoke(userId: string) {
    startTransition(async () => {
      const result = await removeEditorAction(lang, activityId, userId);
      if (!result.ok) {
        toast.error(errors[result.messageKey as keyof typeof errors] ?? errors.unknown);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">{d.description}</p>

        <div className="flex flex-col gap-2">
          <label htmlFor="editor-search" className="sr-only">
            {d.search}
          </label>
          <Input
            id="editor-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={d.search}
            autoComplete="off"
          />
          {debounced.trim().length >= 2 && (
            <ul className="rounded-lg border border-border">
              {candidates.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">{d.noResults}</li>
              ) : (
                candidates.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 truncate text-sm">
                      {c.name}
                      {c.code && <span className="ml-2 text-muted-foreground tabular-nums">{c.code}</span>}
                    </span>
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => grant(c.id)}>
                      <UserPlus aria-hidden className="mr-1 size-3.5" />
                      {d.add}
                    </Button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {editors.length === 0 ? (
          <p className="text-sm text-muted-foreground">{d.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {editors.map((e) => (
              <li key={e.userId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  {e.fullName ?? "—"}
                  {e.studentCode && (
                    <span className="ml-2 text-muted-foreground tabular-nums">{e.studentCode}</span>
                  )}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label={d.removeLabel.replace("{name}", e.fullName ?? "")}
                  onClick={() => revoke(e.userId)}
                >
                  <X aria-hidden className="mr-1 size-3.5" />
                  {d.remove}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
