"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";
import type { Locale } from "@/lib/i18n/config";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {label}
    </Button>
  );
}

/**
 * A real `<form action={signOut.bind(null, lang)}>`, unlike the menu-item
 * sign-out in user-menu.tsx/mobile-nav.tsx (useSignOut, a useTransition
 * wrapper) — those two live inside JS-only overlays (a Base UI Menu/Sheet)
 * that can't even open without JavaScript, so a no-JS form there buys
 * nothing. /profile is a plain page, so this is the one sign-out entry
 * point that genuinely works with JavaScript disabled, matching the
 * no-JS guarantee sign-IN already has (§30.9).
 */
export function SignOutButton({ lang, label }: { lang: Locale; label: string }) {
  return (
    <form action={signOut.bind(null, lang)}>
      <SubmitButton label={label} />
    </form>
  );
}
