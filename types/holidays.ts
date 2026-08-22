/**
 * One row from the public Thai-holiday Google Calendar feed
 * (services/holidays.ts). `date` is the ISO `YYYY-MM-DD` day the holiday
 * falls on — these are all-day VEVENTs (`DTSTART;VALUE=DATE`), so there is
 * no time component to carry.
 */
export interface Holiday {
  date: string;
  name: string;
}

/**
 * Why a status and not just an empty array: `getHolidays()` previously
 * returned `[]` for BOTH "the feed could not be reached" and "this window
 * genuinely contains no holidays". Those are different facts and the UI must
 * say different things about them — several Thai months really do have no
 * public holiday, so warning on every empty list would cry wolf.
 */
export type HolidayFeedStatus = "ok" | "unavailable";

export interface HolidayFeed {
  holidays: Holiday[];
  status: HolidayFeedStatus;
}
