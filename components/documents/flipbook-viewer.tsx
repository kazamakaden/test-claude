import { BookX } from "lucide-react";
import { BookNotAttached } from "@/components/books/book-not-attached";
import { isFlipHtml5EmbedUrl, toFlipHtml5EmbedUrl } from "@/lib/fliphtml5";
import type { Dictionary } from "@/types/i18n";

/**
 * The last line of defense before a DB value is ever placed in an iframe
 * src — a flipbook_url that fails isFlipHtml5EmbedUrl (should be impossible
 * given the DB CHECK constraint in 0021_documents_fliphtml5.sql, but never
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
  const embedUrl = flipbookUrl && isFlipHtml5EmbedUrl(flipbookUrl) ? toFlipHtml5EmbedUrl(flipbookUrl) : null;

  if (!embedUrl) {
    return <BookNotAttached icon={BookX} dict={dict} />;
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
