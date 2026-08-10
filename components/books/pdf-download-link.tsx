import { Download } from "lucide-react";
import { getSignedPdfUrl } from "@/services/books";
import { bookPdfFilename } from "@/lib/books";
import type { Dictionary } from "@/types/i18n";

/**
 * Secondary download for a book that has both a flipbook embed (the
 * primary reader, per lib/books.ts#resolveBookSource) and a PDF attached —
 * without this, the PDF is unreachable from the detail page once a
 * flipbook_url is set. Task 6: this now genuinely downloads (Storage's
 * `download` option -> Content-Disposition: attachment) rather than only
 * opening the PDF in a new tab, matching the component's own name.
 */
export async function PdfDownloadLink({
  pdfPath,
  title,
  dict,
}: {
  pdfPath: string;
  title: string;
  dict: Dictionary;
}) {
  const d = dict.documents;
  const signedUrl = await getSignedPdfUrl(pdfPath, bookPdfFilename(title));
  if (!signedUrl) return null;

  return (
    <a
      href={signedUrl}
      className="flex w-fit items-center gap-1.5 text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Download className="size-3.5" aria-hidden />
      {d.downloadPdf}
    </a>
  );
}
