import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);

  return (
    <div className="bg-hero mx-auto flex min-h-[calc(100dvh-5rem)] max-w-7xl flex-col items-center justify-center gap-8 rounded-b-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <Image
        src="/brand/logo.png"
        alt="AFT UDONTECH"
        width={96}
        height={96}
        priority
        className="size-24"
      />
      <div className="flex flex-col gap-3">
        <h1 className="text-gradient-brand font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {dict.meta.title}
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          {dict.meta.description}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={`/${lang}/login`} />}
        >
          {dict.nav.login}
        </Button>
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/${lang}/activities`} />}
        >
          {dict.nav.activities}
        </Button>
      </div>
    </div>
  );
}
