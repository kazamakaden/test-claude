"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { publishAnnouncementAction, deleteAnnouncementAction } from "@/actions/announcements";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Publish/unpublish and delete.
 *
 * Publishing fans out a broadcast notification to everyone (0060), which is
 * not undoable — unpublishing hides the post but the notification has already
 * been delivered. Hence the deliberate asymmetry: publish is a plain button
 * because staff do it constantly, while delete is behind a confirm dialog
 * because it destroys the record.
 */
export function AnnouncementPublishControls({
  id,
  published,
  lang,
  dict,
}: {
  id: string;
  published: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.announcements;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={published ? "outline" : "default"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await publishAnnouncementAction(lang, id, !published);
            if (!result.ok) toast.error(d.errors[result.messageKey]);
            else router.refresh();
          })
        }
      >
        {published ? d.unpublishButton : d.publishButton}
      </Button>

      <AlertDialog>
        {/* `render` with the label as children, matching
            delete-book-button.tsx — this project's AlertDialogTrigger is Base
            UI's, which composes via render rather than asChild. */}
        <AlertDialogTrigger
          render={<Button variant="destructive" disabled={pending}>{d.deleteButton}</Button>}
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{d.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{d.deleteConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteAnnouncementAction(lang, id);
                  if (!result.ok) toast.error(d.errors[result.messageKey]);
                  else router.push(`/${lang}/announcements`);
                })
              }
            >
              {d.deleteButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
