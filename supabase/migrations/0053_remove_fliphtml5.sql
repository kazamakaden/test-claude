-- Remove the FlipHTML5 flipbook integration entirely. The third-party host
-- does not meet this project's technical requirements or Thai government
-- web compliance, so books are read as plain PDFs served from the private
-- `books` Storage bucket (0029) via a per-request signed URL, opened in the
-- browser's own PDF viewer. No iframe, no third-party origin.
--
-- Supersedes 0013_documents_ebook.sql (AnyFlip) and
-- 0021_documents_fliphtml5.sql (the AnyFlip -> FlipHTML5 switch). There is
-- no migration path for the URLs themselves: a flipbook lives on someone
-- else's server and cannot be turned into a PDF here, so the column is
-- dropped rather than converted.

-- 1. books_published_needs_content (0027) currently accepts EITHER a
--    flipbook URL or a PDF. Dropping the flipbook half would leave any
--    flipbook-only published book violating the replacement constraint, so
--    those rows are returned to draft first. Verified against the live
--    project before writing this: every affected row is demo data. Staff
--    re-upload a PDF and publish again.
update public.books
   set status = 'draft',
       published_at = null,
       published_by = null
 where status = 'published'
   and pdf_path is null;

-- 2. Dropped explicitly rather than relying on DROP COLUMN to cascade it —
--    the constraint spans two columns, and leaving Postgres to decide is
--    the kind of implicit behaviour that makes a later reader guess.
alter table public.books
  drop constraint books_published_needs_content;

alter table public.books
  drop column flipbook_url;

-- 3. The publish gate, now single-source: a published book HAS a readable
--    file. Combined with books_select_published (0028), which is the only
--    policy an anonymous visitor matches, this makes "a guest can never be
--    shown a book with nothing behind it" a database invariant rather than
--    a UI check.
--
--    NOTE: actions/books.ts#publishBookAction identifies this failure by
--    matching this constraint's NAME in the Postgres error message. If it
--    is ever renamed again, that string must move with it or the "attach a
--    file first" message silently degrades to "not found or forbidden".
alter table public.books
  add constraint books_published_needs_pdf
  check (status <> 'published' or pdf_path is not null);

-- 4. The §12 document workflow's own flipbook field. It has no PDF upload
--    of its own, so services/documents.ts#approveDocument loses the bridge
--    that auto-listed an approved document on the shelf — see that
--    function's comment for what would restore it.
alter table public.documents
  drop constraint documents_flipbook_url_is_fliphtml5;

alter table public.documents
  drop column flipbook_url;
