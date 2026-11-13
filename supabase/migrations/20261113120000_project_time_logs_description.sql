-- The Odoo fichaje export has a 5th column (Descripción) that
-- timeTrackingParser.ts was already parsing and silently discarding --
-- never persisted, never shown. Adds the column to keep it.

alter table public.project_time_logs add column description text;
