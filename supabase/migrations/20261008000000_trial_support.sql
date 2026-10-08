-- Free-trial support.
--
-- * subscriptions.trial_end: when the current trial ends (null = not
--   trialing). Written by the webhook from the subscription event.
-- * trial_devices: one row per browser device that started a free trial.
--   The webhook inserts it at trial start (status 'active') from the
--   checkout metadata and flips it to 'ended' when the trial concludes
--   (first invoice paid/failed, or the subscription is deleted). Trial
--   eligibility checks this table so a device can never trial twice.

alter table public.subscriptions
  add column if not exists trial_end timestamptz;

create table if not exists public.trial_devices (
  device_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists idx_trial_devices_user_id on public.trial_devices (user_id);

alter table public.trial_devices enable row level security;

drop policy if exists "Users read own trial device" on public.trial_devices;
create policy "Users read own trial device"
  on public.trial_devices for select
  using (auth.uid() = user_id);
