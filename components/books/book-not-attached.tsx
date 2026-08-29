import { FileWarning } from "lucide-react";
import type { Dictionary } from "@/types/i18n";

/** Shown on the detail page when a book has no PDF uploaded yet. */
export function BookNotAttached({ dict }: { dict: Dictionary }) {
  const d = dict.documents;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center shadow-sm">
      <FileWarning className="size-10 text-muted-foreground" aria-hidden />
      <p className="font-heading text-base font-medium text-foreground">{d.notAttached}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{d.notAttachedDescription}</p>
    </div>
  );
}
