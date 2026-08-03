-- §12 document workflow, e-book host switch: AnyFlip -> FlipHTML5. Replaces
-- 0013_documents_ebook.sql's documents_flipbook_url_is_anyflip constraint.
-- Any existing row whose flipbook_url is an AnyFlip URL cannot possibly
-- match the new FlipHTML5-only pattern, so it is nulled out first — leaving
-- it in place would make the new CHECK fail to validate against existing
-- data, and there is no automatic AnyFlip -> FlipHTML5 URL translation
-- (they are different third-party hosts with unrelated book ids).
update public.documents
  set flipbook_url = null
  where flipbook_url is not null
    and flipbook_url !~* '^https://(www\.|online\.)?fliphtml5\.com/[a-z0-9_-]{1,40}/[a-z0-9_-]{1,40}/?$';

alter table public.documents
  drop constraint documents_flipbook_url_is_anyflip;

-- Third of the three validation layers §19 requires (Zod in
-- schemas/documents.ts validates on write; lib/fliphtml5.ts's
-- isFlipHtml5EmbedUrl gates what the viewer ever puts in an iframe src;
-- this CHECK is the database-level backstop). Both fliphtml5.com (the share
-- link a person copies out of their dashboard) and online.fliphtml5.com
-- (the reader host FlipHTML5's own embed code points at) are accepted, case
-- insensitively, matching lib/fliphtml5.ts's FLIPHTML5_URL_PATTERN.
alter table public.documents
  add constraint documents_flipbook_url_is_fliphtml5
  check (
    flipbook_url is null
    or flipbook_url ~* '^https://(www\.|online\.)?fliphtml5\.com/[a-z0-9_-]{1,40}/[a-z0-9_-]{1,40}/?$'
  );
