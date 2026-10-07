-- Supports SSO (Microsoft/Azure) provisioning: lets Administración
-- pre-assign a role to an email BEFORE that person ever logs in. When
-- they log in for the first time (via Microsoft or otherwise), the
-- new-user trigger checks this table and grants that role + active=true
-- immediately, instead of falling back to the safe default (inactive,
-- colaborador) that applies to anyone not pre-assigned.
--
-- Without this, every brand-new SSO login (any Deltana employee with a
-- Microsoft account) would land on an inactive account with no access,
-- which is the correct default — but it means Dirección/Administración
-- would otherwise also have to wait for manual activation on their
-- very first login. This table lets us seed known accounts (starting
-- with the main admin) ahead of time.

create table public.pending_role_assignments (
  email text primary key,
  role public.app_role not null,
  name text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

comment on table public.pending_role_assignments is
  'Role to grant automatically the first time this email logs in; the row is consumed (deleted) once applied.';

alter table public.pending_role_assignments enable row level security;

create policy pending_role_assignments_all on public.pending_role_assignments
  for all
  using (public.current_app_role() = 'administracion')
  with check (public.current_app_role() = 'administracion');

-- Replace the new-user trigger to consult the table above and to make
-- "inactive until granted access" the default for anyone not pre-assigned
-- (previously every new signup was active=true by default, which was fine
-- when Administración was the only way to create an account, but is not
-- safe once any Deltana employee can authenticate via SSO).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pending public.pending_role_assignments%rowtype;
begin
  select * into pending
  from public.pending_role_assignments
  where lower(email) = lower(new.email)
  limit 1;

  if found then
    insert into public.profiles (id, email, role, name, active)
    values (new.id, new.email, pending.role, pending.name, true);
    delete from public.pending_role_assignments where lower(email) = lower(new.email);
  else
    insert into public.profiles (id, email, active)
    values (new.id, new.email, false);
  end if;

  return new;
end;
$$;
