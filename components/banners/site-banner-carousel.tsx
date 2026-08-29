import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteBanner } from "@/types/site-banners";
import type { Dictionary } from "@/types/i18n";

/**
 * The homepage banner, newest first, with arrows to page back through older
 * ones.
 *
 * Paging is a `?b=` search param and the arrows are plain <Link>s, not client
 * state — so it works with JavaScript disabled (§30.9 item 3), each banner has
 * a shareable URL, and this stays a Server Component. Same choice /calendar's
 * MonthNav already makes for months.
 *
 * A raw <img> rather than next/image: these are Supabase Storage URLs and
 * next.config.ts carries no remotePatterns for them. The bucket is public
 * (0065), so the URL is a pure string build with no signing round trip.
 */
export function SiteBannerCarousel({
  banners,
  index,
  basePath,
  dict,
}: {
  banners: SiteBanner[];
  index: number;
  basePath: string;
  dict: Dictionary;
}) {
  const d = dict.home.banners;
  if (banners.length === 0) return null;

  const current = banners[index];
  const total = banners.length;
  const hrefFor = (i: number) => (i === 0 ? basePath : `${basePath}?b=${i}`);

  const caption =
    current.academicYear !== null && current.term !== null
      ? d.termCaption
          .replace("{year}", String(current.academicYear))
          .replace("{term}", String(current.term))
      : null;

  return (
    <section aria-label={d.heading} className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- a Supabase Storage URL, not an optimizable static asset. */}
        <img
          src={current.url}
          alt={d.alt.replace("{index}", String(index + 1)).replace("{total}", String(total))}
          className="h-56 w-full object-cover sm:h-72 lg:h-96"
        />

        {total > 1 ? (
          <>
            <div className="absolute inset-y-0 left-2 flex items-center">
              <ArrowLink
                href={hrefFor(index - 1)}
                label={d.previous}
                disabled={index === 0}
                icon="prev"
              />
            </div>
            <div className="absolute inset-y-0 right-2 flex items-center">
              <ArrowLink
                href={hrefFor(index + 1)}
                label={d.next}
                disabled={index >= total - 1}
                icon="next"
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{caption}</span>
        {total > 1 ? (
          <span>
            {d.position.replace("{index}", String(index + 1)).replace("{total}", String(total))}
          </span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * A disabled arrow is rendered as a <span>, not a <Link> with aria-disabled: an
 * anchor with no destination is still focusable and still activates, so the
 * only honest way to say "there is nothing past this end" is not to make it a
 * link at all.
 */
function ArrowLink({
  href,
  label,
  disabled,
  icon,
}: {
  href: string;
  label: string;
  disabled: boolean;
  icon: "prev" | "next";
}) {
  const Icon = icon === "prev" ? ChevronLeft : ChevronRight;

  if (disabled) {
    return (
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full bg-card/60 text-muted-foreground/40"
      >
        <Icon className="size-5" />
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      nativeButton={false}
      className="rounded-full bg-card/90 backdrop-blur"
      render={<Link href={href} aria-label={label} scroll={false} />}
    >
      <Icon className="size-5" aria-hidden />
    </Button>
  );
}
