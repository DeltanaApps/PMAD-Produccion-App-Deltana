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

export const INVOICE_SOURCE_TO_DB = (source?: InvoiceSource | string): string => {
  if (source === InvoiceSource.Additionals) return 'adicionales';
  return 'acuerdo';
};

export const INVOICE_SOURCE_FROM_DB = (source: string): InvoiceSource => {
  return source === 'adicionales' ? InvoiceSource.Additionals : InvoiceSource.Agreement;
};
