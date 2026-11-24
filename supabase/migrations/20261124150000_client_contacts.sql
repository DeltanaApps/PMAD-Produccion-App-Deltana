-- Replaces the fixed General/Técnico/Económico contact slots with a shared,
-- per-client directory of people (client_contacts) plus a flexible
-- assignment of any of them to a project with a free-text responsibility
-- (project_contacts.role_label). One ficha per person per client, reused
-- across every project with that client instead of re-typed each time --
-- same spirit as the earlier "clients" table (20261020224500).
--
-- Data is "live": a project_contacts row only stores client_contact_id +
-- role_label, never a copy of the person's name/email/phone/description --
-- so correcting a typo in someone's ficha fixes it everywhere they're
-- assigned, with no duplicated data to keep in sync.

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  description text, -- cargo / puesto en su empresa
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

comment on table public.client_contacts is
  'Shared directory of people at each client, reusable across every project with that client -- one ficha per person instead of re-typing their data per project.';

create index client_contacts_client_id_idx on public.client_contacts (client_id);

-- Lets the app find-or-create by (client, email) without a race, same
-- pattern as team_members' unique `contact`. Partial so people with no
-- email on file (rare) don't collide with each other.
create unique index client_contacts_client_email_idx
  on public.client_contacts (client_id, lower(email))
  where email is not null and trim(email) <> '';

alter table public.client_contacts enable row level security;

-- Shared catalog, same visibility as "clients" itself -- no financial data
-- lives here, just names/emails/phones of people at each client.
create policy client_contacts_select on public.client_contacts
  for select to authenticated
  using (true);

create policy client_contacts_insert on public.client_contacts
  for insert to authenticated
  with check (public.current_app_role() in ('gestor', 'direccion', 'administracion', 'administrador'));

create policy client_contacts_update on public.client_contacts
  for update to authenticated
  using (public.current_app_role() in ('gestor', 'direccion', 'administracion', 'administrador'))
  with check (public.current_app_role() in ('gestor', 'direccion', 'administracion', 'administrador'));

-- Step 0: drop empty "ghost" rows (blank name) -- leftovers from the old
-- modal's "+ Añadir" button, which let a técnico/económico row be saved
-- with every field still blank. Nothing to backfill there.
delete from public.project_contacts where trim(coalesce(name, '')) = '';

-- Step 1: widen project_contacts with the new relational shape, nullable
-- for now so existing rows can be backfilled before the old columns go away.
alter table public.project_contacts add column client_contact_id uuid references public.client_contacts (id);
alter table public.project_contacts add column role_label text;

-- Step 2: backfill role_label from the old fixed contact_group, numbering
-- duplicates the same way the UI used to render them (Técnico 1/2/3,
-- Económico 1/2 when a project had more than one of either).
with numbered as (
  select
    id,
    contact_group,
    row_number() over (partition by project_id, contact_group order by created_at) as rn,
    count(*) over (partition by project_id, contact_group) as grp_count
  from public.project_contacts
)
update public.project_contacts pc
set role_label = case
  when n.contact_group = 'general' then 'General'
  when n.contact_group = 'tecnico' and n.grp_count > 1 then 'Técnico ' || n.rn
  when n.contact_group = 'tecnico' then 'Técnico'
  when n.contact_group = 'economico' and n.grp_count > 1 then 'Económico ' || n.rn
  else 'Económico'
end
from numbered n
where n.id = pc.id;

-- Step 3: backfill client_contacts from whatever is already loaded on real
-- projects today, deduping per client by email when present, else by name.
insert into public.client_contacts (client_id, name, email, phone, description)
select distinct on (p.client_id, coalesce(lower(trim(pc.email)), lower(trim(pc.name))))
  p.client_id,
  trim(pc.name),
  nullif(trim(pc.email), ''),
  nullif(trim(pc.phone), ''),
  nullif(trim(pc.description), '')
from public.project_contacts pc
join public.projects p on p.id = pc.project_id
where trim(coalesce(pc.name, '')) <> ''
order by p.client_id, coalesce(lower(trim(pc.email)), lower(trim(pc.name))), pc.created_at asc;

-- Step 4: link every existing project_contacts row to its resolved
-- client_contacts row, using the identical dedup key as step 3.
update public.project_contacts pc
set client_contact_id = cc.id
from public.projects p, public.client_contacts cc
where p.id = pc.project_id
  and cc.client_id = p.client_id
  and coalesce(lower(trim(cc.email)), lower(trim(cc.name))) = coalesce(lower(trim(pc.email)), lower(trim(pc.name)))
  and pc.client_contact_id is null;

-- Verify before the destructive step below: abort the whole migration
-- (implicit transaction) if anything failed to link, instead of silently
-- dropping data we never resolved.
do $$
declare unresolved int;
begin
  select count(*) into unresolved from public.project_contacts where client_contact_id is null or role_label is null;
  if unresolved > 0 then
    raise exception 'client_contacts migration: % project_contacts rows could not be backfilled', unresolved;
  end if;
end $$;

alter table public.project_contacts alter column client_contact_id set not null;
alter table public.project_contacts alter column role_label set not null;

alter table public.project_contacts drop column contact_group;
alter table public.project_contacts drop column name;
alter table public.project_contacts drop column email;
alter table public.project_contacts drop column phone;
alter table public.project_contacts drop column description;

drop type public.contact_group;
