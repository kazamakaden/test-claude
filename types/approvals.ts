import type { Role } from "@/types/auth";

export interface ApprovedAccount {
  id: string;
  email: string;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
  note: string | null;
  approvedByName: string | null;
  createdAt: string;
}
