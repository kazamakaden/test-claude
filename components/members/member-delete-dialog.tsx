"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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
import { deleteMemberAction } from "@/actions/members";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Permanent, admin-only (member:manage) — the button that renders this
 * trigger is already gated the same way in members-table.tsx, and
 * deleteMemberAction re-checks server-side regardless (§19), including
 * refusing to delete the caller's own account or an admin row.
 */
export function MemberDeleteDialog({
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
  const d = dict.members.delete;
  // AlertDialogAction is a Close primitive (components/ui/alert-dialog.tsx)
  // — it closes the dialog immediately on click, before this async work
  // finishes, so there is no useful in-dialog pending state to show. isPending
  // is discarded for the same reason components/books/delete-book-button.tsx
  // already discards it; the toast below is the only feedback that matters.
  const [, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteMemberAction(lang, memberId);
      if (!result.ok) {
        toast.error(d.errors[result.messageKey]);
        return;
      }
      toast.success(d.deleted);
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" aria-label={`${d.deleteButton} ${memberName}`} />}
      >
        <Trash2 className="size-4" aria-hidden />
        {d.deleteButton}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{d.title}</AlertDialogTitle>
          <AlertDialogDescription>{d.description.replace("{name}", memberName)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>{d.confirmDelete}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
