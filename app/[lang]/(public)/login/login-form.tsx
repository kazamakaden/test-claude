"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { signIn, signInWithGoogle, type SignInResult } from "@/actions/auth";
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

function GoogleSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {label}
    </Button>
  );
}

/**
 * Submits via the form's native `action` (useActionState) rather than a
 * client-invoked RPC, so it still posts and gets a real server-validated
 * result with JavaScript disabled (§30.9). The Google button below is a
 * separate plain form bound to signInWithGoogle for the same reason — it's
 * a real POST that redirects to Google, not an onClick handler, so it also
 * works without JS.
 */
export function LoginForm({
  lang,
  dict,
  initialErrorKey,
}: {
  lang: Locale;
  dict: Dictionary;
  initialErrorKey?: keyof Dictionary["auth"]["errors"];
}) {
  const [state, formAction] = useActionState<SignInResult | null, FormData>(signIn, null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const errorMessage =
    state && !state.ok ? dict.auth.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage);
      // The token is single-use — a failed submit (wrong domain, captcha
      // rejected, ...) must not let a stale token be replayed.
      turnstileRef.current?.reset();
    }
  }, [errorMessage]);

  // One-time toast for a reason carried back from the OAuth callback route
  // (?error=... in the URL) — not tied to `state`, since it didn't come
  // from this form's own submission.
  useEffect(() => {
    if (initialErrorKey) toast.error(dict.auth.errors[initialErrorKey]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
        <MailCheck className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-heading text-base font-medium text-foreground">
          {dict.auth.checkEmailTitle}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {dict.auth.checkEmailDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={signInWithGoogle.bind(null, lang)}>
        <GoogleSubmitButton label={dict.auth.googleSignIn} />
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" aria-hidden />
        {dict.auth.orDivider}
        <div className="h-px flex-1 bg-border" aria-hidden />
      </div>

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
    </div>
  );
}
