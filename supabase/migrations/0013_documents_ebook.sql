-- §12 document workflow, e-book/flipbook extension. Adds AnyFlip-embed
-- metadata to public.documents so /documents can render a real book shelf
-- instead of the "coming soon" placeholder. cover_url is schema-ready for a
-- future upload phase but is not read by the app yet — see CLAUDE.md §0.

alter table public.documents
  add column description text,
  add column flipbook_url text,
  add column cover_url text,
  add column published_at timestamptz;

-- Third of the three validation layers §19 requires (Zod in schemas/documents.ts
-- validates on write; lib/anyflip.ts's isAnyFlipEmbedUrl gates what the viewer
-- ever puts in an iframe src; this CHECK is the database-level backstop). Same
-- shape as the @udontech.ac.th domain rule enforced in three places for auth.
alter table public.documents
  add constraint documents_flipbook_url_is_anyflip
  check (
    flipbook_url is null
    or flipbook_url ~ '^https://(www\.)?anyflip\.com/[a-z0-9]+/[a-z0-9]+/?$'
  );
