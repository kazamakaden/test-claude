"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-error";

// Next's error.tsx boundary only receives {error, reset} — no route params —
// so this fallback (the last resort for any route under [lang] whose own
// throw wasn't caught by a page-local CardBoundary) is intentionally
// untranslated, same reasoning as (app)/dashboard/error.tsx's own comment.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A stale open tab across a redeploy throws a ChunkLoadError here with no
  // error.digest (the throw is client-side, never reached the server) —
  // exactly what the /members "Something went wrong" report looked like.
  // Self-recover with one reload instead of stranding the tab on this
  // screen; recoverFromChunkError() only fires once per session, so a
  // genuinely broken deployment still falls through to the card below.
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (isChunkLoadError(error) && recoverFromChunkError()) {
      setRecovering(true);
      return;
    }
    console.error(error);
  }, [error]);

  if (recovering) return null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <AlertCircle className="size-10 text-destructive" aria-hidden />
      <p className="font-heading text-base font-medium text-foreground">Something went wrong.</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Error reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
