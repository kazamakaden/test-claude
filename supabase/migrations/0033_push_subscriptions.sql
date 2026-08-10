-- Task 5 web push, opt-in half only: this phase stores subscriptions, it
-- does not send. One row per (user, browser install). Deliberately a new
-- table rather than a column on public.profiles — every new profiles
-- column needs an explicit `grant select (col)` after 0005 revoked the
-- table grant, and a push endpoint is a per-device capability URL that has
-- no business being readable alongside a member's directory fields.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The browser's push service URL, treated as a bearer-ish capability:
  -- readable only by its owner (0034), never exposed in any directory.
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) between 20 and 2000),
  p256dh_key text not null check (char_length(p256dh_key) between 1 and 255),
  auth_key text not null check (char_length(auth_key) between 1 and 255),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Scoped to (user_id, endpoint) rather than a bare unique(endpoint): two
  -- accounts sharing one browser would otherwise collide, and the
  -- owner-scoped UPDATE policy in 0034 would silently deny the second
  -- user's upsert (RLS denial reads as "no rows", not an error) — the exact
  -- failure mode services/*.ts already guards against with
  -- .select("id").maybeSingle(). Scoping uniqueness to the user makes the
  -- upsert well-defined for both.
  unique (user_id, endpoint)
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
