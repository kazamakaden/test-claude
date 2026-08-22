-- §2/§3 books shelf (tasks 2, 3). A new table, not an extension of
-- `documents` — documents.status is welded to the §12
-- draft -> signed -> pending_approval -> official workflow via
-- documents_enforce_status_transition (0016), and documents deliberately
-- has no owner-DELETE policy since signature_records (a legal artifact)
-- cascades from it. Giving a book owner DELETE on documents would hand
-- them DELETE over any linked signature record too. Books get their own,
-- much simpler draft/published lifecycle per the confirmed decision: no
-- signature step, no multi-stage approval — just a publish gate.
--
-- Creating a brand-new enum and using it in the same migration is fine;
-- only ALTER TYPE ... ADD VALUE has the two-transaction restriction that
-- 0010/0019 exist for.
create type public.book_status as enum ('draft', 'published');

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  -- 4-digit Buddhist year (e.g. 2569) — NOT the 2-digit form
  -- profiles.academic_year / activities.academic_year use (69, derived
  -- from the §14 student ID). Different unit, same word: do not "fix" one
  -- to match the other.
  academic_year smallint not null check (academic_year between 2500 and 2699),
  -- 1 = ภาคเรียนที่ 1, 2 = ภาคเรียนที่ 2, 3 = ภาคฤดูร้อน
  season smallint not null check (season in (1, 2, 3)),
  status public.book_status not null default 'draft',
  -- Mirrors documents_flipbook_url_is_fliphtml5 (0021) / lib/fliphtml5.ts —
  -- same host allow-list, kept in sync by hand since the two tables have no
  -- shared domain object.
  flipbook_url text check (
    flipbook_url is null
    or flipbook_url ~* '^https://(www\.|online\.)?fliphtml5\.com/[a-z0-9_-]{1,40}/[a-z0-9_-]{1,40}/?$'
  ),
  -- Storage object paths (0029), not URLs — a signed URL is minted per
  -- request at read time so a draft's PDF is never guessable-by-path.
  pdf_path text,
  cover_path text,
  owner_id uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  -- §12 document -> shelf bridge (services/documents.ts#approveDocument):
  -- an approved document auto-lists here, upserted by this id so approval
  -- stays idempotent.
  source_document_id uuid unique references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A published book must have something to actually read.
  constraint books_published_needs_content check (
    status <> 'published' or flipbook_url is not null or pdf_path is not null
  )
);

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

create index books_status_published_at_idx on public.books (status, published_at desc);
create index books_owner_id_idx on public.books (owner_id);
create index books_year_season_idx on public.books (academic_year, season);
create index books_title_idx on public.books (title);
create index books_published_by_idx on public.books (published_by);
