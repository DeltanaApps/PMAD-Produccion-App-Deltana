-- Lets a project keep its original "Código de Propuesta" archived separately
-- once it gets promoted to a real project code, plus a link to the proposal's
-- estimate/budget document for later reference.

alter table public.projects add column proposal_code text;
alter table public.projects add column proposal_estimate_url text;
