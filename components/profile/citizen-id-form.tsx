"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError, FormDescription } from "@/components/ui/form";
import { setOwnCitizenIdAction, type CitizenIdFormResult } from "@/actions/profile";
import { formatCitizenId } from "@/lib/citizen-id";
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

/**
 * §14 เลขบัตรประชาชน — set once by the owner.
 *
 * Renders the stored value read-only once there is one, because
 * prevent_citizen_id_change (0003) will refuse a second write from anyone but
 * an admin. Showing an editable input that can only fail is the trap this
 * project already hit with the activity edit form; the note tells the owner who
 * to ask instead.
 *
 * The value shown here is read through get_citizen_id(), which 0075 extended to
 * admit the subject — it is NOT in any select list. Nobody else's number is
 * reachable from this page.
 */
export function CitizenIdForm({
  lang,
  citizenId,
  dict,
}: {
  lang: Locale;
  citizenId: string | null;
  dict: Dictionary;
}) {
  const d = dict.profile;
  const [state, formAction] = useActionState<CitizenIdFormResult | null, FormData>(
    setOwnCitizenIdAction,
    null
  );

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) toast.success(d.citizenIdSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (citizenId) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{d.citizenIdLabel}</p>
        <p className="flex items-center gap-2 text-sm text-foreground">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-mono">{formatCitizenId(citizenId)}</span>
        </p>
        <p className="text-xs text-muted-foreground">{d.citizenIdLocked}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="lang" value={lang} />
      <FormField name="citizenId" invalid={Boolean(errorMessage)}>
        <FormLabel>{d.citizenIdLabel}</FormLabel>
        <Input
          name="citizenId"
          inputMode="numeric"
          autoComplete="off"
          maxLength={20}
          placeholder="1-2345-67890-12-3"
          required
        />
        <FormDescription>{d.citizenIdHint}</FormDescription>
        <FormError>{errorMessage}</FormError>
      </FormField>
      <SaveButton label={d.save} pendingLabel={d.saving} />
    </form>
  );
}
