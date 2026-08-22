"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormLabel, FormDescription, FormError } from "@/components/ui/form";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  type AnnouncementFormResult,
} from "@/actions/announcements";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { AnnouncementDraft } from "@/types/announcements";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * One form for create and edit — they differ only in which action they post to
 * and whether an id rides along, so two components would be two places to
 * forget a field.
 *
 * Native `<form action={...}>` + useActionState, so the editor submits and
 * validates without JavaScript, matching the pattern login-form.tsx
 * established. The Thai halves are required and the English optional, which is
 * the fallback contract the service implements at render time.
 */
export function AnnouncementForm({
  draft,
  lang,
  dict,
}: {
  draft?: AnnouncementDraft;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.announcements;
  const [state, formAction] = useActionState<AnnouncementFormResult | null, FormData>(
    draft ? updateAnnouncementAction : createAnnouncementAction,
    null
  );

  useEffect(() => {
    if (state && !state.ok) toast.error(d.errors[state.messageKey]);
    if (state?.ok) toast.success(d.saveDraft);
  }, [state, d]);

  const error = state && !state.ok ? d.errors[state.messageKey] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lang" value={lang} />
      {draft ? <input type="hidden" name="id" value={draft.id} /> : null}

      <FormField name="titleTh" invalid={Boolean(error)}>
        <FormLabel>{d.titleThLabel}</FormLabel>
        <Input name="titleTh" defaultValue={draft?.titleTh ?? ""} maxLength={200} required />
        {error ? <FormError>{error}</FormError> : null}
      </FormField>

      <FormField name="titleEn">
        <FormLabel>{d.titleEnLabel}</FormLabel>
        <Input name="titleEn" defaultValue={draft?.titleEn ?? ""} maxLength={200} />
        <FormDescription>{d.optionalEn}</FormDescription>
      </FormField>

      <FormField name="bodyTh">
        <FormLabel>{d.bodyThLabel}</FormLabel>
        <Textarea name="bodyTh" defaultValue={draft?.bodyTh ?? ""} rows={10} maxLength={20000} />
      </FormField>

      <FormField name="bodyEn">
        <FormLabel>{d.bodyEnLabel}</FormLabel>
        <Textarea name="bodyEn" defaultValue={draft?.bodyEn ?? ""} rows={10} maxLength={20000} />
        <FormDescription>{d.optionalEn}</FormDescription>
      </FormField>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="pinned"
          defaultChecked={draft?.pinned ?? false}
          className="size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
        />
        {d.pinnedLabel}
      </label>

      <div>
        <SubmitButton label={d.saveDraft} pendingLabel={d.saving} />
      </div>
    </form>
  );
}
