import Image from "next/image";
import Link from "next/link";
import { homeHrefFor } from "@/lib/navigation";
import type { Role } from "@/types/auth";

export function Logo({ lang, role }: { lang: string; role: Role }) {
  const href = homeHrefFor(role);

  return (
    <Link
      href={`/${lang}${href === "/" ? "" : href}`}
      className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Image
        src="/brand/logo-with-text.png"
        alt="AFT UDONTECH"
        width={418}
        height={134}
        className="h-14 w-auto dark:hidden"
        priority
      />
      <Image
        src="/brand/logo-with-text-dark.png"
        alt="AFT UDONTECH"
        width={1415}
        height={423}
        className="hidden h-14 w-auto dark:block"
        priority
      />
    </Link>
  );
}
