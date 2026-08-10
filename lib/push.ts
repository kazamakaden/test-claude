/**
 * Task 5 web push opt-in. Isomorphic (no server-only), mirrors
 * lib/turnstile.ts's isConfigured pattern — the public key is inlined into
 * the client bundle by design (it's the applicationServerKey the browser
 * subscribes with), the private key never enters this file.
 */
export const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const isPushConfigured = vapidPublicKey.length > 0;

/**
 * PushManager.subscribe's applicationServerKey wants a raw Uint8Array, not
 * the base64url string VAPID keys are generated/distributed as.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
