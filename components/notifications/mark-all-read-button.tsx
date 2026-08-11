"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/actions/notifications";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Only rendered when something is actually unread — a button that can only
 * ever be a no-op is noise (§22: don't add states a component doesn't have).
 */
export function MarkAllReadButton({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.notifications;
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction(lang);
      if (result.ok) toast.success(d.markAllReadSuccess);
      else toast.error(d.markAllReadError);
    });
  };

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      <CheckCheck className="size-4" aria-hidden />
      {d.markAllRead}
    </Button>
  );
}
