"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { approveAccount, type ApproveAccountResult } from "@/actions/approvals";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { Department } from "@/types/members";

const NO_DEPARTMENT = "__none__";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ApproveAccountForm({
  departments,
  lang,
  dict,
}: {
  departments: Department[];
  lang: Locale;
  dict: Dictionary;
}) {
  const [state, formAction] = useActionState<ApproveAccountResult | null, FormData>(
    approveAccount,
    null
  );
  const d = dict.approvals;
  const roleOptions = dict.roles;

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) toast.success(d.addTitle);
  }, [errorMessage, state, d.addTitle]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <h2 className="font-heading text-base font-semibold text-foreground">{d.addTitle}</h2>
      <input type="hidden" name="lang" value={lang} />

      <FormField name="email" invalid={Boolean(errorMessage)}>
        <FormLabel>{d.emailLabel}</FormLabel>
        <Input name="email" type="email" required placeholder={d.emailPlaceholder} />
        <FormError>{errorMessage}</FormError>
      </FormField>

      <FormField name="role">
        <FormLabel>{d.roleLabel}</FormLabel>
        <Select name="role" defaultValue="student">
          <SelectTrigger aria-label={d.roleLabel} className="w-full">
            <SelectValue placeholder={d.roleLabel}>
              {(value: string) => roleOptions[value as keyof typeof roleOptions]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">{roleOptions.student}</SelectItem>
            <SelectItem value="teacher">{roleOptions.teacher}</SelectItem>
            <SelectItem value="aft_teacher">{roleOptions.aft_teacher}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField name="departmentId">
        <FormLabel>{d.departmentLabel}</FormLabel>
        <Select name="departmentId" defaultValue={NO_DEPARTMENT}>
          <SelectTrigger aria-label={d.departmentLabel} className="w-full">
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

      <FormField name="note">
        <FormLabel>{d.noteLabel}</FormLabel>
        <Input name="note" type="text" maxLength={200} />
      </FormField>

      <SubmitButton label={d.submit} pendingLabel={d.submitting} />
    </form>
  );
}
