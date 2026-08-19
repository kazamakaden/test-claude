"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteBannerGroupAction } from "@/actions/site-banners";
import type { SiteBannerGroup } from "@/types/site-banners";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Delete a whole academic year + เทอม at once, or every draft, behind a typed
 * "ยืนยัน".
 *
 * The typed word is re-checked in the Server Action, which is where it counts —
 * this input is a speed bump, not the guard. Same split as the §13 attendance
 * confirmation and the §17 signature flow.
 *
 * Grouped rather than per-image because that is how banners are actually
 * retired: a term ends and its whole set comes down. Drafts are their own
 * option because a draft has no year or term to select it by.
 */
export function BannerDeleteDialog({
  groups,
  draftCount,
  lang,
  dict,
}: {
  groups: SiteBannerGroup[];
  draftCount: number;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.home.banners.manage;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState(
    groups.length > 0 ? `${groups[0].academicYear}-${groups[0].term}` : "drafts"
  );
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);

  const hasSomethingToDelete = groups.length > 0 || draftCount > 0;

  function onDelete() {
    startTransition(async () => {
      const result = await deleteBannerGroupAction(lang, target, confirmText);
      if (!result.ok) {
        toast.error(d.errors[result.messageKey as keyof typeof d.errors] ?? d.errors.unknown);
        return;
      }
      toast.success(d.deleted);
      setConfirmText("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="outline" disabled={!hasSomethingToDelete} />}
      >
        <Trash2 className="size-4" aria-hidden />
        {d.delete}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{d.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasSomethingToDelete ? d.deleteDescription : d.deleteNothing}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasSomethingToDelete ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">{d.deleteTarget}</span>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {groups.map((g) => (
                  <option key={`${g.academicYear}-${g.term}`} value={`${g.academicYear}-${g.term}`}>
                    {d.deleteGroupOption
                      .replace("{year}", String(g.academicYear))
                      .replace("{term}", String(g.term))
                      .replace("{count}", String(g.count))}
                  </option>
                ))}
                {draftCount > 0 ? (
                  <option value="drafts">
                    {d.deleteDrafts.replace("{count}", String(draftCount))}
                  </option>
                ) : null}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">{d.confirmInstructions}</span>
              <Input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={d.confirmPlaceholder}
                autoComplete="off"
              />
            </label>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
          {/* Deliberately NOT AlertDialogAction: that primitive closes the
              dialog on click, which would hide a "you typed it wrong" error. */}
          <Button
            variant="destructive"
            disabled={pending || !hasSomethingToDelete}
            onClick={onDelete}
          >
            {pending ? d.deleting : d.confirmDelete}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
