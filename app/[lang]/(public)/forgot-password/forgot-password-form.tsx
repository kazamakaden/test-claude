"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { requestPasswordReset, type ResetRequestResult } from "@/actions/auth";
import { isTurnstileConfigured, turnstileSiteKey } from "@/lib/turnstile";
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

export function ForgotPasswordForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [state, formAction] = useActionState<ResetRequestResult | null, FormData>(
    requestPasswordReset,
    null
  );
  const turnstileRef = useRef<TurnstileInstance>(null);

  const errorMessage = state && !state.ok ? dict.auth.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage);
      turnstileRef.current?.reset();
    }
  }, [errorMessage]);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
        <MailCheck className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-heading text-base font-medium text-foreground">
          {dict.auth.checkEmailTitle}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {dict.auth.checkEmailResetDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="lang" value={lang} />

        <FormField name="email" invalid={Boolean(errorMessage)}>
          <FormLabel>{dict.auth.emailLabel}</FormLabel>
          <Input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={dict.auth.emailPlaceholder}
          />
          <FormError>{errorMessage}</FormError>
        </FormField>

        {isTurnstileConfigured ? (
          <Turnstile
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            options={{ appearance: "always" }}
          />
        ) : null}

        <SubmitButton label={dict.auth.submit} pendingLabel={dict.auth.submitting} />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={`/${lang}/login`} className="text-primary hover:underline">
          {dict.auth.signIn}
        </Link>
      </p>
    </div>
  );
}
