-- Task 2: staff-editable public page copy (starting with "11 ดี 11 เก่ง
-- อวท."). A slug-keyed table rather than a single-row one, so a second
-- editable page (e.g. /announcements, still a PageShell stub — see
-- CLAUDE.md §0 Remaining) can reuse this table later without another
-- migration. Rows are seeded by migration, not created from the UI — see
-- 0032's RLS header for why there is no INSERT/DELETE policy.
--
-- th/en are separate columns, not a jsonb blob or a second table, per the
-- confirmed decision: en falls back to th when empty, which a plain NULL
-- check on body_en/title_en expresses directly.
create table public.content_blocks (
  slug text primary key check (slug ~ '^[a-z0-9-]{1,64}$'),
  title_th text not null check (char_length(title_th) between 1 and 200),
  -- NULL, not '', so the app can distinguish "no English title yet" (fall
  -- back to title_th) from "deliberately blank" — same reasoning for body_en.
  title_en text check (title_en is null or char_length(title_en) <= 200),
  body_th text not null default '' check (char_length(body_th) <= 20000),
  body_en text check (body_en is null or char_length(body_en) <= 20000),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger content_blocks_set_updated_at
  before update on public.content_blocks
  for each row execute function public.set_updated_at();

-- Seeded empty so /aft-11 renders its real empty state on day one; staff
-- fill it in through the in-app editor (content:manage, lib/auth/permissions.ts).
insert into public.content_blocks (slug, title_th, title_en, body_th, body_en)
values (
  'aft-11-good-11-skilled',
  '11 ดี 11 เก่ง อวท.',
  '11 Good 11 Skilled — AFT',
  '',
  null
);
