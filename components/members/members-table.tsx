import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, User, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardEmpty } from "@/components/dashboard/card-states";
import { MemberEditSheet } from "@/components/members/member-edit-sheet";
import type { Club, Department, Member, MemberFilters, MemberSortColumn } from "@/types/members";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { Role } from "@/types/auth";

const SORTABLE_COLUMNS: {
  key: MemberSortColumn;
  labelKey: "columnName" | "columnStudentId" | "columnClass" | "columnYear";
}[] = [
  { key: "fullName", labelKey: "columnName" },
  { key: "studentId", labelKey: "columnStudentId" },
  { key: "className", labelKey: "columnClass" },
  { key: "academicYear", labelKey: "columnYear" },
];

function sortHref(
  pathname: string,
  searchParams: URLSearchParams,
  column: MemberSortColumn,
  filters: MemberFilters
) {
  const params = new URLSearchParams(searchParams.toString());
  const nextDirection = filters.sort === column && filters.direction === "asc" ? "desc" : "asc";
  params.set("sort", column);
  params.set("dir", nextDirection);
  return `${pathname}?${params.toString()}`;
}

export function MembersTable({
  members,
  filters,
  pathname,
  searchParams,
  departments,
  clubs,
  canEdit,
  actorRole,
  lang,
  dict,
}: {
  members: Member[];
  filters: MemberFilters;
  pathname: string;
  searchParams: URLSearchParams;
  departments: Department[];
  clubs: Club[];
  /** Whether the viewer holds member:approve — gates the actions column entirely. */
  canEdit: boolean;
  actorRole: Role;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.members;

  if (members.length === 0) {
    return (
      <CardEmpty
        icon={Users}
        message={d.empty}
        ctaLabel={d.clearFilters}
        ctaHref="/members"
        lang={lang}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORTABLE_COLUMNS.map(({ key, labelKey }) => {
            const active = filters.sort === key;
            const Icon = active ? (filters.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
            return (
              <TableHead key={key}>
                <Link
                  href={sortHref(pathname, searchParams, key, filters)}
                  className="flex items-center gap-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-sort={active ? (filters.direction === "asc" ? "ascending" : "descending") : "none"}
                >
                  {d[labelKey]}
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                </Link>
              </TableHead>
            );
          })}
          <TableHead>{d.columnDepartment}</TableHead>
          <TableHead>{d.columnClub}</TableHead>
          {canEdit ? <TableHead>{d.columnActions}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium text-foreground">
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarImage src={m.avatarUrl ?? undefined} referrerPolicy="no-referrer" />
                  <AvatarFallback>
                    <User className="size-3.5" aria-hidden />
                  </AvatarFallback>
                </Avatar>
                {m.fullName}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{m.studentId ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{m.className ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{m.academicYear ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{m.departmentName ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{m.clubName ?? "—"}</TableCell>
            {canEdit ? (
              <TableCell>
                {/* "admin" is deliberately never an assignable role (same
                    reasoning as approve-user-card.tsx) — the role Select
                    has no matching option for it, so an admin row can't be
                    edited through this sheet at all. Hide the trigger
                    rather than open a sheet with a role field that can
                    never validate. */}
                {m.role !== "admin" ? (
                  <MemberEditSheet
                    member={m}
                    departments={departments}
                    clubs={clubs}
                    actorRole={actorRole}
                    lang={lang}
                    dict={dict}
                  />
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
