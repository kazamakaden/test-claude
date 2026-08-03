"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { approveUser, type ApproveUserResult } from "@/actions/approvals";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { Department } from "@/types/members";
import type { PendingProfile } from "@/types/profiles";

const NO_DEPARTMENT = "__none__";
// Matches schemas/approvals.ts's assignableRoles — kept as a literal list
// here too so the Select doesn't need to filter types/auth.ts's roles at
// render time for what is a fixed, small set.
const ASSIGNABLE_ROLES = ["student", "teacher", "aft_teacher"] as const;

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ApproveUserCard({
  profile,
  departments,
  lang,
  dict,
}: {
  profile: PendingProfile;
  departments: Department[];
  lang: Locale;
  dict: Dictionary;
}) {
  const [state, formAction] = useActionState<ApproveUserResult | null, FormData>(
    approveUser,
    null
  );
  const d = dict.approvals;
  const roleOptions = dict.roles;

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) toast.success(d.approved);
  }, [errorMessage, state, d.approved]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="id" value={profile.id} />

      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">
          {profile.fullName ?? profile.email}
        </p>
        <p className="text-xs text-muted-foreground">{profile.email}</p>
        {profile.studentId ? (
          <p className="text-xs text-muted-foreground">
            {d.columnStudentId}: {profile.studentId}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {d.signedUpAt}: {format(new Date(profile.createdAt), "d MMM yyyy")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <FormField name="role" invalid={Boolean(errorMessage)}>
          <FormLabel>{d.roleLabel}</FormLabel>
          <Select name="role" defaultValue="student">
            <SelectTrigger aria-label={d.roleLabel} className="w-40">
              <SelectValue placeholder={d.roleLabel}>
                {(value: string) => roleOptions[value as keyof typeof roleOptions]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleOptions[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormError>{errorMessage}</FormError>
        </FormField>

        <FormField name="departmentId">
          <FormLabel>{d.departmentLabel}</FormLabel>
          <Select name="departmentId" defaultValue={NO_DEPARTMENT}>
            <SelectTrigger aria-label={d.departmentLabel} className="w-40">
              <SelectValue placeholder={d.departmentLabel}>
                {(value: string) =>
                  value === NO_DEPARTMENT
                    ? d.noDepartment
                    : departments.find((dept) => dept.id === value)?.nameTh
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DEPARTMENT}>{d.noDepartment}</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.nameTh}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <SubmitButton label={d.approve} pendingLabel={d.approving} />
      </div>
    </form>
  );
}
