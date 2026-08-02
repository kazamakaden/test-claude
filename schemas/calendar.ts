import { addMonths, startOfMonth, subMonths } from "date-fns";

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;
const RANGE_MONTHS = 24;

/**
 * Parses `?month=YYYY-MM` into the first day of that month. Anything
 * malformed, out of a sane ±24-month range, or absent falls back to the
 * current month — the calendar always renders something, never a blank
 * error page over a bad query string. URL-driven (not client state) so the
 * page works with JS disabled, same guarantee as the login form.
 */
export function parseMonthParam(raw: string | undefined): Date {
  const now = startOfMonth(new Date());
  if (!raw || !MONTH_PARAM_PATTERN.test(raw)) return now;

  const [year, month] = raw.split("-").map(Number);
  if (month < 1 || month > 12) return now;

  const candidate = new Date(year, month - 1, 1);
  const minDate = subMonths(now, RANGE_MONTHS);
  const maxDate = addMonths(now, RANGE_MONTHS);
  if (candidate < minDate || candidate > maxDate) return now;

  return candidate;
}

export function formatMonthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
