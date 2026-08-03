"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { signInWithPassword, type SignInResult } from "@/actions/auth";
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

/**
 * Submits via the form's native `action` (useActionState) rather than a
 * client-invoked RPC, so it still posts and gets a real server-validated
 * result with JavaScript disabled (§30.9). GoogleSignIn above is a separate
 * plain form for the same reason — it's a real POST that redirects to
 * Google, not an onClick handler, so it also works without JS.
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
  const [state, formAction] = useActionState<SignInResult | null, FormData>(
    signInWithPassword,
    null
  );
  const turnstileRef = useRef<TurnstileInstance>(null);

  const errorMessage =
    state && !state.ok ? dict.auth.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage);
      // The token is single-use — a failed submit (wrong credentials,
      // captcha rejected, ...) must not let a stale token be replayed.
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

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignIn lang={lang} label={dict.auth.googleSignIn} dividerLabel={dict.auth.orDivider} />

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
        </FormField>

        <FormField name="password" invalid={Boolean(errorMessage)}>
          <FormLabel>{dict.auth.passwordLabel}</FormLabel>
          <Input name="password" type="password" required autoComplete="current-password" />
          <FormError>{errorMessage}</FormError>
        </FormField>

        <div className="text-right text-sm">
          <Link href={`/${lang}/forgot-password`} className="text-primary hover:underline">
            {dict.auth.forgotPassword}
          </Link>
        </div>

        {isTurnstileConfigured ? (
          <Turnstile
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            options={{ appearance: "always" }}
          />
        ) : null}

        <SubmitButton label={dict.auth.signIn} pendingLabel={dict.auth.signingIn} />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.noAccount}{" "}
        <Link href={`/${lang}/signup`} className="text-primary hover:underline">
          {dict.auth.signUp}
        </Link>
      </p>
    </div>
  );
}
