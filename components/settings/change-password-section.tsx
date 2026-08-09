"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { PasswordStrengthField } from "@/components/auth/password-strength";
import { changePasswordAction, type ChangePasswordResult } from "@/actions/settings";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Same form serves both "change password" (an account that already has
 * one) and "set a password" (a Google-only account, password_set = false,
 * 0030) — there is nothing to verify against in either case, which is
 * exactly why one form covers both; only the copy differs.
 */
export function ChangePasswordSection({
  lang,
  passwordSet,
  dict,
}: {
  lang: Locale;
  passwordSet: boolean;
  dict: Dictionary;
}) {
  const d = dict.settings.password;
  const [state, formAction] = useActionState<ChangePasswordResult | null, FormData>(changePasswordAction, null);

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) toast.success(d.updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium text-foreground">{passwordSet ? d.title : d.setTitle}</h3>
      <p className="text-xs text-muted-foreground">{passwordSet ? d.description : d.setDescription}</p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="lang" value={lang} />

        <PasswordStrengthField
          name="password"
          label={dict.auth.newPasswordLabel}
          invalid={Boolean(errorMessage)}
          dict={dict}
        />

        <FormField name="confirmPassword" invalid={Boolean(errorMessage)}>
          <FormLabel>{dict.auth.confirmPasswordLabel}</FormLabel>
          <Input name="confirmPassword" type="password" required autoComplete="new-password" minLength={8} />
          <FormError>{errorMessage}</FormError>
        </FormField>

        <div className="flex justify-end">
          <SubmitButton label={passwordSet ? d.submit : d.setSubmit} pendingLabel={d.submitting} />
        </div>
      </form>
    </section>
  );
}
