import { FileWarning } from "lucide-react";
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
  const d = dict.documents;
  const signedUrl = pdfPath ? await getSignedPdfUrl(pdfPath) : null;

  if (!signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center shadow-sm">
        <FileWarning className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-heading text-base font-medium text-foreground">{d.notAttached}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{d.notAttachedDescription}</p>
      </div>
    );
  }

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
