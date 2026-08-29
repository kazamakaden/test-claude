"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** A burst of writes (a staff member publishing several drafts) should cost one refetch, not one each. */
const DEBOUNCE_MS = 400;

/**
 * §10 "realtime updates" for /activities. Renders nothing.
 *
 * DELIBERATELY router.refresh(), not merge-into-state like the dashboard
 * calendar card does. That card owns its whole month and can safely splice a
 * row in or out. This page cannot: its rows are the result of a filtered,
 * sorted, paginated SERVER query, so a new row may belong on a different page,
 * may not match the active filters, and would change the pagination total and
 * the statistics strip above the table. Reproducing that logic client-side
 * would be a second source of truth for §10's filters, and the first one to
 * drift would silently show a row the filters exclude.
 *
 * refresh() re-runs the server components with the URL exactly as it is, so the
 * table, the stats tiles and the pagination all stay consistent by
 * construction, and listActivities stays the only place the query lives.
 *
 * Guarded on isSupabaseConfigured for the same reason calendar-grid.tsx is:
 * lib/supabase/client.ts asserts its env vars and throws immediately when they
 * are absent, and this runs in an effect with no boundary of its own. Realtime
 * is a progressive enhancement — an unconfigured environment simply does not
 * subscribe.
 */
export function ActivitiesRealtime() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel("activities-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => {
        // No payload inspection: RLS already decides what reaches this
        // subscriber, and whether the row belongs on THIS page is a question
        // only the server query can answer.
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), DEBOUNCE_MS);
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
