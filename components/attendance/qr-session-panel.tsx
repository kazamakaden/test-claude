import { getCurrentQrToken } from "@/services/attendance";
import { attendUrl, qrGeometry } from "@/lib/qr";
import { QrLiveCode } from "@/components/attendance/qr-live-code";
import { RevokeQrSessionButton } from "@/components/attendance/revoke-qr-session-button";
import { resolveConfiguredSiteUrl } from "@/lib/site-url";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { QrSession } from "@/types/attendance";

/**
 * Server shell for a live check-in session: mints the first token so the code
 * is on screen in the first paint, then hands rotation to the client.
 */
export async function QrSessionPanel({
  session,
  activityId,
  lang,
  dict,
}: {
  session: QrSession;
  activityId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.attendance.qr;
  const token = await getCurrentQrToken(session.id);

  if (!token) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {d.noSession}
      </p>
    );
  }

  // Absolute, because a phone's camera app opens this from outside the browser
  // — a relative path has nothing to resolve against. resolveConfiguredSiteUrl()
  // is reused rather than reading NEXT_PUBLIC_SITE_URL directly, so this
  // inherits its Vercel fallback (lib/site-url.ts).
  const url = attendUrl(resolveConfiguredSiteUrl() ?? "", lang, token.token);

  return (
    <section className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="font-heading text-base font-semibold text-foreground">{d.title}</h2>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      <QrLiveCode
        sessionId={session.id}
        lang={lang}
        initialGeometry={qrGeometry(url)}
        initialExpiresIn={token.expiresInSeconds}
        rotationSeconds={session.rotationSeconds}
        title={d.title}
        closedLabel={d.noSession}
      />

      <dl className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>{d.rotatesLabel}</dt>
          <dd className="tabular-nums">
            {session.rotationSeconds} {d.seconds}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{d.expiresLabel}</dt>
          <dd>
            <time dateTime={session.expiresAt}>
              {new Date(session.expiresAt).toLocaleTimeString(lang === "th" ? "th-TH" : "en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </dd>
        </div>
      </dl>

      <RevokeQrSessionButton
        sessionId={session.id}
        activityId={activityId}
        lang={lang}
        dict={dict}
      />
    </section>
  );
}
