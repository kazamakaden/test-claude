import { Download, ExternalLink } from "lucide-react";
import { getSignedPdfUrl } from "@/services/books";
import { bookPdfFilename } from "@/lib/books";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/types/i18n";

/**
 * The two things you can do with a book's file: open it in the browser's
 * own PDF viewer, or save it.
 *
 * TWO signed URLs, deliberately. The download one carries Storage's
 * `download` option, which makes the response set
 * `Content-Disposition: attachment`; putting that header on the URL used
 * for opening would turn the view link into a save prompt as well. (A plain
 * HTML `download` attribute is no substitute — it is ignored across an
 * origin boundary, and Storage is always a different origin from the app.)
 *
 * Callers are responsible for the publish guard — this renders whatever
 * path it is handed. See lib/books.ts#canOpenBookPdf.
 */
export async function BookFileActions({
  pdfPath,
  title,
  dict,
}: {
  pdfPath: string;
  title: string;
  dict: Dictionary;
}) {
  const d = dict.documents;
  const [viewUrl, downloadUrl] = await Promise.all([
    getSignedPdfUrl(pdfPath),
    getSignedPdfUrl(pdfPath, bookPdfFilename(title)),
  ]);

  if (!viewUrl && !downloadUrl) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {viewUrl ? (
        <Button
          nativeButton={false}
          render={<a href={viewUrl} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink className="size-4" aria-hidden />
          {d.openPdf}
          <span className="sr-only"> ({d.opensInNewTab})</span>
        </Button>
      ) : null}
      {downloadUrl ? (
        <a
          href={downloadUrl}
          className="flex items-center gap-1.5 text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Download className="size-3.5" aria-hidden />
          {d.downloadPdf}
        </a>
      ) : null}
    </div>
  );
}
