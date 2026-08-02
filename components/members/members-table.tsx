import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardEmpty } from "@/components/dashboard/card-states";
import type { Member, MemberFilters, MemberSortColumn } from "@/types/members";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const SORTABLE_COLUMNS: { key: MemberSortColumn; labelKey: keyof Dictionary["members"] }[] = [
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
  lang,
  dict,
}: {
  members: Member[];
  filters: MemberFilters;
  pathname: string;
  searchParams: URLSearchParams;
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium text-foreground">{m.fullName}</TableCell>
            <TableCell className="text-muted-foreground">{m.studentId ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{m.className ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{m.academicYear ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{m.departmentName ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{m.clubName ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
