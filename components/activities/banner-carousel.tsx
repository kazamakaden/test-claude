import { ImageOff } from "lucide-react";
import type { ActivityBanner } from "@/types/activities";
import type { Dictionary } from "@/types/i18n";

/**
 * Banner photos for an activity. Server Component -- there is nothing
 * interactive here; management lives in banner-manager.tsx.
 *
 * A raw <img>, not next/image: these are Supabase Storage URLs, which
 * next.config.ts has no remotePatterns for, and the project already made this
 * call once in components/documents/book-cover.tsx. The bucket is public
 * (0063), so the URL is a plain string build with no signing round trip --
 * unlike books, which needs getSignedUrlMap per page.
 *
 * Horizontal scroll rather than a JS carousel: it works with JavaScript off,
 * it is keyboard- and touch-native, and at 375px a single photo fills the
 * viewport without any breakpoint logic.
 */
export function BannerCarousel({
  banners,
  title,
  dict,
}: {
  banners: ActivityBanner[];
  title: string;
  dict: Dictionary;
}) {
  const d = dict.activities.banners;

  if (banners.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-card text-muted-foreground sm:h-64">
        <span className="flex items-center gap-2 text-sm">
          <ImageOff aria-hidden className="size-4" />
          {d.empty}
        </span>
      </div>
    );
  }

  if (banners.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a Supabase Storage URL, not an optimizable static asset.
      <img
        src={banners[0].url}
        alt={d.alt.replace("{title}", title).replace("{index}", "1")}
        className="h-48 w-full rounded-xl border border-border object-cover sm:h-72"
      />
    );
  }

  return (
    <ul
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
      aria-label={d.heading}
    >
      {banners.map((banner, i) => (
        <li key={banner.id} className="min-w-0 shrink-0 snap-start basis-[85%] sm:basis-[48%] lg:basis-[32%]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a Supabase Storage URL, not an optimizable static asset. */}
          <img
            src={banner.url}
            alt={d.alt.replace("{title}", title).replace("{index}", String(i + 1))}
            className="h-48 w-full rounded-xl border border-border object-cover sm:h-64"
          />
        </li>
      ))}
    </ul>
  );
}
