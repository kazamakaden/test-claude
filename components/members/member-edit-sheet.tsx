"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormDescription, FormError } from "@/components/ui/form";
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
  SheetFooter,
} from "@/components/ui/sheet";
import { updateMemberAction, type UpdateMemberResult } from "@/actions/members";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { memberPositions, type Role } from "@/types/auth";
import type { Club, Department, Member } from "@/types/members";

const NO_DEPARTMENT = "__none__";
// Same sentinel shape as NO_DEPARTMENT/NO_CLUB above: a Base UI Select needs
// a real value for "none". actions/members.ts maps it back to null.
const NO_POSITION = "__none__";
const NO_CLUB = "__none__";
// `admin` stays out of every UI — promote in the database, out of band
// (prevent_role_self_escalation, 0046). `guest` is not a storable member
// role. That leaves exactly these two.
const ASSIGNABLE_ROLES = ["student", "teacher"] as const;

// useFormStatus only reports the correct pending state for a DOM descendant
// of the <form> it tracks — a `form="id"`-wired button outside the tree
// does not qualify. Rendered inside <form> below, in the (non-scrolling)
// footer area of a flex column, so the fields above it can scroll on their
// own without needing a second <form>.
function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function MemberEditSheet({
  member,
  departments,
  clubs,
  actorRole,
  lang,
  dict,
}: {
  member: Member;
  departments: Department[];
  clubs: Club[];
  actorRole: Role;
  lang: Locale;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<UpdateMemberResult | null, FormData>(
    updateMemberAction,
    null
  );
  const d = dict.members.edit;
  const roleOptions = dict.roles;
  // Both entries are assignable by anyone who can reach this form
  // (admin or a ตำแหน่ง holder), so no actor-based narrowing is needed.
  const assignableRoles = ASSIGNABLE_ROLES;

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) {
      toast.success(d.saved);
      setOpen(false);
    }
  }, [errorMessage, state, d.saved]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={`${d.editButton} ${member.fullName}`} />
        }
      >
        <Pencil className="size-4" aria-hidden />
        {d.editButton}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{d.title}</SheetTitle>
        </SheetHeader>

        <form action={formAction} className="flex flex-1 flex-col overflow-hidden">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="id" value={member.id} />

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <FormField name="fullName">
              <FormLabel>{d.fullNameLabel}</FormLabel>
              <Input name="fullName" defaultValue={member.fullName} maxLength={100} />
            </FormField>

            <FormField name="role" invalid={Boolean(errorMessage)}>
              <FormLabel>{d.roleLabel}</FormLabel>
              <Select name="role" defaultValue={member.role}>
                <SelectTrigger aria-label={d.roleLabel}>
                  <SelectValue placeholder={d.roleLabel}>
                    {(value: string) => roleOptions[value as keyof typeof roleOptions]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleOptions[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError>{errorMessage}</FormError>
            </FormField>

            {/* ตำแหน่ง — rendered ONLY for an admin, because only an admin may
                assign one (prevent_position_change, 0044). For everyone else
                the field is absent entirely rather than disabled, so the form
                submits no `position` key and updateMemberSchema's .optional()
                leaves the member's existing office untouched. The absence is
                UX; actions/members.ts re-checks the actor server-side. */}
            {actorRole === "admin" ? (
              <FormField name="position">
                <FormLabel>{dict.members.positionLabel}</FormLabel>
                <Select name="position" defaultValue={member.position ?? NO_POSITION}>
                  <SelectTrigger aria-label={dict.members.positionLabel}>
                    <SelectValue placeholder={dict.members.positionLabel}>
                      {(value: string) =>
                        value === NO_POSITION
                          ? dict.members.noPosition
                          : dict.positions[value as keyof typeof dict.positions]
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_POSITION}>{dict.members.noPosition}</SelectItem>
                    {memberPositions.map((position) => (
                      <SelectItem key={position} value={position}>
                        {dict.positions[position]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}

            <FormField name="departmentId">
              <FormLabel>{d.departmentLabel}</FormLabel>
              <Select name="departmentId" defaultValue={member.departmentId ?? NO_DEPARTMENT}>
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
              <Select name="clubId" defaultValue={member.clubId ?? NO_CLUB}>
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
              <Input name="className" defaultValue={member.className ?? ""} maxLength={50} />
            </FormField>

            <FormField name="studentId" invalid={Boolean(errorMessage)}>
              <FormLabel>{d.studentIdLabel}</FormLabel>
              <Input name="studentId" defaultValue={member.studentId ?? ""} maxLength={20} />
              <FormDescription>{d.studentIdHint}</FormDescription>
            </FormField>
          </div>

          <SheetFooter>
            <SaveButton label={d.save} pendingLabel={d.saving} />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
