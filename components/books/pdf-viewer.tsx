import { FileWarning, Download } from "lucide-react";
import { BookNotAttached } from "@/components/books/book-not-attached";
import { getSignedPdfUrl } from "@/services/books";
import { bookPdfFilename } from "@/lib/books";
import type { Dictionary } from "@/types/i18n";

/**
 * <object>, not react-pdf/pdfjs-dist — §2 pins the dependency list and a
 * PDF renderer is ~350KB gzipped plus a worker for something the browser
 * already renders natively in most cases. The "open in new tab" link is
 * not optional: mobile Chrome and iOS Safari frequently refuse inline PDF
 * rendering, and it is the actual reading path for most users there.
 *
 * Task 6: a SEPARATE signed URL for the download link, minted with
 * Storage's `download` option (Content-Disposition: attachment) — reusing
 * the plain view URL for both would risk the `?download=` response header
 * also hijacking the inline <object> render into a download prompt.
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
  const [signedUrl, downloadUrl] = pdfPath
    ? await Promise.all([getSignedPdfUrl(pdfPath), getSignedPdfUrl(pdfPath, bookPdfFilename(title))])
    : [null, null];

  if (!signedUrl) {
    return <BookNotAttached icon={FileWarning} dict={dict} />;
  }

  const d = dict.documents;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <object data={signedUrl} type="application/pdf" className="aspect-[4/3] w-full sm:aspect-video" aria-label={title}>
        <p className="p-6 text-sm text-muted-foreground">{d.pdfInlineUnsupported}</p>
      </object>
      <div className="flex divide-x divide-border border-t border-border">
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className="flex-1 px-4 py-2 text-center text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {d.openInNewTab}
        </a>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-center text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Download className="size-3.5" aria-hidden />
            {d.download}
          </a>
        ) : null}
      </div>
    </div>
  );
}
