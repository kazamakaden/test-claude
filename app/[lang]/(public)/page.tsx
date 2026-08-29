import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import { SiteBannerCarousel } from "@/components/banners/site-banner-carousel";
import { BannerManagePanel } from "@/components/banners/banner-manage-panel";
import { listPublishedBanners, listManageableBanners, groupBanners } from "@/services/site-banners";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * The banner carousel. Its own async child behind Suspense + CardBoundary, not
 * awaited in the page body: a Supabase problem here must not take the homepage
 * down, which is the exact failure /documents shipped with before that pattern
 * was applied to it.
 */
async function BannerSection({
  index,
  basePath,
  dict,
}: {
  index: number;
  basePath: string;
  dict: Dictionary;
}) {
  const banners = await listPublishedBanners();
  if (banners.length === 0) return null;

  // Clamp rather than 404: `?b=` is user-editable and a banner deleted between
  // page loads would otherwise leave a shared link pointing at nothing.
  const safeIndex = Math.min(Math.max(index, 0), banners.length - 1);

  return (
    <SiteBannerCarousel
      banners={banners}
      index={safeIndex}
      basePath={basePath}
      dict={dict}
    />
  );
}

async function ManageSection({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  // No status filter: RLS decides what this caller sees, so staff get drafts
  // and nobody else could reach this component anyway.
  const banners = await listManageableBanners();
  return (
    <BannerManagePanel
      banners={banners}
      groups={groupBanners(banners)}
      lang={lang}
      dict={dict}
    />
  );
}

export default async function HomePage({
  params,
  searchParams: rawSearchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const rawParams = await rawSearchParams;
  const bParam = Array.isArray(rawParams.b) ? rawParams.b[0] : rawParams.b;
  const index = Number.parseInt(bParam ?? "0", 10);

  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);
  const signedIn = can(role, "workspace:access");
  const canManage = can(role, "content:manage");

  // No signed-in redirect here. It used to send them to /{lang}/dashboard; that
  // route now redirects back to `/`, so keeping it would loop every signed-in
  // visitor on every page of the site.

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
        <Suspense fallback={<div className="h-56 rounded-xl bg-muted sm:h-72 lg:h-96" />}>
          <BannerSection
            index={Number.isFinite(index) ? index : 0}
            basePath={`/${lang}`}
            dict={dict}
          />
        </Suspense>
      </CardBoundary>

      <div className="bg-hero relative flex flex-col items-center gap-8 overflow-hidden rounded-3xl px-4 py-16 text-center">
        <div
          aria-hidden
          className="hero-glow pointer-events-none absolute top-8 size-64 -translate-y-1/4"
        />
        <Image
          src="/brand/logo.png"
          alt="AFT UDONTECH"
          width={96}
          height={96}
          priority
          className="relative size-24"
        />
        <div className="flex flex-col gap-3">
          <h1 className="text-gradient-brand font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {dict.meta.title}
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            {dict.meta.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* A signed-in viewer now lands here rather than being redirected past
              it, so the primary action cannot be "log in" for everyone. Theirs
              is the calendar, which carries the dashboard cards. */}
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={signedIn ? `/${lang}/calendar` : `/${lang}/login`} />}
          >
            {signedIn ? dict.nav.calendar : dict.nav.login}
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/${lang}/activities`} />}
          >
            {dict.nav.activities}
          </Button>
        </div>
      </div>

      {canManage ? (
        <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
          <Suspense fallback={<div className="h-64 rounded-xl bg-muted" />}>
            <ManageSection lang={lang} dict={dict} />
          </Suspense>
        </CardBoundary>
      ) : null}
    </div>
  );
}
