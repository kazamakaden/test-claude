"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, type ResetRequestResult } from "@/actions/auth";
import { isTurnstileConfigured, turnstileSiteKey } from "@/lib/turnstile";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Reuses requestPasswordReset as-is — it already handles the captcha token,
 * the uniform-response enumeration guard, and building the emailed link. The
 * only difference from /forgot-password's form is that email comes from the
 * caller's own verified session (a hidden field, never a typed/editable one)
 * instead of an anonymous visitor typing an address.
 */
export function SetPasswordForm({
  lang,
  email,
  dict,
}: {
  lang: Locale;
  email: string;
  dict: Dictionary;
}) {
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
          {dict.auth.checkEmailSetPasswordDescription}
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="email" value={email} />

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {isTurnstileConfigured ? (
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          options={{ appearance: "always" }}
        />
      ) : null}

      <SubmitButton label={dict.auth.sendSetPasswordLink} pendingLabel={dict.auth.submitting} />
    </form>
  );
}
