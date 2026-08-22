"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/actions/auth";
import type { Locale } from "@/lib/i18n/config";

function GoogleSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {label}
    </Button>
  );
}

/**
 * The single sign-in entry point (login is Google-only) — bound to a real
 * form action (not an onClick handler) so it still works, as a real
 * redirect-driving POST, with JavaScript disabled. `dividerLabel` is
 * optional: pass it only when something else renders below this button —
 * omitting it skips the divider instead of leaving it orphaned.
 */
export function GoogleSignIn({
  lang,
  label,
  dividerLabel,
}: {
  lang: Locale;
  label: string;
  dividerLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <form action={signInWithGoogle.bind(null, lang)}>
        <GoogleSubmitButton label={label} />
      </form>

      {dividerLabel ? (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" aria-hidden />
          {dividerLabel}
          <div className="h-px flex-1 bg-border" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}
