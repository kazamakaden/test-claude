"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import {
  createDocumentAction,
  saveDocumentDraftAction,
  type SaveDocumentResult,
} from "@/actions/documents";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { DocumentWorkflowDetail } from "@/types/documents";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function DocumentForm({
  mode,
  document,
  lang,
  dict,
}: {
  mode: "create" | "edit";
  document?: DocumentWorkflowDetail;
  lang: Locale;
  dict: Dictionary;
}) {
  const action = mode === "create" ? createDocumentAction : saveDocumentDraftAction;
  const [state, formAction] = useActionState<SaveDocumentResult | null, FormData>(action, null);
  const d = dict.documents.manage;

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
      {mode === "edit" && document ? (
        <input type="hidden" name="documentId" value={document.id} />
      ) : null}

      <FormField name="title" invalid={Boolean(errorMessage)}>
        <FormLabel>{d.form.titleLabel}</FormLabel>
        <Input name="title" required maxLength={200} defaultValue={document?.title} />
        <FormError>{errorMessage}</FormError>
      </FormField>

      {mode === "edit" ? (
        <FormField name="content">
          <FormLabel>{d.form.contentLabel}</FormLabel>
          <Textarea name="content" maxLength={20000} rows={12} defaultValue={document?.draft?.content ?? ""} />
        </FormField>
      ) : null}

      <SubmitButton
        label={mode === "create" ? d.form.create : d.form.save}
        pendingLabel={mode === "create" ? d.form.creating : d.form.saving}
      />
    </form>
  );
}
