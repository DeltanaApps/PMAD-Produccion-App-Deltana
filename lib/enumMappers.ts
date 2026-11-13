import { ProjectStatus, InvoiceSource, MemberType } from '../types';

// The SPA's TS enums use Spanish display strings as their literal values;
// the DB enums use plain snake_case tokens. These map between the two.

export const PROJECT_STATUS_TO_DB: Record<ProjectStatus, string> = {
  [ProjectStatus.Proposal]: 'propuesta',
  [ProjectStatus.InProgress]: 'en_proceso',
  [ProjectStatus.Completed]: 'finalizado',
};

export const PROJECT_STATUS_FROM_DB: Record<string, ProjectStatus> = {
  propuesta: ProjectStatus.Proposal,
  en_proceso: ProjectStatus.InProgress,
  finalizado: ProjectStatus.Completed,
};

export const MEMBER_TYPE_TO_DB: Record<MemberType, string> = {
  [MemberType.Internal]: 'interno',
  [MemberType.External]: 'externo',
};

export const MEMBER_TYPE_FROM_DB: Record<string, MemberType> = {
  interno: MemberType.Internal,
  externo: MemberType.External,
};

// The UI's "Origen" dropdown doesn't just offer "Acuerdo"/"Adicionales" --
// it offers each SPECIFIC additional (by its real id now; it used to be a
// fragile `Adicional ${position}` string). The DB's `source` enum only has
// room for the coarse acuerdo/adicionales split, so which specific
// additional a row belongs to is tracked separately via `additional_id`.
// This only stores a real link when that id still matches one of the
// project's current additionals -- if it was deleted since, the invoice
// falls back to the generic "Adicionales" bucket instead of failing the
// save (the FK would otherwise reject a dangling id).
export const INVOICE_SOURCE_TO_DB = (
  source: InvoiceSource | string | undefined,
  additionals: { id?: string }[]
): { source: string; additionalId: string | null } => {
  if (!source || source === InvoiceSource.Agreement) {
    return { source: 'acuerdo', additionalId: null };
  }
  const additionalId = additionals.some((a) => a.id === source) ? source : null;
  return { source: 'adicionales', additionalId };
};

export const INVOICE_SOURCE_FROM_DB = (source: string, additionalId: string | null | undefined): InvoiceSource | string => {
  if (source !== 'adicionales') return InvoiceSource.Agreement;
  return additionalId ?? InvoiceSource.Additionals;
};
