import { getSignedPdfUrl } from "@/services/books";
import type { Dictionary } from "@/types/i18n";

/**
 * Secondary download link for a book that has both a flipbook embed (the
 * primary reader, per lib/books.ts#resolveBookSource) and a PDF attached —
 * without this, the PDF is unreachable from the detail page once a
 * flipbook_url is set.
 */
export async function PdfDownloadLink({ pdfPath, dict }: { pdfPath: string; dict: Dictionary }) {
  const d = dict.documents;
  const signedUrl = await getSignedPdfUrl(pdfPath);
  if (!signedUrl) return null;

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noreferrer"
      className="w-fit text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {d.openInNewTab}
    </a>
  );
}
