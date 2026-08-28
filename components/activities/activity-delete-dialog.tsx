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
import { deleteActivityAction } from "@/actions/activities";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Shared by the calendar day sheet and the /activities table, which is why it
 * reads dict.activities.delete rather than dict.dashboard.calendar — the same
 * lift common.pagination and common.levels already got when a second consumer
 * appeared.
 *
 * Whether to RENDER this is the caller's decision and mirrors
 * activities_delete_owner (0061): owner OR admin, deliberately narrower than
 * the edit predicate, because deleting an activity cascades into `attendance`
 * and destroys the whole check-in record. deleteActivityAction re-checks
 * server-side and RLS refuses regardless — this component is the friendly
 * layer, never the boundary.
 */
export function ActivityDeleteDialog({
  activityId,
  title,
  size = "sm",
  lang,
  dict,
}: {
  activityId: string;
  title: string;
  size?: "xs" | "sm";
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.activities.delete;
  // AlertDialogAction is a Close primitive (components/ui/alert-dialog.tsx) —
  // it closes the dialog immediately on click, before this async work
  // finishes, so there is no useful in-dialog pending state to show. isPending
  // is discarded for the same reason member-delete-dialog.tsx discards it.
  const [, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteActivityAction(lang, activityId);
      if (!result.ok) {
        toast.error(d.failed);
        return;
      }
      toast.success(d.deleted);
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size={size} aria-label={`${d.button} ${title}`} />}
      >
        <Trash2 className={size === "xs" ? "size-3.5" : "size-4"} aria-hidden />
        {d.button}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{d.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {d.confirmDescription.replace("{title}", title)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>{d.confirmDelete}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
