-- Introduces a real "Clientes" shared entity, instead of a free-text name
-- duplicated per project. Any gestor can now see/reuse every client already
-- created by any OTHER gestor (so the dropdown in "Nuevo Proyecto" stops
-- being scoped to "only MY own projects' clients") — while each project's
-- own financial data (facturación, horas, montos) stays exactly as private
-- as it is today, gated by the existing projects_select RLS policy
-- (manager_id = auth.uid() or project membership). Clients only share their
-- identity (name), nothing about which projects they're attached to.
--
-- Step 1 of 2: creates the table, backfills it from existing project data,
-- and links projects to it via client_id — WITHOUT touching the old
-- projects.client text column yet. See the next migration for that cleanup,
-- which should only run after verifying every project resolved a client_id.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

comment on table public.clients is
  'Shared client directory: any gestor can create or reuse a client name. Project-level financial data stays private per gestor via projects RLS -- this table only holds the client identity.';

alter table public.clients enable row level security;

-- Visible to everyone logged in -- it's just company names, no financial
-- data lives here, and every role that creates projects needs to see it.
create policy clients_select on public.clients
  for select to authenticated
  using (true);

-- Only roles that actually create projects can add a new client.
create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.current_app_role() in ('gestor', 'direccion', 'administracion', 'administrador'));

-- Backfill: one clients row per distinct (case-insensitive, trimmed) name
-- already used across existing projects. Keeps the casing of whichever
-- project was created first for that client.
insert into public.clients (name)
select distinct on (lower(trim(client))) trim(client)
from public.projects
where client is not null and trim(client) <> ''
order by lower(trim(client)), created_at asc;

alter table public.projects add column client_id uuid references public.clients (id);

update public.projects p
set client_id = c.id
from public.clients c
where lower(trim(p.client)) = lower(c.name);

create index projects_client_id_idx on public.projects (client_id);
