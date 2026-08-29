import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist_Mono, IBM_Plex_Sans_Thai, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { locales, type Locale } from "@/lib/i18n/config";
import { FONT_SIZE_COOKIE, resolveFontSize } from "@/lib/font-size";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-thai",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const dynamicParams = false;

/**
 * Next.js does NOT inject a default `<meta name="viewport">` — without this
 * export the app had none at all, discovered via scripts/responsive-check.mjs:
 * mobile emulation reported window.innerWidth=981 (Chrome's classic 980px
 * "desktop site on mobile" fallback layout viewport) instead of the
 * requested 375, on every page, in both themes. That fallback is what real
 * phones apply to any page lacking this tag — this was never just a
 * DevTools measurement quirk, it means the app has been rendering at a
 * fixed 980px layout width and scaling down on every real mobile visit.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const fontSize = resolveFontSize((await cookies()).get(FONT_SIZE_COOKIE)?.value);

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      data-font-size={fontSize}
      className={`${inter.variable} ${ibmPlexSansThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
