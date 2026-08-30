"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCodeSvg } from "@/components/attendance/qr-code";
import type { QrGeometry } from "@/lib/qr";

/** Consecutive poll failures tolerated before the display gives up. */
const MAX_FAILURES = 4;

/**
 * Seconds between retries after a failed poll. Needed because the countdown is
 * deadline-driven: a failure leaves the deadline in the past, so without this
 * the tick would see 0 remaining and re-fire every single second. Short enough
 * that a stale cookie recovers within a few seconds of the router refresh.
 */
const RETRY_SECONDS = 3;

/**
 * The rotating half of the §13 QR: re-fetches the current token's geometry as
 * each rotation expires.
 *
 * It polls rather than computing the next token locally, and that is the whole
 * security argument for the scheme: the HMAC secret is unreadable by every
 * client (0056), so a browser *cannot* derive the next code. If it could, so
 * could a student sitting at home with the page open.
 *
 * FAILURE HANDLING IS THE DELICATE PART, and it used to be wrong in a way that
 * only showed up during a live event. Any non-OK response latched a permanent
 * "closed" state with no retry and no way back, and the label it rendered said
 * check-in had never been opened — the opposite of what had happened.
 *
 * The trigger was routine: /api/qr/... sits under /api, which middleware.ts
 * deliberately excludes, so nothing refreshes the session cookie in front of
 * it (the route handler's own comment says so). When the staff member's access
 * token expired — Supabase's default is an hour — the poll 403'd and the
 * projector died mid-event. Nothing else on that page navigates, so the cookie
 * never got refreshed on its own.
 *
 * So the two outcomes the route already distinguishes are now treated
 * differently:
 *
 *   404  the session really is revoked/expired/unknown -> stop, permanently.
 *   403  an authorization problem, which is usually just a stale cookie ->
 *        router.refresh() (an ordinary navigation, which DOES pass through
 *        middleware and refreshes the session), then retry. Only after
 *        MAX_FAILURES consecutive failures does the display give up, and it
 *        then says the display lost its connection rather than claiming
 *        check-in was never opened.
 *
 * The countdown is driven by a DEADLINE rather than a decrementing counter, so
 * the tick is a pure `setSecondsLeft(computed)`. The previous version called
 * refresh() from inside a setSecondsLeft updater — updaters must be pure, and
 * StrictMode double-invokes them, so development fired two fetches per
 * rotation. Worse, it reset the countdown to a full rotation before the fetch
 * resolved, so a failed refresh left an expired code on screen counting
 * confidently down while every scan against it bounced.
 */
export function QrLiveCode({
  sessionId,
  lang,
  initialGeometry,
  initialExpiresIn,
  title,
  closedLabel,
  reconnectingLabel,
  disconnectedLabel,
}: {
  sessionId: string;
  /**
   * Forwarded to the poll so the rotated code encodes a URL in the same locale
   * as the first one, instead of silently switching language mid-session.
   */
  lang: string;
  initialGeometry: QrGeometry;
  initialExpiresIn: number;
  title: string;
  /** The session is genuinely not open (404). */
  closedLabel: string;
  /** A rotation elapsed and the next code has not arrived yet. */
  reconnectingLabel: string;
  /** Gave up after MAX_FAILURES; a page refresh is the way back. */
  disconnectedLabel: string;
}) {
  const router = useRouter();
  const [geometry, setGeometry] = useState(initialGeometry);
  const [deadline, setDeadline] = useState(() => Date.now() + initialExpiresIn * 1000);
  const [secondsLeft, setSecondsLeft] = useState(initialExpiresIn);
  const [ended, setEnded] = useState<null | "closed" | "disconnected">(null);
  const [stale, setStale] = useState(false);

  // Refs, not state: these are read inside the interval and must not restart
  // it. `failures` in particular would otherwise re-run the effect on every
  // failed poll and reset the very timer that schedules the retry.
  const failures = useRef(0);
  const refreshing = useRef(false);
  const recovered = useRef(false);

  const refresh = useCallback(async () => {
    // A slow response must not stack a second request on top of the first.
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const res = await fetch(`/api/qr/${sessionId}?lang=${encodeURIComponent(lang)}`, {
        cache: "no-store",
      });

      if (res.status === 404) {
        // Revoked, expired, or unknown. Not distinguished on purpose: the
        // page's only correct response to any of them is to stop.
        setEnded("closed");
        return;
      }

      if (!res.ok) {
        failures.current += 1;
        setStale(true);
        setDeadline(Date.now() + RETRY_SECONDS * 1000);
        // A 403 here is usually a session cookie that middleware never got the
        // chance to refresh, because /api is outside its matcher. A router
        // refresh is a real navigation, so it does go through middleware —
        // once per outage, not once per failed poll.
        if (res.status === 403 && !recovered.current) {
          recovered.current = true;
          router.refresh();
        }
        if (failures.current >= MAX_FAILURES) setEnded("disconnected");
        return;
      }

      const body = (await res.json()) as {
        size: number;
        path: string;
        expiresInSeconds: number;
      };

      failures.current = 0;
      recovered.current = false;
      setStale(false);
      setGeometry({ size: body.size, path: body.path });
      setDeadline(Date.now() + body.expiresInSeconds * 1000);
    } catch {
      // A transient network blip. Count it like any other failure so a long
      // outage still ends the display, but keep the code on screen — marked
      // stale, so the countdown stops asserting it is valid.
      failures.current += 1;
      setStale(true);
      setDeadline(Date.now() + RETRY_SECONDS * 1000);
      if (failures.current >= MAX_FAILURES) setEnded("disconnected");
    } finally {
      refreshing.current = false;
    }
  }, [sessionId, lang, router]);

  useEffect(() => {
    if (ended) return;

    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) void refresh();
    }, 1000);

    return () => clearInterval(tick);
  }, [deadline, ended, refresh]);

  if (ended) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {ended === "closed" ? closedLabel : disconnectedLabel}
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <QrCodeSvg geometry={geometry} title={title} />
      {stale ? (
        // Do NOT keep counting down over a code that has already expired: the
        // number would be the one thing telling the staff member the display is
        // healthy, at exactly the moment it is not.
        <p className="text-xs text-muted-foreground" role="status">
          {reconnectingLabel}
        </p>
      ) : (
        /* aria-live off: a countdown announced every second would make a screen
           reader unusable. The code itself is the information, not the timer. */
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="off">
          {secondsLeft}s
        </p>
      )}
    </div>
  );
}
