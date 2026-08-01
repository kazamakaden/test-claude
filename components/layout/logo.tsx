import Image from "next/image";
import Link from "next/link";

export function Logo({ lang }: { lang: string }) {
  return (
    <Link
      href={`/${lang}`}
      className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Image
        src="/brand/logo.png"
        alt="AFT UDONTECH"
        width={36}
        height={36}
        sizes="36px"
        className="size-9 shrink-0"
        priority
      />
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="text-sm font-semibold text-brand-ink">อวท.</span>
        <span className="text-[11px] text-muted-foreground">UDONTECH</span>
      </span>
    </Link>
  );
}
