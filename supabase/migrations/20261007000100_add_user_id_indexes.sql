-- Performance: these columns power every RLS check
-- (`user_id = auth.uid()` / `owner_id = auth.uid()`) but had no index,
-- so each request seq-scanned its table. One index per column.

create index if not exists idx_api_keys_user_id on public.api_keys (user_id);
create index if not exists idx_event_pages_user_id on public.event_pages (user_id);
create index if not exists idx_extractions_user_id on public.extractions (user_id);
create index if not exists idx_reminders_user_id on public.reminders (user_id);
create index if not exists idx_webhooks_user_id on public.webhooks (user_id);
create index if not exists idx_workspace_members_user_id on public.workspace_members (user_id);
create index if not exists idx_workspaces_owner_id on public.workspaces (owner_id);
