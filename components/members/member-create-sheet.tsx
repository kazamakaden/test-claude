"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { PasswordStrengthField } from "@/components/auth/password-strength";
import { createMemberAction, type CreateMemberResult } from "@/actions/members";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { Club, Department } from "@/types/members";

const NO_DEPARTMENT = "__none__";
const NO_CLUB = "__none__";
// Unlike member-edit-sheet.tsx's assignableRoles, this is not narrowed by
// actor role — createMemberAction is gated on member:manage, which only
// `admin` is deliberately absent — granting it stays out-of-band.
const ASSIGNABLE_ROLES = ["student", "teacher"] as const;

// See the identical note in member-edit-sheet.tsx: useFormStatus only
// tracks the <form> it's a DOM descendant of.
function CreateButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * §1: "Add user" — for someone who can't use Google OAuth. Admin-only
 * (gated server-side in createMemberAction on member:manage); the button
 * that renders this trigger is itself gated the same way in
 * members-table.tsx, but the action re-checks regardless (§19).
 */
export function MemberCreateSheet({
  departments,
  clubs,
  lang,
  dict,
}: {
  departments: Department[];
  clubs: Club[];
  lang: Locale;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<CreateMemberResult | null, FormData>(
    createMemberAction,
    null
  );
  const d = dict.members.create;
  const roleOptions = dict.roles;

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) {
      toast.success(d.created);
      setOpen(false);
    }
  }, [errorMessage, state, d.created]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <UserPlus className="size-4" aria-hidden />
        {dict.members.addButton}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{d.title}</SheetTitle>
          <SheetDescription>{d.description}</SheetDescription>
        </SheetHeader>

        <form action={formAction} className="flex flex-1 flex-col overflow-hidden">
          <input type="hidden" name="lang" value={lang} />

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <FormField name="email" invalid={Boolean(errorMessage)}>
              <FormLabel>{d.emailLabel}</FormLabel>
              <Input name="email" type="email" required autoComplete="off" placeholder={d.emailPlaceholder} />
            </FormField>

            <PasswordStrengthField
              name="password"
              label={d.passwordLabel}
              invalid={Boolean(errorMessage)}
              errorMessage={errorMessage}
              dict={dict}
            />

            <FormField name="fullName">
              <FormLabel>{d.fullNameLabel}</FormLabel>
              <Input name="fullName" maxLength={100} />
            </FormField>

            <FormField name="role">
              <FormLabel>{d.roleLabel}</FormLabel>
              <Select name="role" defaultValue="student">
                <SelectTrigger aria-label={d.roleLabel}>
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
            </FormField>

            <FormField name="departmentId">
              <FormLabel>{d.departmentLabel}</FormLabel>
              <Select name="departmentId" defaultValue={NO_DEPARTMENT}>
                <SelectTrigger aria-label={d.departmentLabel}>
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

            <FormField name="clubId">
              <FormLabel>{d.clubLabel}</FormLabel>
              <Select name="clubId" defaultValue={NO_CLUB}>
                <SelectTrigger aria-label={d.clubLabel}>
                  <SelectValue placeholder={d.clubLabel}>
                    {(value: string) =>
                      value === NO_CLUB ? d.noClub : clubs.find((club) => club.id === value)?.nameTh
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLUB}>{d.noClub}</SelectItem>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.nameTh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField name="className">
              <FormLabel>{d.classLabel}</FormLabel>
              <Input name="className" maxLength={50} />
            </FormField>

            <FormField name="studentId">
              <FormLabel>{d.studentIdLabel}</FormLabel>
              <Input name="studentId" maxLength={20} />
              <FormDescription>{d.studentIdHint}</FormDescription>
            </FormField>
          </div>

          <SheetFooter>
            <CreateButton label={d.create} pendingLabel={d.creating} />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
