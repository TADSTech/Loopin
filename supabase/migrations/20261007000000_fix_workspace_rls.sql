-- Fix 42P17 infinite recursion in workspace RLS.
--
-- The original "Members read workspaces" policy queried workspace_members,
-- whose policies queried workspaces back — a policy cycle that made every
-- SELECT on either table fail at runtime (infinite recursion detected).
-- SECURITY DEFINER helpers break the cycle: they evaluate membership with
-- owner privileges, so the inner query no longer re-enters RLS.

create or replace function public.is_workspace_owner(wid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspaces
    where id = wid and owner_id = auth.uid()
  )
$$;

create or replace function public.is_workspace_member(wid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = wid and user_id = auth.uid()
  )
$$;

revoke execute on function public.is_workspace_owner(uuid) from public;
revoke execute on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_owner(uuid) to anon, authenticated, service_role;
grant execute on function public.is_workspace_member(uuid) to anon, authenticated, service_role;

drop policy if exists "Members read workspaces" on public.workspaces;
create policy "Members read workspaces"
  on public.workspaces for select
  using (
    owner_id = auth.uid()
    or public.is_workspace_member(id)
  );

drop policy if exists "Members read membership" on public.workspace_members;
create policy "Members read membership"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or public.is_workspace_owner(workspace_id)
  );

drop policy if exists "Owners add members" on public.workspace_members;
create policy "Owners add members"
  on public.workspace_members for insert
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners remove members" on public.workspace_members;
create policy "Owners remove members"
  on public.workspace_members for delete
  using (public.is_workspace_owner(workspace_id));
