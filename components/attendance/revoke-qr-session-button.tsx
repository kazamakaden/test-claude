"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revokeQrSessionAction } from "@/actions/attendance";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/** Closes a check-in early, so its QR stops verifying before its own expiry. */
export function RevokeQrSessionButton({
  sessionId,
  activityId,
  lang,
  dict,
}: {
  sessionId: string;
  activityId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.attendance.qr;
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeQrSessionAction(lang, sessionId, activityId);
          if (!result.ok) toast.error(d.errors[result.messageKey]);
        })
      }
    >
      {pending ? d.revoking : d.revoke}
    </Button>
  );
}
