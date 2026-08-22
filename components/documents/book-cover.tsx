import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/** Simple deterministic hash so the same title always gets the same angle. */
function hashTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Designed placeholder cover, used whenever `coverUrl` is absent (still
 * every `documents`-sourced book, and any `books` row nobody has attached
 * a cover image to yet — see CLAUDE.md §0). The gradient angle is derived
 * from the title so a shelf of several books doesn't look like one card
 * repeated, while staying inside the brand's monochrome steel-navy palette
 * (§3) — no new hues introduced.
 */
export function BookCover({
  title,
  coverUrl,
  className,
}: {
  title: string;
  coverUrl?: string | null;
  className?: string;
}) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a signed Supabase Storage URL, not an optimizable static asset next/image can cache.
      <img
        src={coverUrl}
        alt={title}
        className={cn("aspect-[3/4] w-full rounded-lg border border-border object-cover shadow-sm", className)}
      />
    );
  }

  const angle = 90 + (hashTitle(title) % 180);

  return (
    <div
      aria-hidden
      className={cn(
        "flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-border p-4 text-center shadow-sm",
        className
      )}
      style={{
        background: `linear-gradient(${angle}deg, var(--primary), var(--brand-ink))`,
      }}
    >
      <BookOpen className="size-8 text-primary-foreground/90" />
      <p className="line-clamp-4 text-sm font-medium text-primary-foreground">{title}</p>
    </div>
  );
}
