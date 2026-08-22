export type ActivityStatus = "pending" | "completed" | "cancelled";

/** One banner photo. Max 10 per activity, enforced by 0063's sort_order constraint. */
export interface ActivityBanner {
  id: string;
  storagePath: string;
  /** Public URL. The activity-banners bucket is public (0063), so no signing round trip. */
  url: string;
  sortOrder: number;
}

/** Somebody the owner granted edit rights to (0061). */
export interface ActivityEditor {
  userId: string;
  fullName: string | null;
  studentCode: string | null;
  createdAt: string;
}

/** An activity plus everything the detail page needs. */
export interface ActivityDetail extends Activity {
  createdBy: string | null;
  expectedAttendees: number | null;
  banners: ActivityBanner[];
  /**
   * Whether the VIEWER may edit. Mirrors can_edit_activity() (0061) for the UI
   * only -- every write is re-checked by the database, which is the boundary.
   */
  canEdit: boolean;
}

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
  /** อวท. or ชมรม (0068). Chosen at creation, never null. */
  category: "org" | "club";
  /**
   * draft until someone confirms it (0068). Only staff ever see a draft here —
   * the SELECT policies hide them from students and guests — so the day sheet
   * can render the badge unconditionally.
   */
  publishStatus: "draft" | "published";
}
