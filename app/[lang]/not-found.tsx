import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

// Next's not-found.tsx boundary receives no props at all (not even route
// params), so — same reasoning as error.tsx/global-error.tsx in this
// directory — it can't load a dictionary for `lang` and is intentionally
// untranslated. Links to "/" rather than a locale-prefixed path for the
// same reason: middleware.ts redirects "/" to the visitor's detected
// locale on its own.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <FileQuestion className="size-10 text-muted-foreground" aria-hidden />
      <p className="font-heading text-base font-medium text-foreground">Page not found.</p>
      <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
        Back to home
      </Button>
    </div>
  );
}
