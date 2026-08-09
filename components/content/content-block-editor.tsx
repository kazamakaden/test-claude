"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormLabel } from "@/components/ui/form";
import { updateContentBlockAction, type ContentBlockFormResult } from "@/actions/content";
import type { ContentBlock } from "@/types/content";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

// useFormStatus only reports the correct pending state for a DOM descendant
// of the <form> it tracks — same note as calendar-day-sheet.tsx's SaveButton.
function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Only rendered when the server has already computed canManage (content:manage
 * — aft_teacher/admin, lib/auth/permissions.ts) — the Server Action re-checks
 * the same permission, so a bypassed render still can't write.
 */
export function ContentBlockEditor({
  block,
  lang,
  dict,
}: {
  block: ContentBlock;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.aft11.editor;
  const [state, formAction] = useActionState<ContentBlockFormResult | null, FormData>(
    updateContentBlockAction,
    null
  );

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) toast.success(d.saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-heading text-sm font-medium text-foreground">{d.title}</h2>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="slug" value={block.slug} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="titleTh" invalid={Boolean(errorMessage)}>
          <FormLabel>{d.titleThLabel}</FormLabel>
          <Input name="titleTh" maxLength={200} defaultValue={block.titleTh} required />
        </FormField>
        <FormField name="titleEn">
          <FormLabel>{d.titleEnLabel}</FormLabel>
          <Input name="titleEn" maxLength={200} defaultValue={block.titleEn ?? ""} placeholder={d.enFallbackHint} />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="bodyTh" invalid={Boolean(errorMessage)}>
          <FormLabel>{d.bodyThLabel}</FormLabel>
          <Textarea name="bodyTh" rows={12} maxLength={20000} defaultValue={block.bodyTh} />
        </FormField>
        <FormField name="bodyEn">
          <FormLabel>{d.bodyEnLabel}</FormLabel>
          <Textarea name="bodyEn" rows={12} maxLength={20000} defaultValue={block.bodyEn ?? ""} placeholder={d.enFallbackHint} />
        </FormField>
      </div>

      <div className="flex justify-end">
        <SaveButton label={d.save} pendingLabel={d.saving} />
      </div>
    </form>
  );
}
