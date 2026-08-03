"use client";

import { useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { deleteBookAction } from "@/actions/books";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function DeleteBookButton({
  bookId,
  title,
  lang,
  dict,
  trigger,
  /** Set on the detail page (deleting the very book being viewed); the shelf card leaves it unset and lets revalidatePath refresh the grid in place. */
  redirectTo,
}: {
  bookId: string;
  title: string;
  lang: Locale;
  dict: Dictionary;
  trigger: ReactElement;
  redirectTo?: string;
}) {
  const d = dict.documents;
  const [, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteBookAction(lang, bookId);
      if (!result.ok) {
        toast.error(d.deleteFailed);
        return;
      }
      toast.success(d.deleted);
      if (redirectTo) router.push(redirectTo);
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{d.deleteConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{d.deleteConfirmDescription.replace("{title}", title)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>{d.confirmDelete}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
