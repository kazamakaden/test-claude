import "server-only";
import crypto from "node:crypto";
import webpush from "web-push";

/**
 * Send-side web push configuration.
 *
 * Deliberately NOT in `lib/push.ts`: that module is isomorphic and is
 * imported by `components/settings/push-section.tsx`, a Client Component.
 * The private key must never be reachable from a module the client bundle
 * pulls in — Next.js would replace the value with `undefined` rather than
 * leak it, but a build-tool guarantee is the wrong thing to rely on for a
 * signing key. `server-only` makes an accidental client import a build
 * error instead.
 */
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "";

/** Shared secret the Supabase Database Webhook presents to /api/push/dispatch. */
export const pushDispatchSecret = process.env.PUSH_DISPATCH_SECRET ?? "";

/**
 * All four are required to send: the keypair must be complete (a subscription
 * created with one public key can only be reached by its matching private
 * key), VAPID requires a contact subject, and the endpoint is useless — in
 * fact dangerous — without a secret to authenticate the caller.
 *
 * Same "hide rather than half-enable" shape as isPushConfigured /
 * isTurnstileConfigured / isSupabaseAdminConfigured elsewhere in this codebase.
 */
export const isPushSendConfigured = Boolean(
  publicKey && privateKey && subject && pushDispatchSecret
);

let vapidApplied = false;

/**
 * Returns the configured web-push client, or null when this deployment has no
 * send credentials. setVapidDetails() is global module state, so it is applied
 * once rather than on every dispatch.
 */
export function getWebPush(): typeof webpush | null {
  if (!isPushSendConfigured) return null;
  if (!vapidApplied) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidApplied = true;
  }
  return webpush;
}

/**
 * Constant-time comparison of the webhook's secret header.
 *
 * Both sides are SHA-256'd first because timingSafeEqual throws on
 * length-mismatched buffers — comparing raw values would leak the secret's
 * length through that exception, and short-circuit on length before ever
 * reaching the constant-time path.
 */
export function isValidDispatchSecret(presented: string | null): boolean {
  if (!pushDispatchSecret || !presented) return false;
  const a = crypto.createHash("sha256").update(presented).digest();
  const b = crypto.createHash("sha256").update(pushDispatchSecret).digest();
  return crypto.timingSafeEqual(a, b);
}
