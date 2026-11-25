-- "No computa": permite marcar un recurso interno de un proyecto para que sus
-- horas/fichajes se sigan mostrando (a efectos técnicos) pero no se sumen al
-- Gasto Proyectado ni al Gasto Real totales del proyecto.
alter table public.project_member_rates
  add column if not exists exclude_from_actual_total boolean not null default false;
