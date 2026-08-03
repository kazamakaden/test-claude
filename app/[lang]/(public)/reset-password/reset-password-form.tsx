"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { PasswordStrengthField } from "@/components/auth/password-strength";
import { updatePassword, type UpdatePasswordResult } from "@/actions/auth";
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

export function ResetPasswordForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [state, formAction] = useActionState<UpdatePasswordResult | null, FormData>(
    updatePassword,
    null
  );

  const errorMessage = state && !state.ok ? dict.auth.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
  }, [errorMessage]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="lang" value={lang} />

      <PasswordStrengthField
        name="password"
        label={dict.auth.newPasswordLabel}
        invalid={Boolean(errorMessage)}
        dict={dict}
      />

      <FormField name="confirmPassword" invalid={Boolean(errorMessage)}>
        <FormLabel>{dict.auth.confirmPasswordLabel}</FormLabel>
        <Input
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
        />
        <FormError>{errorMessage}</FormError>
      </FormField>

      <SubmitButton label={dict.auth.updatePassword} pendingLabel={dict.auth.updatingPassword} />
    </form>
  );
}
