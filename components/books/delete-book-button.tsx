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
  /**
   * The shelf card's trigger sits inside a card-wide <Link> to the book
   * detail page — clicking it must not also navigate there. This has to be
   * a plain boolean, not an onClick function passed in via `trigger`: the
   * caller (book-card.tsx) is an async Server Component, and a function
   * can never cross the Server->Client prop boundary this component's
   * "use client" directive draws — that was the actual bug (see CLAUDE.md).
   */
  stopTriggerPropagation,
}: {
  bookId: string;
  title: string;
  lang: Locale;
  dict: Dictionary;
  trigger: ReactElement;
  redirectTo?: string;
  stopTriggerPropagation?: boolean;
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
      <AlertDialogTrigger
        render={trigger}
        onClick={
          stopTriggerPropagation
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
              }
            : undefined
        }
      />
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
