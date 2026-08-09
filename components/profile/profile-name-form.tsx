"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { updateOwnProfileAction, type ProfileFormResult } from "@/actions/profile";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ProfileNameForm({
  lang,
  fullName,
  dict,
}: {
  lang: Locale;
  fullName: string | null;
  dict: Dictionary;
}) {
  const d = dict.profile;
  const [state, formAction] = useActionState<ProfileFormResult | null, FormData>(updateOwnProfileAction, null);

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) toast.success(d.saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="lang" value={lang} />
      <FormField name="fullName" className="flex-1" invalid={Boolean(errorMessage)}>
        <FormLabel>{d.fullNameLabel}</FormLabel>
        <Input name="fullName" maxLength={120} defaultValue={fullName ?? ""} required />
        <FormError>{errorMessage}</FormError>
      </FormField>
      <SaveButton label={d.save} pendingLabel={d.saving} />
    </form>
  );
}
