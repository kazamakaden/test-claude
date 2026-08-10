"use client";

import { useEffect, useState } from "react";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-error";

// Last resort: only reached if the root layout itself throws, which
// app/[lang]/error.tsx cannot catch (it lives below the layout). Must
// render its own <html>/<body> since it replaces the whole document —
// no dictionary, no theme provider, no design-system components available
// here, same reasoning as [lang]/error.tsx's untranslated fallback taken
// one level further.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Same stale-chunk self-recovery as [lang]/error.tsx, see its comment —
  // a redeploy can just as easily invalidate the root layout's own chunk.
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (isChunkLoadError(error) && recoverFromChunkError()) {
      setRecovering(true);
      return;
    }
    console.error(error);
  }, [error]);

  if (recovering) {
    return (
      <html>
        <body />
      </html>
    );
  }

  return (
    <html>
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <p style={{ fontSize: "1rem", fontWeight: 500 }}>Something went wrong.</p>
        <button
          onClick={reset}
          style={{
            border: "1px solid currentColor",
            borderRadius: "0.5rem",
            padding: "0.4rem 0.9rem",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {error.digest ? (
          <p style={{ fontSize: "0.75rem", opacity: 0.6 }}>Error reference: {error.digest}</p>
        ) : null}
      </body>
    </html>
  );
}
