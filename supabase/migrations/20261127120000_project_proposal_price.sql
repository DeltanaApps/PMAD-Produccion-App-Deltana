-- Estimated proposal price, entered while a project is still a Proposal.
-- Stands in as the project's Presupuesto (for Beneficio/rentabilidad
-- proyectados) until it becomes a real project with a client agreement.

alter table public.projects add column proposal_price numeric;
