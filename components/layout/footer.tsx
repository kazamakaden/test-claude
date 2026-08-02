import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function Footer({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="divider-metal" aria-hidden />
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {dict.footer.orgName}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.footer.collegeName}
          </p>
          <Link
            href={`/${lang}/announcements`}
            className="text-sm text-brand-ink underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {dict.nav.announcements}
          </Link>
          <p className="text-xs text-muted-foreground">
            &copy; {year} AFT UDONTECH — {dict.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
