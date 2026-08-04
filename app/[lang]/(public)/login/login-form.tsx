"use client";

import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Login is Google-only (§ current work item) — no email/password fields.
 * The Google form itself is a real POST (see GoogleSignIn), so it still
 * works with JavaScript disabled; there is no client-validated form left
 * here to preserve that guarantee for.
 */
export function LoginForm({
  lang,
  dict,
  initialErrorKey,
  initialNoticeKey,
}: {
  lang: Locale;
  dict: Dictionary;
  initialErrorKey?: keyof Dictionary["auth"]["errors"];
  initialNoticeKey?: keyof Dictionary["auth"]["notices"];
}) {
  // One-time toasts for a reason carried back via the URL (?error= from the
  // OAuth callback route, ?notice= after completing the set-password flow)
  // — not tied to any local form state, since neither came from a submission
  // on this page.
  useEffect(() => {
    if (initialErrorKey) toast.error(dict.auth.errors[initialErrorKey]);
    if (initialNoticeKey) toast.success(dict.auth.notices[initialNoticeKey]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <GoogleSignIn lang={lang} label={dict.auth.googleSignIn} />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={`/${lang}/forgot-password`} className="text-primary hover:underline">
          {dict.auth.forgotPassword}
        </Link>
      </p>
    </div>
  );
}
