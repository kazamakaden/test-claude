"use client";

import { useTransition } from "react";
import { UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { revokeMemberAction } from "@/actions/members";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * "Stop approve" — sends the member back to `pending` rather than deleting
 * them. Gated the same as the trigger rendering it (member:approve), and
 * revokeMemberAction re-checks server-side regardless (§19), including
 * refusing to revoke the caller's own account or an admin row.
 */
export function MemberRevokeDialog({
  memberId,
  memberName,
  lang,
  dict,
}: {
  memberId: string;
  memberName: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.members.revoke;
  // Same rationale as member-delete-dialog.tsx: AlertDialogAction closes the
  // dialog immediately on click, so isPending has no useful in-dialog use —
  // the toast below is the only feedback that matters.
  const [, startTransition] = useTransition();

  const handleRevoke = () => {
    startTransition(async () => {
      const result = await revokeMemberAction(lang, memberId);
      if (!result.ok) {
        toast.error(d.errors[result.messageKey]);
        return;
      }
      toast.success(d.revoked);
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" aria-label={`${d.revokeButton} ${memberName}`} />}
      >
        <UserX className="size-4" aria-hidden />
        {d.revokeButton}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{d.title}</AlertDialogTitle>
          <AlertDialogDescription>{d.description.replace("{name}", memberName)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleRevoke}>{d.confirmRevoke}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
