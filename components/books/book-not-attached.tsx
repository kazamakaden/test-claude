import type { LucideIcon } from "lucide-react";
import type { Dictionary } from "@/types/i18n";

/** Shared by pdf-viewer.tsx and flipbook-viewer.tsx — same copy, different icon per reader kind. */
export function BookNotAttached({ icon: Icon, dict }: { icon: LucideIcon; dict: Dictionary }) {
  const d = dict.documents;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center shadow-sm">
      <Icon className="size-10 text-muted-foreground" aria-hidden />
      <p className="font-heading text-base font-medium text-foreground">{d.notAttached}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{d.notAttachedDescription}</p>
    </div>
  );
}
