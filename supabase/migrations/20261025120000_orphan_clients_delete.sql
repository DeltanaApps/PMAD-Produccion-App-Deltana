-- Lets a gestor clean up a client they created that ended up with zero
-- projects attached (e.g. they edited a project and picked a different
-- client afterwards, or deleted the only project that used it). Clients are
-- a shared catalog (clients_select is `using (true)`), so a gestor can only
-- ever manage the ones THEY created, never someone else's.

-- `created_by` already exists on public.clients but no code path ever set
-- it -- every client row inserted so far has it NULL. From now on,
-- findOrCreateClientId (lib/api/projects.ts) passes the acting manager's id
-- on insert, so ownership starts being tracked going forward. Already
-- existing orphan clients (created before this change) have no reliable
-- origin to backfill from and simply won't show up as "mine" to delete --
-- harmless, since they're untouched either way.

create policy clients_delete on public.clients
  for delete to authenticated
  using (created_by = auth.uid());

-- Whether a client has zero projects can't be checked client-side with a
-- plain `select client_id from projects`: the projects_select RLS policy
-- only shows a gestor their own projects, so a client used exclusively by
-- another gestor's project would look orphaned from here. This function
-- runs as security definer specifically to see across ALL projects for
-- that one check, while still only ever returning the caller's own clients
-- (created_by = auth.uid()) -- never another gestor's client list or any
-- project detail.
create or replace function public.my_orphan_clients()
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name
  from public.clients c
  where c.created_by = auth.uid()
    and not exists (
      select 1 from public.projects p where p.client_id = c.id
    )
  order by c.name;
$$;

grant execute on function public.my_orphan_clients() to authenticated;

-- Belt and suspenders: even if the check above were ever wrong (e.g. a
-- project gets attached to the client in the instant between the check and
-- the delete), the FK from projects.client_id to clients.id has no ON
-- DELETE clause, so Postgres rejects the delete outright (23503) rather
-- than orphaning a real project's client reference.
