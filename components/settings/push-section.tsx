"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { isPushConfigured, vapidPublicKey, urlBase64ToUint8Array } from "@/lib/push";
import { savePushSubscriptionAction, deletePushSubscriptionAction } from "@/actions/push";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

type SupportState = "checking" | "unsupported" | "denied" | "ready";

/**
 * Graceful-degradation ladder, same "hide rather than render a control that
 * can only fail" pattern as isTurnstileConfigured/isSupabaseAdminConfigured
 * elsewhere in this codebase:
 *   1. No VAPID public key configured -> render nothing at all.
 *   2. serviceWorker/PushManager/Notification unsupported (iOS Safari
 *      outside an installed PWA, most notably) -> disabled + explanation.
 *   3. Notification.permission === "denied" -> disabled + explanation,
 *      genuinely un-undoable from this page.
 *   4. Otherwise a real Switch reflecting the live subscription state.
 */
export function PushSection({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const d = dict.settings.push;
  const [support, setSupport] = useState<SupportState>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPushConfigured) return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupport("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setSupport("denied");
      return;
    }

    // register(), not `.ready` — `.ready` only resolves once an ACTIVE
    // worker exists for the scope and never rejects, so on a fresh origin
    // with no prior registration it would hang forever and the toggle
    // would stay disabled with no explanation. register() is idempotent
    // (a second call for the same scope/script just returns the existing
    // registration) and pushManager is usable on the returned registration
    // immediately, before the worker reaches "active".
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setSubscribed(Boolean(subscription));
        setSupport("ready");
      })
      .catch(() => setSupport("unsupported"));
  }, []);

  if (!isPushConfigured) return null;

  function handleToggle(next: boolean) {
    startTransition(async () => {
      if (next) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setSupport(permission === "denied" ? "denied" : "ready");
          return;
        }

        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            // TS's lib.dom types PushManager.subscribe's applicationServerKey
            // as BufferSource<ArrayBuffer> specifically; Uint8Array's own
            // type is generic over ArrayBufferLike (which also covers
            // SharedArrayBuffer), so a real, always-ArrayBuffer-backed
            // Uint8Array still needs this cast to satisfy it.
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
          });
          const keys = subscription.toJSON().keys;

          const result = await savePushSubscriptionAction(lang, {
            endpoint: subscription.endpoint,
            p256dhKey: keys?.p256dh ?? "",
            authKey: keys?.auth ?? "",
            userAgent: navigator.userAgent,
          });

          if (!result.ok) {
            // The server never learned about this subscription — don't
            // leave the browser holding one it can't be told apart from a
            // saved one.
            await subscription.unsubscribe();
            toast.error(d.errors.saveFailed);
            return;
          }

          setSubscribed(true);
        } catch {
          toast.error(d.errors.subscribeFailed);
        }
        return;
      }

      try {
        // register(), not `.ready` — same reasoning as the mount effect
        // above; by the time this branch is reachable a subscription (and
        // therefore a registration) already exists, but `.ready` is still
        // the wrong primitive to depend on here.
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await deletePushSubscriptionAction(lang, subscription.endpoint);
          await subscription.unsubscribe();
        }
        setSubscribed(false);
      } catch {
        toast.error(d.errors.unknown);
      }
    });
  }

  const disabled = support !== "ready" || isPending;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium text-foreground">{d.title}</h3>
      <p className="text-xs text-muted-foreground">{d.description}</p>
      {support === "unsupported" ? <p className="text-xs text-muted-foreground">{d.unsupported}</p> : null}
      {support === "denied" ? <p className="text-xs text-muted-foreground">{d.permissionDenied}</p> : null}
      <label className="flex items-center gap-3">
        <Switch checked={subscribed} onCheckedChange={handleToggle} disabled={disabled} />
        <span className="text-sm text-foreground">{subscribed ? d.enabled : d.disabled}</span>
      </label>
    </section>
  );
}
