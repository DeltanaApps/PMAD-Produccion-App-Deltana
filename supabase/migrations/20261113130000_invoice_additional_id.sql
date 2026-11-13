-- Fixes the real "Origen de facturación" bug: the UI's dropdown already
-- offers each specific additional (previously as a fragile `Adicional N`
-- position string), but INVOICE_SOURCE_TO_DB only ever recognized the
-- generic "Adicionales" value, so every specific-additional assignment
-- silently collapsed to "Acuerdo Principal" on save. The `source` enum
-- only has room for the coarse acuerdo/adicionales split, so which
-- specific additional a row belongs to needs its own column -- a real FK
-- to that additional's row, not a position that breaks if the additionals
-- list is ever reordered or trimmed. `on delete set null` (not cascade):
-- deleting an additional shouldn't delete the invoice that referenced it,
-- just its link to that specific additional.

alter table public.project_invoices
  add column additional_id uuid references public.project_client_additionals (id) on delete set null;

alter table public.project_planned_invoices
  add column additional_id uuid references public.project_client_additionals (id) on delete set null;

alter table public.collaborator_payments
  add column additional_id uuid references public.collaborator_additionals (id) on delete set null;

alter table public.collaborator_planned_invoices
  add column additional_id uuid references public.collaborator_additionals (id) on delete set null;
