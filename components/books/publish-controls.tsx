"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { BookCheck, BookX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishBookAction, unpublishBookAction } from "@/actions/books";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { BookStatus } from "@/types/books";

/** Staff-only (document:approve, the same อวท. teacher/admin tier the §12 workflow already uses) — the page only renders this when the viewer holds that permission. */
export function PublishControls({
  id,
  status,
  lang,
  dict,
}: {
  id: string;
  status: BookStatus;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.documents.manage.actions;
  const [pending, startTransition] = useTransition();

  const handlePublish = () => {
    startTransition(async () => {
      const result = await publishBookAction(lang, id);
      if (!result.ok) {
        toast.error(d.publishErrors[result.messageKey]);
        return;
      }
      toast.success(d.published);
    });
  };

  const handleUnpublish = () => {
    startTransition(async () => {
      const result = await unpublishBookAction(lang, id);
      if (!result.ok) {
        toast.error(d.publishErrors[result.messageKey]);
        return;
      }
      toast.success(d.unpublished);
    });
  };

  if (status === "draft") {
    return (
      <Button disabled={pending} onClick={handlePublish}>
        <BookCheck className="size-4" aria-hidden />
        {d.publish}
      </Button>
    );
  }

  return (
    <Button variant="outline" disabled={pending} onClick={handleUnpublish}>
      <BookX className="size-4" aria-hidden />
      {d.unpublish}
    </Button>
  );
}
