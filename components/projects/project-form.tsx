"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject, saveProjectDraft, type SaveProjectResult } from "@/actions/projects";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { Department } from "@/types/members";
import type { Project } from "@/types/projects";

const NO_DEPARTMENT = "__none__";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ProjectForm({
  mode,
  project,
  departments,
  lang,
  dict,
}: {
  mode: "create" | "edit";
  project?: Project;
  departments: Department[];
  lang: Locale;
  dict: Dictionary;
}) {
  const action = mode === "create" ? createProject : saveProjectDraft;
  const [state, formAction] = useActionState<SaveProjectResult | null, FormData>(action, null);
  const d = dict.projects;

  const errorMessage = state && !state.ok ? d.form.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
  }, [errorMessage]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="lang" value={lang} />
      {mode === "edit" && project ? <input type="hidden" name="id" value={project.id} /> : null}

      <FormField name="title" invalid={Boolean(errorMessage)}>
        <FormLabel>{d.form.titleLabel}</FormLabel>
        <Input name="title" required maxLength={200} defaultValue={project?.title} />
        <FormError>{errorMessage}</FormError>
      </FormField>

      <FormField name="description">
        <FormLabel>{d.form.descriptionLabel}</FormLabel>
        <Textarea name="description" maxLength={5000} rows={6} defaultValue={project?.description ?? ""} />
      </FormField>

      <FormField name="departmentId">
        <FormLabel>{d.form.departmentLabel}</FormLabel>
        <Select name="departmentId" defaultValue={project?.departmentId ?? NO_DEPARTMENT}>
          <SelectTrigger aria-label={d.form.departmentLabel} className="w-full">
            <SelectValue placeholder={d.form.departmentLabel}>
              {(value: string) =>
                value === NO_DEPARTMENT
                  ? d.form.noDepartment
                  : departments.find((dept) => dept.id === value)?.nameTh
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEPARTMENT}>{d.form.noDepartment}</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.nameTh}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <SubmitButton
        label={mode === "create" ? d.form.submit : d.form.save}
        pendingLabel={mode === "create" ? d.form.submitting : d.form.saving}
      />
    </form>
  );
}
