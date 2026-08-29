"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { approveDocument, rejectDocument, type RejectDocumentResult } from "@/actions/documents";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

function RejectSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function DocumentReviewActions({
  id,
  lang,
  dict,
}: {
  id: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.documents.manage.actions;
  const [showReject, setShowReject] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState<RejectDocumentResult | null, FormData>(
    rejectDocument,
    null
  );

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
  }, [errorMessage]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button disabled={isPending} onClick={() => startTransition(() => approveDocument(id, lang))}>
          <Check className="size-4" aria-hidden />
          {d.approve}
        </Button>
        {!showReject ? (
          <Button variant="outline" onClick={() => setShowReject(true)}>
            <X className="size-4" aria-hidden />
            {d.reject}
          </Button>
        ) : null}
      </div>

      {showReject ? (
        <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="documentId" value={id} />
          <FormField name="reason" invalid={Boolean(errorMessage)}>
            <FormLabel>{d.reasonLabel}</FormLabel>
            <Textarea name="reason" required maxLength={1000} placeholder={d.reasonPlaceholder} rows={3} />
            <FormError>{errorMessage}</FormError>
          </FormField>
          <RejectSubmitButton label={d.reject} pendingLabel={d.rejecting} />
        </form>
      ) : null}
    </div>
  );
}
