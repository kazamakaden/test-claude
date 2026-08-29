const RELOAD_GUARD_KEY = "chunk-error-reload-attempted";

/**
 * True for the class of error a browser tab left open across a redeploy
 * throws: the tab's already-loaded HTML still references the OLD build's
 * content-hashed JS/CSS chunk filenames, which 404 against the NEW
 * deployment's asset manifest. Distinct from every other client-side
 * throw, which the recovery below must NOT swallow — only this narrow
 * signature is safe to blindly reload past.
 */
export function isChunkLoadError(error: Error): boolean {
  if (error.name === "ChunkLoadError") return true;
  const message = error.message ?? "";
  return (
    /Loading chunk [\w.-]+ failed/i.test(message) ||
    /Loading CSS chunk [\w.-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

/**
 * Reloads the page to recover from a stale-chunk error (see
 * isChunkLoadError), at most once per browser tab session. Guarded by
 * sessionStorage rather than a component-local flag so the guard survives
 * the reload itself — without that, a genuinely broken new deployment
 * (not just a stale tab) would reload forever instead of eventually
 * falling through to the real error card.
 *
 * Returns true if a reload was actually triggered (caller should suppress
 * its normal error UI while navigation happens), false if recovery was
 * already attempted this session (caller should show its error UI as usual).
 */
export function recoverFromChunkError(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY)) return false;
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  } catch {
    // Private browsing / storage disabled — fail open to "already tried"
    // rather than risk an infinite reload loop with no way to remember.
    return false;
  }
  window.location.reload();
  return true;
}
