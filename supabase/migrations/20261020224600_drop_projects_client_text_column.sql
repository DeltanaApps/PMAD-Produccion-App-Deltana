-- Step 2 of 2 for the shared "Clientes" directory (see the previous
-- migration). Run this ONLY after confirming every project resolved a
-- client_id -- this must return 0 rows:
--
--   select count(*) from public.projects where client_id is null;
--
-- If it doesn't, fix those rows manually (the old text column is still
-- there to compare against) before running this.

alter table public.projects alter column client_id set not null;
alter table public.projects drop column client;
