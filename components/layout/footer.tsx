import Image from "next/image";
import type { Dictionary } from "@/types/i18n";

export function Footer({ dict }: { dict: Dictionary }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6 lg:px-8">
        <Image
          src="/brand/wordmark.png"
          alt={dict.footer.orgName}
          width={200}
          height={112}
          sizes="200px"
          className="h-10 w-auto dark:hidden"
        />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {dict.footer.orgName}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.footer.collegeName}
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {year} AFT UDONTECH — {dict.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
