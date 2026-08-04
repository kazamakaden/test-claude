export type ActivityStatus = "pending" | "completed" | "cancelled";

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  isPublic: boolean;
  academicYear: number | null;
  departmentId: string | null;
  departmentName: string | null;
  clubId: string | null;
  clubName: string | null;
}

export type ActivitySortColumn = "startsAt" | "title" | "status";
export type SortDirection = "asc" | "desc";

export interface ActivityFilters {
  search: string;
  departmentId: string | null;
  clubId: string | null;
  academicYear: number | null;
  status: ActivityStatus | null;
  sort: ActivitySortColumn;
  direction: SortDirection;
  page: number;
}

export interface ActivitiesResult {
  rows: Activity[];
  total: number;
}

/** §10 statistics strip — attendance reads from the attendance table, RLS-scoped. */
export interface ActivityCounts {
  attendance: number;
  completed: number;
  pending: number;
}

/**
 * Feeds /calendar's full month view and the dashboard's calendar
 * card/day-sheet — one query (services/activities.ts#getMonthActivities),
 * one shape. `description`/`endsAt` exist for the dashboard's clickable-day
 * sheet (needs enough to prefill an edit form); /calendar's MonthGrid/
 * MonthEventList simply don't read them.
 */
export interface MonthActivity {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
}
