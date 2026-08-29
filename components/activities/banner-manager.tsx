"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { addBannerAction, removeBannerAction } from "@/actions/activity-detail";
import type { ActivityBanner } from "@/types/activities";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_BANNERS = 10;

/**
 * Upload and remove banner photos.
 *
 * Two-phase upload, the same shape as components/books/file-uploader.tsx: the
 * browser PUTs straight to Storage under the caller's own session, then the
 * Server Action carries only the resulting object path. Server Actions cap at
 * 1MB, which a 5MB photo would blow past.
 *
 * The path is {activity_id}/{uuid}.{ext}, deliberately NOT books'
 * {uploader_id}/... -- 0063's storage policies key on the activity so that
 * revoking a co-editor also revokes their rights over objects they uploaded.
 */
export function BannerManager({
  activityId,
  banners,
  lang,
  dict,
}: {
  activityId: string;
  banners: ActivityBanner[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.activities.banners;
  const errors = dict.activities.detailErrors;
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const full = banners.length >= MAX_BANNERS;

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error(d.tooLarge);
      return;
    }
    // Guarded, not assumed: lib/supabase/client.ts throws when the env vars are
    // absent, which would take the whole card down through its error boundary.
    if (!isSupabaseConfigured) {
      toast.error(errors.unknown);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${activityId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from("activity-banners")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) {
        toast.error(errors.forbidden);
        return;
      }

      const result = await addBannerAction(lang, activityId, path);
      if (!result.ok) {
        toast.error(errors[result.messageKey as keyof typeof errors] ?? errors.unknown);
        return;
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function onRemove(bannerId: string) {
    startTransition(async () => {
      const result = await removeBannerAction(lang, activityId, bannerId);
      if (!result.ok) {
        toast.error(errors[result.messageKey as keyof typeof errors] ?? errors.unknown);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
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
          disabled={uploading || pending || full}
          onClick={() => inputRef.current?.click()}
        >
          <Upload aria-hidden className="mr-2 size-4" />
          {uploading ? d.uploading : d.add}
        </Button>
        <p className="text-xs text-muted-foreground">{d.limit}</p>
      </div>

      {banners.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {banners.map((banner, i) => (
            <li key={banner.id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onRemove(banner.id)}
                aria-label={d.removeLabel.replace("{index}", String(i + 1))}
              >
                <Trash2 aria-hidden className="mr-1 size-3.5" />
                {i + 1}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
