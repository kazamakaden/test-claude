"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Next's error.tsx boundary only receives {error, reset} — no route params —
// so this fallback (only reached if a whole page render throws, past the
// per-card CardBoundary) is intentionally untranslated.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <AlertCircle className="size-10 text-destructive" aria-hidden />
      <p className="font-heading text-base font-medium text-foreground">
        Something went wrong loading the dashboard.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
