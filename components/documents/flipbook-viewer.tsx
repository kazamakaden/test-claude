import { BookX } from "lucide-react";
import { isAnyFlipEmbedUrl, toAnyFlipEmbedUrl } from "@/lib/anyflip";
import type { Dictionary } from "@/types/i18n";

/**
 * The last line of defense before a DB value is ever placed in an iframe
 * src — a flipbook_url that fails isAnyFlipEmbedUrl (should be impossible
 * given the DB CHECK constraint in 0013_documents_ebook.sql, but never
 * trust a single layer per §19) renders the empty state instead of the
 * frame.
 */
export function FlipbookViewer({
  title,
  flipbookUrl,
  dict,
}: {
  title: string;
  flipbookUrl: string | null;
  dict: Dictionary;
}) {
  const d = dict.documents;
  const embedUrl = flipbookUrl && isAnyFlipEmbedUrl(flipbookUrl) ? toAnyFlipEmbedUrl(flipbookUrl) : null;

  if (!embedUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center shadow-sm">
        <BookX className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-heading text-base font-medium text-foreground">{d.notAttached}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{d.notAttachedDescription}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="aspect-[4/3] w-full sm:aspect-video">
        <iframe
          src={embedUrl}
          title={title}
          className="size-full"
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  );
}
