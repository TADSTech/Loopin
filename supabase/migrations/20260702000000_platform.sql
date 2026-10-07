-- Loopin v3 platform expansion: teams, public pages, reminders, API, webhooks.

-- ---------------------------------------------------------------------------
-- workspaces + members (Shared Calendars)
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "Members read workspaces" on public.workspaces;
create policy "Members read workspaces"
  on public.workspaces for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspaces.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Owners insert workspaces" on public.workspaces;
create policy "Owners insert workspaces"
  on public.workspaces for insert with check (owner_id = auth.uid());

drop policy if exists "Owners update workspaces" on public.workspaces;
create policy "Owners update workspaces"
  on public.workspaces for update using (owner_id = auth.uid());

drop policy if exists "Owners delete workspaces" on public.workspaces;
create policy "Owners delete workspaces"
  on public.workspaces for delete using (owner_id = auth.uid());

drop policy if exists "Members read membership" on public.workspace_members;
create policy "Members read membership"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners add members" on public.workspace_members;
create policy "Owners add members"
  on public.workspace_members for insert
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners remove members" on public.workspace_members;
create policy "Owners remove members"
  on public.workspace_members for delete
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- event_pages (Public Event Pages)
-- ---------------------------------------------------------------------------
create table if not exists public.event_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  title text not null,
  "start" text,
  "end" text,
  location text,
  notes text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.event_pages enable row level security;

drop policy if exists "Event pages are readable" on public.event_pages;
create policy "Event pages are readable"
  on public.event_pages for select
  using (is_public = true or user_id = auth.uid());

drop policy if exists "Owners insert event pages" on public.event_pages;
create policy "Owners insert event pages"
  on public.event_pages for insert with check (user_id = auth.uid());

drop policy if exists "Owners update event pages" on public.event_pages;
create policy "Owners update event pages"
  on public.event_pages for update using (user_id = auth.uid());

drop policy if exists "Owners delete event pages" on public.event_pages;
create policy "Owners delete event pages"
  on public.event_pages for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reminders (Smart Reminders)
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_title text not null,
  event_start timestamptz,
  channel text not null default 'email',
  send_at timestamptz not null,
  status text not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

drop policy if exists "Users read own reminders" on public.reminders;
create policy "Users read own reminders"
  on public.reminders for select using (user_id = auth.uid());

drop policy if exists "Users insert own reminders" on public.reminders;
create policy "Users insert own reminders"
  on public.reminders for insert with check (user_id = auth.uid());

drop policy if exists "Users delete own reminders" on public.reminders;
create policy "Users delete own reminders"
  on public.reminders for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- api_keys (API & Webhooks)
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Default',
  prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.api_keys enable row level security;

drop policy if exists "Users read own api keys" on public.api_keys;
create policy "Users read own api keys"
  on public.api_keys for select using (user_id = auth.uid());

drop policy if exists "Users insert own api keys" on public.api_keys;
create policy "Users insert own api keys"
  on public.api_keys for insert with check (user_id = auth.uid());

drop policy if exists "Users delete own api keys" on public.api_keys;
create policy "Users delete own api keys"
  on public.api_keys for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- webhooks (API & Webhooks)
-- ---------------------------------------------------------------------------
create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default array['extraction.completed'],
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.webhooks enable row level security;

drop policy if exists "Users read own webhooks" on public.webhooks;
create policy "Users read own webhooks"
  on public.webhooks for select using (user_id = auth.uid());

drop policy if exists "Users insert own webhooks" on public.webhooks;
create policy "Users insert own webhooks"
  on public.webhooks for insert with check (user_id = auth.uid());

drop policy if exists "Users update own webhooks" on public.webhooks;
create policy "Users update own webhooks"
  on public.webhooks for update using (user_id = auth.uid());

drop policy if exists "Users delete own webhooks" on public.webhooks;
create policy "Users delete own webhooks"
  on public.webhooks for delete using (user_id = auth.uid());
