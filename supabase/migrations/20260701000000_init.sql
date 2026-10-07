-- Loopin v3 initial schema
-- Applied with `supabase db push`. Mirrors supabase/schema.sql.

-- ---------------------------------------------------------------------------
-- profiles: public user metadata
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- connected_calendars: non-secret connection state (owner-readable)
-- ---------------------------------------------------------------------------
create table if not exists public.connected_calendars (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calendar_id text not null default 'primary',
  connected boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.connected_calendars enable row level security;

drop policy if exists "Users read own calendar connection" on public.connected_calendars;
create policy "Users read own calendar connection"
  on public.connected_calendars for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- calendar_tokens: SECRETS. No RLS policies are granted, so only the
-- service-role key (server-only) can read or write these rows.
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.calendar_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- subscriptions: plan state. Written by the server (service role) only.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users read own subscription" on public.subscriptions;
create policy "Users read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- extractions: usage / lead history (also powers the free monthly quota)
-- ---------------------------------------------------------------------------
create table if not exists public.extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  event_count int not null default 0,
  synced_count int not null default 0,
  source_preview text,
  created_at timestamptz not null default now()
);

alter table public.extractions enable row level security;

drop policy if exists "Users read own extractions" on public.extractions;
create policy "Users read own extractions"
  on public.extractions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own extractions" on public.extractions;
create policy "Users insert own extractions"
  on public.extractions for insert
  with check (auth.uid() = user_id);
