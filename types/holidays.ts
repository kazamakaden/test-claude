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
