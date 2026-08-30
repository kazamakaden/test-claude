"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormDescription } from "@/components/ui/form";
import {
  getMemberCitizenIdAction,
  setMemberCitizenIdAction,
  type SetMemberCitizenIdResult,
} from "@/actions/members";
import { formatCitizenId } from "@/lib/citizen-id";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * §14's administrator half: "cannot be changed without Administrator
 * permission" — which means an administrator can, and until now nothing in the
 * app could. `prevent_citizen_id_change` (0003) has always exempted an admin
 * and 0005 revoked only SELECT on the column, so the database allowed this all
 * along; the accessor's admin branch simply had no caller.
 *
 * Its own <form>, rendered as a SIBLING of the member edit form rather than
 * inside it: HTML forbids nested forms, and this posts to a different action on
 * purpose. Folding it into updateMember would let a citizen-ID correction
 * silently rewrite the member's department or class alongside — the same
 * reasoning that kept revokeProfileApproval separate from setProfileRole.
 *
 * The value is fetched when this mounts (i.e. when an admin opens the sheet),
 * never carried on the members list: it is §15-sensitive and /members renders
 * it zero times for every role.
 */
export function MemberCitizenIdField({
  memberId,
  lang,
  dict,
}: {
  memberId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.members.edit;
  const [current, setCurrent] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [state, formAction] = useActionState<SetMemberCitizenIdResult | null, FormData>(
    setMemberCitizenIdAction,
    null
  );

  useEffect(() => {
    let cancelled = false;
    getMemberCitizenIdAction(lang, memberId)
      .then((value) => {
        if (cancelled) return;
        setCurrent(value);
        setLoaded(true);
      })
      // A refusal or a network blip reads as "nothing on file" rather than
      // breaking the sheet — the admin can still write a correct value, and
      // the database is what decides whether it lands.
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, memberId]);

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) toast.success(d.citizenIdSaved);
  }, [errorMessage, state, d.citizenIdSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-border pt-4">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="id" value={memberId} />

      <FormField name="citizenId" invalid={Boolean(errorMessage)}>
        <FormLabel>{d.citizenIdLabel}</FormLabel>
        <p className="text-sm tabular-nums text-muted-foreground">
          {/* Formatted, not raw: the grouped form is what appears on the card
              itself, and it makes a transposed digit findable by eye. */}
          {loaded && current ? formatCitizenId(current) : loaded ? d.citizenIdNone : "…"}
        </p>
        <Input
          name="citizenId"
          inputMode="numeric"
          autoComplete="off"
          maxLength={20}
          defaultValue=""
        />
        <FormDescription>{d.citizenIdHint}</FormDescription>
      </FormField>

      <div className="flex justify-end">
        <SaveButton label={d.citizenIdSave} pendingLabel={d.citizenIdSaving} />
      </div>
    </form>
  );
}
