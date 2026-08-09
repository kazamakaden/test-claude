"use client";

import { useTransition } from "react";
import { signOut } from "@/actions/auth";
import type { Locale } from "@/lib/i18n/config";

/**
 * Task 3 sign-out fix. Both call sites (user-menu.tsx, mobile-nav.tsx) used
 * to fire `void signOut(lang)` directly from an onClick — a bare
 * fire-and-forget call outside any transition, whose redirect (and any
 * rejection) had no defined place to land. Wrapping the call in
 * useTransition is the same idiom this codebase already uses for other
 * mutating actions invoked from a menu/dialog trigger (calendar-day-sheet.tsx's
 * delete, member-delete-dialog.tsx) — it gives the action a real pending
 * state and, critically, keeps the call alive even if the button that
 * triggered it (e.g. a Sheet that closes immediately after) unmounts, since
 * startTransition schedules the work at the point it's called, not tied to
 * the caller's continued existence.
 */
export function useSignOut(lang: Locale) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut(lang);
    });
  };

  return { isPending, handleSignOut };
}
