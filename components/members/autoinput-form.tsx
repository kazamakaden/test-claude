"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormDescription } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasswordStrengthField } from "@/components/auth/password-strength";
import {
  createMemberAction,
  createDepartmentAction,
  type CreateMemberResult,
} from "@/actions/members";
import { parseStudentId } from "@/lib/student-id";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { Club, Department } from "@/types/members";

const NO_CLUB = "__none__";
const ASSIGNABLE_ROLES = ["student", "teacher"] as const;

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** One read-only cell of the parsed breakdown. */
function DetectedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

/**
 * §14 "Auto input": type a student email, and year / รหัสวิชา / number fall out
 * of it. The รหัสวิชา is resolved against the real department list; when it is
 * one the college has not registered yet, it can be added inline without
 * losing what has already been typed.
 */
export function AutoInputForm({
  departments: initialDepartments,
  clubs,
  lang,
  dict,
}: {
  departments: Department[];
  clubs: Club[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.members.autoinput;
  const dCreate = dict.members.create;

  const [email, setEmail] = useState("");
  // Local copy so a newly added รหัสวิชา is usable immediately, without a
  // reload that would discard the email and every other field already typed.
  const [departments, setDepartments] = useState(initialDepartments);
  const [newNameTh, setNewNameTh] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [addingDept, startAddDept] = useTransition();

  const parsed = useMemo(() => parseStudentId(email), [email]);
  const matchedDepartment = useMemo(
    () =>
      parsed
        ? // The 5-digit department code, NOT parsed.programCode: the two
          // digits after it are the student's group, so matching on all 7
          // would miss every student outside group "00" and offer to create
          // a department that already exists (0043).
          departments.find((dep) => dep.code === parsed.departmentCode) ?? null
        : null,
    [parsed, departments]
  );

  const [state, formAction] = useActionState<CreateMemberResult | null, FormData>(
    createMemberAction,
    null
  );
  const errorMessage = state && !state.ok ? dCreate.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) toast.success(dCreate.created);
  }, [errorMessage, state, dCreate.created]);

  function handleAddDepartment() {
    if (!parsed) return;
    startAddDept(async () => {
      const result = await createDepartmentAction(lang, {
        code: parsed.departmentCode,
        nameTh: newNameTh,
        nameEn: newNameEn,
      });
      if (!result.ok) {
        toast.error(d.errors[result.messageKey]);
        return;
      }
      setDepartments((prev) => [...prev, result.department]);
      setNewNameTh("");
      setNewNameEn("");
      toast.success(d.departmentAdded);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="lang" value={lang} />

      <FormField name="email">
        <FormLabel>{d.emailLabel}</FormLabel>
        <Input
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder={d.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormDescription>{d.description}</FormDescription>
      </FormField>

      {email.trim() !== "" && !parsed ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {d.notStudentEmail}
        </p>
      ) : null}

      {parsed ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">{d.detected}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DetectedValue label={d.yearLabel} value={parsed.year} />
            <DetectedValue label={d.programCodeLabel} value={parsed.programCode} />
            <DetectedValue label={d.departmentCodeLabel} value={parsed.departmentCode} />
            <DetectedValue label={d.groupCodeLabel} value={parsed.groupCode} />
            <DetectedValue label={d.studentNumberLabel} value={parsed.studentNumber} />
            <DetectedValue label={d.studentIdLabel} value={parsed.studentId} />
            {/* ปวช./ปวส. comes from รหัสวิชา's first digit. An unrecognised
                digit shows "unknown" rather than blocking the member — a
                future level must not stop a real student being admitted. */}
            <DetectedValue
              label={d.levelLabel}
              value={parsed.level ? d.levels[parsed.level] : d.levels.unknown}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {matchedDepartment
              ? `${d.departmentMatched} — ${lang === "th" ? matchedDepartment.nameTh : matchedDepartment.nameEn}`
              : d.departmentNew}
          </p>

          {/* New รหัสวิชา: only the two names are asked for, the code is
              already known from the email. */}
          {!matchedDepartment ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">{d.addDepartmentTitle}</p>
              <FormField name="newDepartmentCode">
                <FormLabel>{d.departmentCodeLabel}</FormLabel>
                <Input value={parsed.departmentCode} readOnly className="font-mono" />
              </FormField>
              <FormField name="newDepartmentNameTh">
                <FormLabel>{d.departmentNameThLabel}</FormLabel>
                <Input
                  value={newNameTh}
                  maxLength={100}
                  onChange={(event) => setNewNameTh(event.target.value)}
                />
              </FormField>
              <FormField name="newDepartmentNameEn">
                <FormLabel>{d.departmentNameEnLabel}</FormLabel>
                <Input
                  value={newNameEn}
                  maxLength={100}
                  onChange={(event) => setNewNameEn(event.target.value)}
                />
              </FormField>
              {/* type="button": this must not submit the member form. */}
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddDepartment}
                disabled={addingDept || newNameTh.trim() === "" || newNameEn.trim() === ""}
              >
                {addingDept ? d.addingDepartment : d.addDepartment}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Derived, not typed — but still submitted and re-validated by
          createMemberSchema server-side. readOnly is UX, never the guard. */}
      <input type="hidden" name="studentId" value={parsed?.studentId ?? ""} />
      <input type="hidden" name="departmentId" value={matchedDepartment?.id ?? ""} />

      <PasswordStrengthField name="password" label={dCreate.passwordLabel} dict={dict} />

      <FormField name="fullName">
        <FormLabel>{dCreate.fullNameLabel}</FormLabel>
        <Input name="fullName" maxLength={100} />
      </FormField>

      <FormField name="role">
        <FormLabel>{dCreate.roleLabel}</FormLabel>
        <Select name="role" defaultValue="student">
          <SelectTrigger aria-label={dCreate.roleLabel}>
            <SelectValue placeholder={dCreate.roleLabel}>
              {(value) => dict.roles[value as (typeof ASSIGNABLE_ROLES)[number]]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ASSIGNABLE_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {dict.roles[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField name="className">
        <FormLabel>{dCreate.classLabel}</FormLabel>
        <Input name="className" maxLength={50} />
      </FormField>

      <FormField name="clubId">
        <FormLabel>{dCreate.clubLabel}</FormLabel>
        <Select name="clubId" defaultValue={NO_CLUB}>
          <SelectTrigger aria-label={dCreate.clubLabel}>
            <SelectValue placeholder={dCreate.clubLabel}>
              {(value) =>
                value === NO_CLUB
                  ? dCreate.noClub
                  : (() => {
                      const club = clubs.find((c) => c.id === value);
                      return club ? (lang === "th" ? club.nameTh : club.nameEn) : dCreate.noClub;
                    })()
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLUB}>{dCreate.noClub}</SelectItem>
            {clubs.map((club) => (
              <SelectItem key={club.id} value={club.id}>
                {lang === "th" ? club.nameTh : club.nameEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <div className="flex justify-end">
        <SubmitButton label={d.submit} pendingLabel={dCreate.creating} />
      </div>
    </form>
  );
}
