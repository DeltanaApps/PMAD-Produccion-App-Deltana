-- The "Nº Factura" field the user types in Facturas Emitidas (ClientFinancialsModal
-- / CollaboratorFinancialsModal) was never actually persisted: both tables only
-- had their own internal `id uuid` primary key, so saveClientFinancials /
-- saveCollaboratorFinancials silently dropped the typed invoice number on
-- insert, and the next fetch mapped the row's real uuid back into that same
-- field -- the user's "INV_26-007" turning into a long uuid after a refresh.
-- Adds a real column for it, separate from the row's own id.

alter table public.project_invoices add column invoice_number text;
alter table public.collaborator_payments add column invoice_number text;
