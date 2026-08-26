/**
 * Display-time conversion into Asia/Bangkok.
 *
 * WHY THIS EXISTS. Activity times are WRITTEN correctly — services/activities.ts's
 * toBangkokInstant() anchors "15:00" to +07:00, so 15:00 Bangkok stores as
 * 08:00Z. But every READ formatted the instant with date-fns `format()`, which
 * renders in the RUNTIME's timezone. Vercel's Node runtime is UTC, so a 15:00
 * activity displayed as 08:00 on every server-rendered page — seven hours early.
 *
 * The two halves disagreed in a second way that made it confusing to diagnose:
 * client components format in the BROWSER's timezone, so the same activity read
 * 15:00 in the calendar day sheet (correct, by accident of the viewer being in
 * Bangkok) and 08:00 on its detail page. Same data, two answers.
 *
 * Anchoring the display to Asia/Bangkok rather than to the viewer fixes both.
 * It is also the right domain rule: this is one Thai college's calendar, so an
 * activity happens at 15:00 Udon Thani time no matter where it is being read.
 *
 * Intl rather than date-fns-tz: no new dependency, and the same technique
 * date-fns-tz's toZonedTime uses internally.
 */

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Returns a Date whose LOCAL fields equal the instant's Bangkok wall clock, so
 * it can be handed to date-fns `format()` with every existing format string and
 * Thai locale unchanged.
 *
 * DISPLAY ONLY. The returned Date's epoch value is deliberately wrong — it is a
 * shim for formatting, never for arithmetic, comparison against a real instant,
 * or storage. Anything that needs a real point in time must keep using the
 * original ISO string.
 */
export function bangkokDate(iso: string | Date): Date {
  const parts = PARTS.formatToParts(typeof iso === "string" ? new Date(iso) : iso);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  // `hour` can come back as 24 for midnight under hour12:false in some ICU
  // versions; Date normalises 24 to 00 of the next day, which is the same
  // instant, so it needs no special case.
  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
}

/** The Bangkok calendar day of an instant, as `YYYY-MM-DD`. */
export function bangkokDayKey(iso: string | Date): string {
  const d = bangkokDate(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
