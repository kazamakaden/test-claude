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
 * Google is the primary, first-position sign-in action. Password sign-in is
 * a secondary path — for an account an admin created directly (Members ->
 * Add user) for someone who can't use Google OAuth — tucked behind a native
 * <details> disclosure rather than a second page, since it needs no JS to
 * open and its form is a real POST via useActionState (§30.9's
 * JS-disabled guarantee holds for both paths independently).
 */
export function LoginForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [state, formAction] = useActionState<SignInResult | null, FormData>(
    signInWithPassword,
    null
  );
  const turnstileRef = useRef<TurnstileInstance>(null);

  const errorMessage = state && !state.ok ? dict.auth.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage);
      // The token is single-use — a failed submit (wrong credentials,
      // captcha rejected, ...) must not let a stale token be replayed.
      turnstileRef.current?.reset();
    }
  }, [errorMessage]);

  // A reason carried back via the URL (?error= from the OAuth callback or an
  // expired password link, ?notice= after setting a password) is rendered by
  // the PAGE, server-side — deliberately not a toast here. It has to be
  // readable with JavaScript off, and it is not tied to any state on this
  // form since it did not come from a submission on this page.

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <GoogleSignIn lang={lang} label={dict.auth.googleSignIn} />
      </div>

      <details className="group rounded-xl border border-border bg-card">
        <summary className="cursor-pointer list-none select-none px-6 py-4 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          {dict.auth.signInWithPassword}
        </summary>

        <form action={formAction} className="flex flex-col gap-4 border-t border-border p-6">
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
      </details>
    </div>
  );
}
