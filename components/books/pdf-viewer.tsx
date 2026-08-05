import { FileWarning } from "lucide-react";
import { BookNotAttached } from "@/components/books/book-not-attached";
import { getSignedPdfUrl } from "@/services/books";
import type { Dictionary } from "@/types/i18n";

/**
 * <object>, not react-pdf/pdfjs-dist — §2 pins the dependency list and a
 * PDF renderer is ~350KB gzipped plus a worker for something the browser
 * already renders natively in most cases. The "open in new tab" link is
 * not optional: mobile Chrome and iOS Safari frequently refuse inline PDF
 * rendering, and it is the actual reading path for most users there.
 */
export async function PdfViewer({
  title,
  pdfPath,
  dict,
}: {
  title: string;
  pdfPath: string | null;
  dict: Dictionary;
}) {
  const signedUrl = pdfPath ? await getSignedPdfUrl(pdfPath) : null;

  if (!signedUrl) {
    return <BookNotAttached icon={FileWarning} dict={dict} />;
  }

  const d = dict.documents;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <object data={signedUrl} type="application/pdf" className="aspect-[4/3] w-full sm:aspect-video" aria-label={title}>
        <p className="p-6 text-sm text-muted-foreground">{d.pdfInlineUnsupported}</p>
      </object>
      <a
        href={signedUrl}
        target="_blank"
        rel="noreferrer"
        className="border-t border-border px-4 py-2 text-center text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {d.openInNewTab}
      </a>
    </div>
  );
}
