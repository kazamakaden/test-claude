"use client";

import { departmentLevelLabel } from "@/lib/student-id";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from "@/actions/members";
import { DEPARTMENT_CODE_LENGTH, YEAR_LENGTH } from "@/lib/student-id";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { DepartmentUsage } from "@/types/members";

/** How much is attached to a สาขา — anything non-zero blocks deletion. */
function linkedCount(d: DepartmentUsage) {
  return d.memberCount + d.activityCount + d.projectCount;
}

/**
 * The §14 ID shape, shown once above the table so the 5-digit code in each row
 * is obviously the middle segment rather than an arbitrary id.
 */
function PatternLegend({ d }: { d: Dictionary["members"]["departments"] }) {
  const segments = [
    { label: d.patternYear, sample: "6".repeat(YEAR_LENGTH) },
    { label: d.patternSubject, sample: "2".repeat(DEPARTMENT_CODE_LENGTH) },
    { label: d.patternNumber, sample: "0000" },
  ];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">{d.patternTitle}</p>
      <div className="flex flex-wrap items-end gap-2">
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-end gap-2">
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-lg tracking-widest text-foreground">{s.sample}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            {i < segments.length - 1 ? (
              <span className="pb-5 text-lg text-muted-foreground" aria-hidden>
                +
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{d.patternNote}</p>
    </div>
  );
}

export function DepartmentsTable({
  departments,
  lang,
  dict,
}: {
  departments: DepartmentUsage[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.members.departments;
  const errors = dict.members.autoinput.errors;
  const router = useRouter();
  const [pending, start] = useTransition();
  // Which row is mid-flight, so saving one row does not disable all 29.
  const [busyId, setBusyId] = useState<string | null>(null);

  // NO local copy of `departments`. The Server Actions revalidate this page
  // and router.refresh() re-renders it, so the server stays the single source
  // of truth — the AutoInputForm above reads the same list, and a private
  // copy here is exactly how the two ended up disagreeing on one screen.
  const rows = departments;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTh, setDraftTh] = useState("");
  const [draftEn, setDraftEn] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newTh, setNewTh] = useState("");
  const [newEn, setNewEn] = useState("");

  function fail(messageKey: string) {
    toast.error(errors[messageKey as keyof typeof errors] ?? errors.unknown);
  }

  function handleAdd() {
    start(async () => {
      const result = await createDepartmentAction(lang, {
        code: newCode,
        nameTh: newTh,
        nameEn: newEn,
      });
      if (!result.ok) return fail(result.messageKey);
      setNewCode("");
      setNewTh("");
      setNewEn("");
      // Re-renders the Server Components with the new list while preserving
      // client state (the email half-typed in the form above survives).
      router.refresh();
      toast.success(d.added);
    });
  }

  function handleSave(id: string) {
    setBusyId(id);
    start(async () => {
      const result = await updateDepartmentAction(lang, {
        id,
        nameTh: draftTh,
        nameEn: draftEn,
      });
      setBusyId(null);
      if (!result.ok) return fail(result.messageKey);
      setEditingId(null);
      router.refresh();
      toast.success(d.saved);
    });
  }

  function handleDelete(id: string) {
    setBusyId(id);
    start(async () => {
      const result = await deleteDepartmentAction(lang, id);
      setBusyId(null);
      if (!result.ok) return fail(result.messageKey);
      router.refresh();
      toast.success(d.deleted);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{d.title}</h2>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      <PatternLegend d={d} />

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">{d.columnCode}</TableHead>
              <TableHead className="w-24">{d.columnLevel}</TableHead>
              <TableHead>{d.columnNameTh}</TableHead>
              <TableHead>{d.columnNameEn}</TableHead>
              <TableHead className="w-24">{d.columnMembers}</TableHead>
              <TableHead className="w-40">{d.columnActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {d.empty}
                </TableCell>
              </TableRow>
            ) : null}

            {rows.map((row) => {
              const linked = linkedCount(row);
              const editing = editingId === row.id;
              return (
                <TableRow key={row.id}>
                  {/* The code is never an input — see updateDepartmentSchema. */}
                  <TableCell className="font-mono text-foreground" title={d.codeLocked}>
                    {row.code}
                  </TableCell>
                  {/* Derived from the code's first digit, never stored — see
                      departmentLevelLabel. Three สาขา names exist at two
                      levels, so the name alone is ambiguous. */}
                  <TableCell className="text-muted-foreground">
                    {departmentLevelLabel(row.code, dict.common.levels)}
                  </TableCell>
                  <TableCell>
                    {editing ? (
                      <Input
                        value={draftTh}
                        maxLength={100}
                        aria-label={d.columnNameTh}
                        onChange={(e) => setDraftTh(e.target.value)}
                      />
                    ) : (
                      row.nameTh
                    )}
                  </TableCell>
                  <TableCell>
                    {editing ? (
                      <Input
                        value={draftEn}
                        maxLength={100}
                        aria-label={d.columnNameEn}
                        onChange={(e) => setDraftEn(e.target.value)}
                      />
                    ) : (
                      <span className="text-muted-foreground">{row.nameEn}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.memberCount}</TableCell>
                  <TableCell>
                    {editing ? (
                      <div className="flex gap-1">
                        <Button size="sm" disabled={busyId === row.id} onClick={() => handleSave(row.id)}>
                          <Check className="size-4" aria-hidden />
                          {busyId === row.id ? d.saving : d.save}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          aria-label={d.cancel}
                        >
                          <X className="size-4" aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`${d.edit} ${row.nameTh}`}
                          onClick={() => {
                            setEditingId(row.id);
                            setDraftTh(row.nameTh);
                            setDraftEn(row.nameEn);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                          {d.edit}
                        </Button>

                        {/* Disabled rather than hidden when in use: the reason
                            is the useful part, and the FK would refuse anyway. */}
                        {linked > 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled
                            title={d.deleteBlocked}
                            aria-label={`${d.delete} ${row.nameTh} — ${d.deleteBlocked}`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                            {d.delete}
                          </Button>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  aria-label={`${d.delete} ${row.nameTh}`}
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                  {d.delete}
                                </Button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{d.deleteTitle}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {row.code} · {row.nameTh} — {d.deleteDescription}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={busyId === row.id}
                                  onClick={() => handleDelete(row.id)}
                                >
                                  {busyId === row.id ? d.deleting : d.delete}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{d.addTitle}</p>
          <p className="text-xs text-muted-foreground">{d.addHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr_auto]">
          <Input
            value={newCode}
            inputMode="numeric"
            maxLength={DEPARTMENT_CODE_LENGTH}
            placeholder={"2".repeat(DEPARTMENT_CODE_LENGTH)}
            aria-label={d.columnCode}
            className="font-mono"
            onChange={(e) => setNewCode(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <Input
            value={newTh}
            maxLength={100}
            placeholder={d.columnNameTh}
            aria-label={d.columnNameTh}
            onChange={(e) => setNewTh(e.target.value)}
          />
          <Input
            value={newEn}
            maxLength={100}
            placeholder={d.columnNameEn}
            aria-label={d.columnNameEn}
            onChange={(e) => setNewEn(e.target.value)}
          />
          <Button
            type="button"
            disabled={pending || newCode.length !== DEPARTMENT_CODE_LENGTH || !newTh || !newEn}
            onClick={handleAdd}
          >
            <Plus className="size-4" aria-hidden />
            {pending ? d.adding : d.add}
          </Button>
        </div>
      </div>
    </section>
  );
}
