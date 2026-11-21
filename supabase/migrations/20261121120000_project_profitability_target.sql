-- Lets a project override the app-wide 50% profitability semaphore with its
-- own target (null = use the app default).

alter table public.projects add column profitability_target numeric;
