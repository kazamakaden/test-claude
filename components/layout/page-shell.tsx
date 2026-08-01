import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

export function PageShell({
  title,
  description,
  icon: Icon = Construction,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center shadow-sm">
        <Icon className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-heading text-base font-medium text-foreground">
          {emptyTitle}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {emptyDescription}
        </p>
      </div>
    </div>
  );
}
