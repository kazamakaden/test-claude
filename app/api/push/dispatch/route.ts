import { NextResponse } from "next/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { notificationMessage } from "@/lib/notifications";
import { getWebPush, isPushSendConfigured, isValidDispatchSecret } from "@/lib/push-server";
import { listPushTargets, deletePushSubscriptionsById } from "@/services/push";
import { resolveConfiguredSiteUrl } from "@/lib/site-url";
import type { AppNotification } from "@/types/notifications";
import type { Locale } from "@/lib/i18n/config";

/**
 * Delivers a web push for each row the 0036 triggers insert into
 * `public.notifications`.
 *
 * Why an HTTP endpoint rather than a Server Action: nothing in the app ever
 * inserts a notification. Every row is written by a Postgres trigger
 * (`notify_roles`, `notify_project_status_change`, ...), so the only thing
 * that knows a notification happened is the database. A Supabase Database
 * Webhook on INSERT calls this route; see docs/web-push.md for the exact
 * webhook definition.
 *
 * Node runtime, not Edge: `web-push` signs VAPID JWTs with node:crypto.
 */
export const runtime = "nodejs";

/** Shape Supabase's Database Webhooks POST for an INSERT. */
interface WebhookPayload {
  type?: string;
  table?: string;
  record?: {
    id?: string;
    recipient_id?: string | null;
    type?: string;
    title?: string;
    message_key?: string | null;
    message_params?: Record<string, string> | null;
    link?: string | null;
    created_at?: string;
  };
}

export async function POST(request: Request) {
  // Authenticate BEFORE touching the database or reading the body in anger.
  // This endpoint makes the server send notifications to real devices, so an
  // unauthenticated caller must not even learn whether push is configured.
  if (!isValidDispatchSecret(request.headers.get("x-push-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isPushSendConfigured) {
    // Authenticated but this deployment has no VAPID keys. 200, not 500 —
    // a webhook that gets a 5xx will retry forever against a box that can
    // never succeed.
    return NextResponse.json({ skipped: "not_configured" });
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const record = payload.record;
  if (payload.type !== "INSERT" || !record?.id) {
    return NextResponse.json({ skipped: "not_an_insert" });
  }

  const targets = await listPushTargets(record.recipient_id ?? null);
  if (targets.length === 0) return NextResponse.json({ sent: 0, pruned: 0 });

  const webpush = getWebPush();
  if (!webpush) return NextResponse.json({ skipped: "not_configured" });

  // One notification, many readers, potentially different languages — so the
  // body is composed per locale, not once. Dictionaries are loaded at most
  // once each rather than per subscription.
  const notification: AppNotification = {
    id: record.id,
    type: (record.type ?? "announcement") as AppNotification["type"],
    title: record.title ?? "",
    messageKey: record.message_key ?? null,
    messageParams: record.message_params ?? {},
    link: record.link ?? null,
    createdAt: record.created_at ?? new Date().toISOString(),
    read: false,
  };

  const bodyByLocale = new Map<Locale, string>();
  for (const locale of new Set(targets.map((t) => t.locale))) {
    const dict = await getDictionary(locale);
    // Reuses the exact renderer the bell and /notifications use, so push
    // wording can never drift from in-app wording.
    bodyByLocale.set(locale, notificationMessage(dict, notification));
  }

  const siteUrl = resolveConfiguredSiteUrl() ?? "";
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    targets.map(async (target) => {
      const body = bodyByLocale.get(target.locale) ?? notification.title;
      const link = notification.link ?? `/${target.locale}/notifications`;

      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dhKey, auth: target.authKey },
          },
          JSON.stringify({
            title: notification.title || body,
            body,
            // public/sw.js opens this on click. Absolute so the service
            // worker resolves it against the site, not the push service.
            url: siteUrl ? `${siteUrl}${link}` : link,
          })
        );
        sent += 1;
      } catch (error) {
        // 404/410 mean the browser threw this subscription away — the only
        // correct response is to forget it too. Everything else (a transient
        // 5xx from the push service, a timeout) is left alone to be retried
        // by a later notification.
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) dead.push(target.id);
        else console.error("[push] send failed", statusCode ?? error);
      }
    })
  );

  const pruned = await deletePushSubscriptionsById(dead);

  // Always 2xx once authenticated: a per-subscription failure is not a
  // webhook failure, and retrying the whole fan-out would re-notify everyone
  // who already received it.
  return NextResponse.json({ sent, pruned });
}
