import "server-only";
import { endOfMonth, startOfMonth } from "date-fns";
import type { Locale } from "@/lib/i18n/config";
import type { Holiday, HolidayFeed } from "@/types/holidays";

/**
 * §8 "ปฏิทินวันหยุด" — Thai public holidays, sourced from the same Google
 * Calendar the user pointed at
 * (https://calendar.google.com/calendar/u/0/newembed?src=th.th%23holiday@group.v.calendar.google.com).
 * That embed URL's `src` param IS the calendar id; the public ICS export of
 * the same calendar is what this fetches directly, rendered in the app's
 * own card styling instead of an iframe (an iframe would render in
 * Google's own blue chrome, breaking the §3 monochrome palette, and
 * wouldn't fit at 375px).
 *
 * `en.th#holiday@...` is Google's English-language sibling of the same
 * Thailand holiday calendar — used for `lang === "en"` so the event names
 * match the viewer's locale. Not independently confirmed reachable from
 * this environment (calendar.google.com is blocked by this session's
 * network policy); if it 404s or doesn't exist, getHolidays() falls back
 * to the Thai feed rather than showing nothing.
 */
const HOLIDAY_CALENDAR_ID_TH = "th.th#holiday@group.v.calendar.google.com";
const HOLIDAY_CALENDAR_ID_EN = "en.th#holiday@group.v.calendar.google.com";

function icsUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

/**
 * RFC 5545 §3.1: a content line longer than 75 octets is "folded" by
 * inserting CRLF followed by a single leading whitespace character before
 * the continuation. Thai holiday names are long enough to hit this in
 * practice, so unfolding first is required — without it, SUMMARY/DTSTART
 * values silently truncate at the fold point instead of parsing wrong in
 * an obvious way.
 */
function unfold(ics: string): string[] {
  const normalized = ics.replace(/\r\n/g, "\n");
  const lines: string[] = [];
  for (const line of normalized.split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** RFC 5545 §3.3.11 TEXT escaping — the inverse of what a compliant calendar producer applies to SUMMARY. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** `YYYYMMDD` (an all-day VEVENT's DTSTART;VALUE=DATE) -> `YYYY-MM-DD`. No time component to lose. */
function parseIcsDate(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseIcs(ics: string): Holiday[] {
  const lines = unfold(ics);
  const holidays: Holiday[] = [];

  let inEvent = false;
  let date: string | null = null;
  let name: string | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      date = null;
      name = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && date && name) holidays.push({ date, name });
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    // Property lines look like "NAME;PARAM=value:VALUE" — split on the
    // first unparameterized colon (a name can carry `;VALUE=DATE` etc.,
    // which is exactly what marks an all-day event's DTSTART).
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const rawName = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);

    if (rawName === "DTSTART" || rawName.startsWith("DTSTART;")) {
      date = parseIcsDate(value);
    } else if (rawName === "SUMMARY") {
      name = unescapeText(value);
    }
  }

  return holidays;
}

async function fetchIcs(calendarId: string): Promise<string | null> {
  try {
    // 24h cache: holiday calendars change on roughly a yearly cadence, so
    // this keeps the dashboard off Google's rate limits and off the
    // request's own latency path.
    const res = await fetch(icsUrl(calendarId), { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    // fetch() genuinely throws on a network error (unlike the Supabase
    // client's own { data, error } shape) — this is what actually makes
    // getHolidays() fail soft rather than take the dashboard card down.
    return null;
  }
}

/**
 * Upcoming Thai public holidays, soonest first. Fails soft to `[]` on any
 * network/parse problem — same contract as every other dashboard service
 * function (`if (error || !data) return []`), so HolidayCard's existing
 * CardEmpty path is what a real outage looks like, not a crash.
 */
export async function getHolidays(lang: Locale, month?: Date): Promise<HolidayFeed> {
  const preferredId = lang === "en" ? HOLIDAY_CALENDAR_ID_EN : HOLIDAY_CALENDAR_ID_TH;
  let ics = await fetchIcs(preferredId);
  if (!ics && preferredId !== HOLIDAY_CALENDAR_ID_TH) {
    ics = await fetchIcs(HOLIDAY_CALENDAR_ID_TH);
  }
  // Reached only when every feed attempt failed — a network error, a non-2xx,
  // or an egress policy blocking calendar.google.com. Reported as "unavailable"
  // so the UI can say the data is unverified rather than silently implying
  // that there are no holidays.
  if (!ics) return { holidays: [], status: "unavailable" };

  const today = new Date();

  // Bounded rather than unbounded: Google's feed carries several years
  // forward, and returning all of it (~100 rows) is what made the dashboard
  // calendar card grow past the viewport. Deliberately a date window and not
  // a `slice(n)` — CalendarGrid marks day cells from this same array, so
  // truncating to a count would silently drop markers.
  //
  // The window covers BOTH the next 12 months (what the ปฏิทินวันหยุด panel
  // lists) AND the month currently being displayed, which may be in the past:
  // the calendar can be paged back 24 months (schemas/calendar.ts), and a
  // future-only filter left those months with no holiday markers at all.
  const forwardHorizon = new Date(today);
  forwardHorizon.setFullYear(forwardHorizon.getFullYear() + 1);

  const displayed = month ?? today;
  const lower = new Date(Math.min(startOfMonth(displayed).getTime(), startOfMonth(today).getTime()));
  const upper = new Date(Math.max(endOfMonth(displayed).getTime(), forwardHorizon.getTime()));

  const lowerIso = lower.toISOString().slice(0, 10);
  const upperIso = upper.toISOString().slice(0, 10);

  const holidays = parseIcs(ics)
    .filter((h) => h.date >= lowerIso && h.date <= upperIso)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { holidays, status: "ok" };
}
