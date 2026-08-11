import { z } from "zod";

const PER_PAGE = 20;

export const NOTIFICATIONS_PER_PAGE = PER_PAGE;

/**
 * URL search params for /notifications. Same `.catch()` discipline as
 * schemas/members.ts: a garbage param degrades to the default instead of
 * throwing, so a hand-edited or stale URL never 500s the page.
 */
export const notificationFiltersSchema = z.object({
  filter: z.enum(["all", "unread"]).catch("all"),
  page: z.coerce.number().int().positive().catch(1),
});

export function parseNotificationSearchParams(
  searchParams: Record<string, string | string[] | undefined>
) {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return notificationFiltersSchema.parse({
    filter: single(searchParams.filter) ?? "all",
    page: single(searchParams.page) ?? "1",
  });
}

/**
 * Marking one notification read. The id is the only input, and it is always
 * re-scoped server-side to the caller's own read-marks — see
 * notification_reads_insert_own (0036), which is what actually stops a
 * caller writing a read-mark for someone else.
 */
export const markNotificationReadSchema = z.object({
  id: z.uuid(),
});
