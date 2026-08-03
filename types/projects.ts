export type ProjectStatus = "draft" | "teacher_review" | "admin_approval" | "official";
export type ProjectSortColumn = "updatedAt" | "title" | "status";
export type SortDirection = "asc" | "desc";

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  ownerId: string | null;
  ownerName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFilters {
  search: string;
  status: ProjectStatus | null;
  sort: ProjectSortColumn;
  direction: SortDirection;
  page: number;
}

export interface ProjectsResult {
  rows: Project[];
  total: number;
}
