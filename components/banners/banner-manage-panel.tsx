"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBannerAction, publishBannerAction } from "@/actions/site-banners";
import { BannerDeleteDialog } from "@/components/banners/banner-delete-dialog";
import type { SiteBanner, SiteBannerGroup } from "@/types/site-banners";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Staff-only banner management, rendered under the homepage carousel.
 *
 * Two-phase upload, the same shape as components/activities/banner-manager.tsx:
 * the browser PUTs straight to Storage under the caller's own session, then the
 * Server Action carries only the resulting object path. Server Actions cap at
 * 1MB, which a 5MB photo would blow past.
 *
 * An upload always lands as a DRAFT. The year and เทอม are set afterwards, in
 * the same statement that publishes — 0065's CHECK refuses any other order, and
 * a Facebook import genuinely has neither until someone says so.
 */
export function BannerManagePanel({
  banners,
  groups,
  lang,
  dict,
}: {
  banners: SiteBanner[];
  groups: SiteBannerGroup[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.home.banners.manage;
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const drafts = banners.filter((b) => b.status === "draft");

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error(d.tooLarge);
      return;
    }
    // Guarded, not assumed: lib/supabase/client.ts throws when the env vars are
    // absent, which would take this whole subtree down.
    if (!isSupabaseConfigured) {
      toast.error(d.errors.unknown);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from("site-banners")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) {
        toast.error(d.errors.forbidden);
        return;
      }

      const result = await createBannerAction(lang, path);
      if (!result.ok) {
        toast.error(d.errors[result.messageKey as keyof typeof d.errors] ?? d.errors.unknown);
        return;
      }
      toast.success(d.uploaded);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.heading}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onPick}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden className="size-4" />
            {uploading ? d.uploading : d.add}
          </Button>
          <BannerDeleteDialog
            groups={groups}
            draftCount={drafts.length}
            lang={lang}
            dict={dict}
          />
          <p className="text-xs text-muted-foreground">{d.limit}</p>
        </div>

        {banners.length === 0 ? (
          <p className="text-sm text-muted-foreground">{d.noBanners}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {banners.map((banner) => (
              <li
                key={banner.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a Supabase Storage URL. */}
                <img
                  src={banner.url}
                  alt=""
                  className="h-28 w-full rounded-md object-cover"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={banner.status === "published" ? "default" : "outline"}>
                    {banner.status === "published" ? d.publishedBadge : d.draftBadge}
                  </Badge>
                  {banner.source === "facebook" ? (
                    <Badge variant="outline">{d.sourceFacebook}</Badge>
                  ) : null}
                </div>
                {banner.status === "published" ? (
                  <p className="text-xs text-muted-foreground">
                    {dict.home.banners.termCaption
                      .replace("{year}", String(banner.academicYear))
                      .replace("{term}", String(banner.term))}
                  </p>
                ) : (
                  <PublishForm banner={banner} lang={lang} dict={dict} />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Describe a draft and publish it. One statement, because the CHECK constraint refuses the halves apart. */
function PublishForm({
  banner,
  lang,
  dict,
}: {
  banner: SiteBanner;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.home.banners.manage;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Thai Buddhist-era year for the current Gregorian year, as the starting guess.
  const [year, setYear] = useState(String(new Date().getFullYear() + 543));
  const [term, setTerm] = useState("1");

  function onPublish() {
    startTransition(async () => {
      const result = await publishBannerAction(lang, banner.id, year, term);
      if (!result.ok) {
        toast.error(d.errors[result.messageKey as keyof typeof d.errors] ?? d.errors.unknown);
        return;
      }
      toast.success(d.published);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          {d.yearLabel}
          <Input
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="h-8"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {d.termLabel}
          <select
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
      </div>
      <Button size="sm" disabled={pending} onClick={onPublish}>
        {pending ? d.publishing : d.publish}
      </Button>
    </div>
  );
}
