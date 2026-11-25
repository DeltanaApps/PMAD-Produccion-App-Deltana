-- Per-gestor monthly client-billing goal, used to show "% de la meta" next
-- to the client billing figures in the Dashboard Ejecutivo (main total,
-- Ranking de Gestores, and the month's invoice breakdown). Only Dirección
-- and Administrador can set it; everyone who can see billing figures
-- (gestor included, for their own dashboard) can read it.
--
-- No row for a manager means "use the app's default of 80.000 EUR/month" --
-- that fallback lives in the frontend, not here, so this table only needs
-- a row once someone actually overrides the default for that gestor.
create table public.manager_billing_goals (
  manager_id uuid primary key references public.profiles (id) on delete cascade,
  monthly_goal numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

comment on table public.manager_billing_goals is
  'Per-manager monthly client-billing goal, set by Direccion/Administrador. No row for a manager means the app default (80.000 EUR) applies.';

alter table public.manager_billing_goals enable row level security;

create policy manager_billing_goals_select on public.manager_billing_goals
  for select to authenticated
  using (true);

create policy manager_billing_goals_insert on public.manager_billing_goals
  for insert to authenticated
  with check (public.current_app_role() in ('direccion', 'administrador'));

create policy manager_billing_goals_update on public.manager_billing_goals
  for update to authenticated
  using (public.current_app_role() in ('direccion', 'administrador'))
  with check (public.current_app_role() in ('direccion', 'administrador'));
