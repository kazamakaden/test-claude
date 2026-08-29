import type { LucideIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

export function CardEmpty({
  icon: Icon,
  message,
  ctaLabel,
  ctaHref,
  lang,
}: {
  icon: LucideIcon;
  message: string;
  /**
   * Optional together: an empty state should not offer an action the viewer
   * cannot perform. Omitting them renders the message alone.
   */
  ctaLabel?: string;
  ctaHref?: string;
  lang: Locale;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      {ctaLabel && ctaHref ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/${lang}${ctaHref}`} />}
        >
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function CardError({
  title,
  retryLabel,
  digest,
}: {
  title: string;
  retryLabel: string;
  /** Vercel keys a production server error by this — same convention as app/[lang]/error.tsx. */
  digest?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <AlertCircle className="size-8 text-destructive" aria-hidden />
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{retryLabel}</p>
      {digest ? <p className="text-xs text-muted-foreground">Error reference: {digest}</p> : null}
    </div>
  );
}
