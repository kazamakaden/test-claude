"use client";

import { useEffect, useState } from "react";
import { QrCodeSvg } from "@/components/attendance/qr-code";
import type { QrGeometry } from "@/lib/qr";

/**
 * The rotating half of the §13 QR: re-fetches the current token's geometry as
 * each rotation expires.
 *
 * It polls rather than computing the next token locally, and that is the whole
 * security argument for the scheme: the HMAC secret is unreadable by every
 * client (0056), so a browser *cannot* derive the next code. If it could, so
 * could a student sitting at home with the page open.
 */
export function QrLiveCode({
  sessionId,
  initialGeometry,
  initialExpiresIn,
  rotationSeconds,
  title,
  closedLabel,
}: {
  sessionId: string;
  initialGeometry: QrGeometry;
  initialExpiresIn: number;
  rotationSeconds: number;
  title: string;
  closedLabel: string;
}) {
  const [geometry, setGeometry] = useState(initialGeometry);
  const [secondsLeft, setSecondsLeft] = useState(initialExpiresIn);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (closed) return;
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch(`/api/qr/${sessionId}`, { cache: "no-store" });
        if (!res.ok) {
          // 403/404 mean revoked, expired, or no longer permitted. Stop rather
          // than hammering an endpoint that will keep refusing.
          if (!cancelled) setClosed(true);
          return;
        }
        const body = (await res.json()) as {
          size: number;
          path: string;
          expiresInSeconds: number;
        };
        if (cancelled) return;
        setGeometry({ size: body.size, path: body.path });
        setSecondsLeft(body.expiresInSeconds);
      } catch {
        // A transient blip must not blank a code that is still valid on
        // screen; the next tick retries.
      }
    }

    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          void refresh();
          return rotationSeconds;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [sessionId, rotationSeconds, closed]);

  if (closed) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {closedLabel}
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <QrCodeSvg geometry={geometry} title={title} />
      {/* aria-live off: a countdown announced every second would make a screen
          reader unusable. The code itself is the information, not the timer. */}
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="off">
        {secondsLeft}s
      </p>
    </div>
  );
}
