"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markNotificationReadAction } from "@/actions/notifications";
import type { Locale } from "@/lib/i18n/config";

/**
 * Marks a notification read when it is opened.
 *
 * Without this, `markNotificationReadAction` had no caller at all: unread
 * state could only be cleared in bulk, which also cleared items the user had
 * never opened, making the unread count meaningless.
 *
 * Degradation with JavaScript disabled (§30.9 item 3): the linked case is a
 * real <Link>, so navigation still works and the row simply stays unread, with
 * "mark all as read" still available. Only the mark-on-open side effect needs
 * JS — never the navigation itself.
 */
export function NotificationItem({
  id,
  href,
  read,
  lang,
  markLabel,
  children,
}: {
  id: string;
  href: string | null;
  read: boolean;
  lang: Locale;
  markLabel: string;
  children: React.ReactNode;
}) {
  const [, startTransition] = useTransition();

  // Fire-and-forget: navigation must not wait on the read-mark, and a failed
  // mark is not worth interrupting the user for — the row stays unread and the
  // next open (or "mark all") clears it.
  const handleOpen = () => {
    if (read) return;
    startTransition(async () => {
      await markNotificationReadAction(lang, id);
    });
  };

  if (href) {
    return (
      <Link
        href={`/${lang}${href}`}
        onClick={handleOpen}
        className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {children}
      </Link>
    );
  }

  // Nothing to open and nothing to mark.
  if (read) return <>{children}</>;

  // Unread with no link: the row itself is the "mark as read" control.
  return (
    <button
      type="button"
      onClick={handleOpen}
      aria-label={markLabel}
      className="block w-full rounded-xl text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
