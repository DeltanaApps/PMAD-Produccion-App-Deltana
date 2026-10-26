import { supabase } from '../supabaseClient';
import type {
  Project,
  TeamMember,
  InternalWorkRange,
  PartialDelivery,
  CollaboratorPartialDelivery,
  ContactInfo,
  ClientInfo,
  ActualTimeTrackingUpload,
} from '../../types';
import {
  PROJECT_STATUS_FROM_DB,
  MEMBER_TYPE_FROM_DB,
  INVOICE_SOURCE_FROM_DB,
} from '../enumMappers';

// --- Raw row shapes returned by the nested select below (snake_case, as
// PostgREST returns them). Only the columns we actually select. ---

interface PartialDeliveryRow {
  id: string;
  description: string;
  date: string;
  completed: boolean;
}

interface ContactRow {
  id: string;
  contact_group: 'tecnico' | 'economico' | 'general';
  name: string;
  email: string | null;
  phone: string | null;
  description: string | null;
}

interface WorkRangeDeliveryRow extends PartialDeliveryRow {}

interface WorkRangeRow {
  id: string;
  task_name: string;
  start_date: string;
  end_date: string;
  dedication_percentage: number;
  holidays_count: number;
  manual_hours: number | null;
  deliveries: WorkRangeDeliveryRow[];
}

interface CollaboratorAgreementRow {
  amount: number | null;
  contract_url: string | null;
  start_date: string | null;
  end_date: string | null;
  work_received: boolean;
}

interface CollaboratorAdditionalRow {
  id: string;
  description: string;
  amount: number;
  url: string | null;
}

interface CollaboratorInvoiceRow {
  id: string;
  description?: string;
  date: string;
  amount: number;
  percentage: number | null;
  source: string;
  invoiced?: boolean;
  pdf_url?: string | null;
}

interface TeamMemberRow {
  id: string;
  contact: string;
  name: string;
  company: string | null;
  member_type: 'interno' | 'externo';
  internal_member_type: string | null;
  default_hourly_rate: number | null;
}

interface ProjectMemberRow {
  id: string;
  role: string | null;
  task: string | null;
  active: boolean;
  team_member_id: string;
  team_member: TeamMemberRow;
  rate: { hourly_rate: number | null } | null;
  work_ranges: WorkRangeRow[];
  collaborator_agreement: CollaboratorAgreementRow | null;
  collaborator_additionals: CollaboratorAdditionalRow[];
  collaborator_partial_deliveries: PartialDeliveryRow[];
  collaborator_planned_invoices: CollaboratorInvoiceRow[];
  collaborator_payments: CollaboratorInvoiceRow[];
}

interface ProjectInvoiceRow {
  id: string;
  description?: string;
  date: string;
  amount: number;
  percentage: number | null;
  source: string;
  invoiced?: boolean;
  pdf_url?: string | null;
}

interface ProjectRow {
  id: string;
  code: string | null;
  name: string;
  export_name: string | null;
  client: { name: string } | null;
  status: string;
  status_detail: string | null;
  start_date: string | null;
  end_date: string | null;
  closing_email_sent: boolean;
  contacts: ContactRow[];
  partial_deliveries: PartialDeliveryRow[];
  client_agreement: { amount: number; offer_url: string | null; contract_url: string | null } | null;
  client_additionals: { id: string; description: string; amount: number; url: string | null }[];
  planned_invoices: ProjectInvoiceRow[];
  invoices: ProjectInvoiceRow[];
  time_logs: { id: string; date: string; employee_name: string; hours: number; project_name_ref: string | null }[];
  time_log_upload: { file_name: string | null; uploaded_at: string | null } | null;
  members: ProjectMemberRow[];
}

const PROJECT_SELECT = `
  id, code, name, export_name, client:clients(name), status, status_detail, start_date, end_date, closing_email_sent,
  contacts:project_contacts(id, contact_group, name, email, phone, description),
  partial_deliveries:project_partial_deliveries(id, description, date, completed),
  client_agreement:project_client_agreement(amount, offer_url, contract_url),
  client_additionals:project_client_additionals(id, description, amount, url),
  planned_invoices:project_planned_invoices(id, description, date, amount, percentage, source, invoiced),
  invoices:project_invoices(id, amount, date, pdf_url, percentage, source),
  time_logs:project_time_logs(id, date, employee_name, hours, project_name_ref),
  time_log_upload:project_time_log_uploads(file_name, uploaded_at),
  members:project_members(
    id, role, task, active, team_member_id,
    team_member:team_members(id, contact, name, company, member_type, internal_member_type, default_hourly_rate),
    rate:project_member_rates(hourly_rate),
    work_ranges:internal_work_ranges(
      id, task_name, start_date, end_date, dedication_percentage, holidays_count, manual_hours,
      deliveries:internal_work_range_deliveries(id, description, date, completed)
    ),
    collaborator_agreement:collaborator_agreements(amount, contract_url, start_date, end_date, work_received),
    collaborator_additionals(id, description, amount, url),
    collaborator_partial_deliveries(id, description, date, completed),
    collaborator_planned_invoices(id, description, date, amount, percentage, source, invoiced),
    collaborator_payments(id, amount, date, pdf_url, percentage, source)
  )
`;

const mapPartialDelivery = (row: PartialDeliveryRow): PartialDelivery => ({
  id: row.id,
  description: row.description,
  date: row.date,
  completed: row.completed,
});

const mapCollaboratorPartialDelivery = (row: PartialDeliveryRow): CollaboratorPartialDelivery => ({
  id: row.id,
  description: row.description,
  date: row.date,
  completed: row.completed,
});

const mapContact = (row: ContactRow): ContactInfo => ({
  name: row.name,
  email: row.email ?? '',
  phone: row.phone ?? '',
  description: row.description ?? undefined,
});

const mapWorkRange = (row: WorkRangeRow): InternalWorkRange => ({
  id: row.id,
  taskName: row.task_name,
  startDate: row.start_date,
  endDate: row.end_date,
  dedicationPercentage: row.dedication_percentage,
  holidaysCount: row.holidays_count,
  manualHours: row.manual_hours ?? undefined,
  partialDeliveries: row.deliveries.map(mapPartialDelivery),
});

const mapClientInfo = (row: ProjectRow): ClientInfo | undefined => {
  if (!row.client_agreement) return undefined;
  return {
    agreement: {
      amount: row.client_agreement.amount,
      offerUrl: row.client_agreement.offer_url ?? '',
      contractUrl: row.client_agreement.contract_url ?? undefined,
    },
    additionals: row.client_additionals.map((a) => ({
      description: a.description,
      amount: a.amount,
      url: a.url ?? undefined,
    })),
    plannedInvoices: row.planned_invoices.map((pi) => ({
      id: pi.id,
      description: pi.description ?? '',
      date: pi.date,
      amount: pi.amount,
      percentage: pi.percentage ?? undefined,
      source: INVOICE_SOURCE_FROM_DB(pi.source),
    })),
    invoices: row.invoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      date: inv.date,
      pdfUrl: inv.pdf_url ?? '',
      percentage: inv.percentage ?? undefined,
      source: INVOICE_SOURCE_FROM_DB(inv.source),
    })),
  };
};

const mapActualTimeTracking = (row: ProjectRow): ActualTimeTrackingUpload | undefined => {
  if (!row.time_log_upload && row.time_logs.length === 0) return undefined;
  return {
    fileName: row.time_log_upload?.file_name ?? undefined,
    uploadedAt: row.time_log_upload?.uploaded_at ?? undefined,
    logs: row.time_logs.map((log) => ({
      id: log.id,
      date: log.date,
      employeeName: log.employee_name,
      hours: log.hours,
      projectNameRef: log.project_name_ref ?? undefined,
    })),
  };
};

const mapMember = (row: ProjectMemberRow): TeamMember => {
  const type = MEMBER_TYPE_FROM_DB[row.team_member.member_type];
  const member: TeamMember = {
    name: row.team_member.name,
    company: row.team_member.company ?? undefined,
    role: row.role ?? '',
    internalMemberType: row.team_member.internal_member_type ?? undefined,
    contact: row.team_member.contact,
    type,
    task: row.task ?? undefined,
    active: row.active,
  };

  if (type === 'Interno') {
    member.internalCostInfo = {
      hourlyRate: row.rate?.hourly_rate ?? row.team_member.default_hourly_rate ?? 0,
      workRanges: row.work_ranges.map(mapWorkRange),
    };
  }

  if (type === 'Externo' && row.collaborator_agreement) {
    const agreement = row.collaborator_agreement;
    member.collaboratorInfo = {
      agreement: {
        amount: agreement.amount ?? 0,
        contractUrl: agreement.contract_url ?? '',
      },
      additionals: row.collaborator_additionals.map((a) => ({
        description: a.description,
        amount: a.amount,
        url: a.url ?? undefined,
      })),
      plannedInvoices: row.collaborator_planned_invoices.map((pi) => ({
        id: pi.id,
        description: pi.description ?? '',
        date: pi.date,
        amount: pi.amount,
        percentage: pi.percentage ?? undefined,
        source: INVOICE_SOURCE_FROM_DB(pi.source),
      })),
      invoices: row.collaborator_payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        date: p.date,
        pdfUrl: p.pdf_url ?? '',
        percentage: p.percentage ?? undefined,
        source: INVOICE_SOURCE_FROM_DB(p.source),
      })),
      partialDeliveries: row.collaborator_partial_deliveries.map(mapCollaboratorPartialDelivery),
      startDate: agreement.start_date ?? undefined,
      endDate: agreement.end_date ?? undefined,
      workReceived: agreement.work_received,
    };
  }

  return member;
};

const mapProject = (row: ProjectRow): Project => ({
  id: row.id,
  code: row.code ?? '',
  name: row.name,
  exportName: row.export_name ?? undefined,
  client: row.client?.name ?? '',
  status: PROJECT_STATUS_FROM_DB[row.status],
  statusDetail: row.status_detail ?? '',
  startDate: row.start_date ?? undefined,
  endDate: row.end_date ?? undefined,
  partialDeliveries: row.partial_deliveries.map(mapPartialDelivery),
  team: row.members.map(mapMember),
  clientInfo: mapClientInfo(row),
  actualTimeTracking: mapActualTimeTracking(row),
  closingEmailSent: row.closing_email_sent,
  technicalContacts: row.contacts.filter((c) => c.contact_group === 'tecnico').map(mapContact),
  economicContacts: row.contacts.filter((c) => c.contact_group === 'economico').map(mapContact),
  generalContact: (() => {
    const gc = row.contacts.find((c) => c.contact_group === 'general');
    return gc ? mapContact(gc) : undefined;
  })(),
});

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select(PROJECT_SELECT);
  if (error) throw error;
  return (data as unknown as ProjectRow[]).map(mapProject);
}

// The SPA's Project type has no managerId field, so this is fetched
// separately (only needed by the Dirección-only executive dashboard).
export async function fetchProjectManagers(): Promise<Record<string, { id: string; name: string }>> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, manager_id, manager:profiles(id, name, email)');
  if (error) throw error;

  const result: Record<string, { id: string; name: string }> = {};
  for (const row of data as unknown as {
    id: string;
    manager_id: string;
    manager: { id: string; name: string | null; email: string } | null;
  }[]) {
    result[row.id] = {
      id: row.manager_id,
      name: row.manager?.name || row.manager?.email || 'Sin asignar',
    };
  }
  return result;
}

export async function fetchCurrentProfile(userId: string): Promise<{
  role: string;
  name: string | null;
  email: string;
  active: boolean;
  theme_preference: string;
} | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, name, email, active, theme_preference')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// The full shared "Recursos" catalog (internal + external), regardless of
// who created each person or which gestor's project they're currently on —
// team_members RLS already grants every gestor read access to all of it, so
// any gestor can reuse a person another gestor already registered. Callers
// that need "unassigned by ME" (e.g. Collaborators.tsx's own-projects view)
// merge this with their own `projects` state; this function doesn't filter
// by assignment at all.
export async function fetchTeamMembersCatalog(): Promise<TeamMember[]> {
  const { data: allMembers, error: allError } = await supabase
    .from('team_members')
    .select('id, contact, name, company, member_type, internal_member_type, default_hourly_rate');
  if (allError) throw allError;

  return ((allMembers ?? []) as TeamMemberRow[]).map((m) => ({
    name: m.name,
    company: m.company ?? undefined,
    role: '',
    internalMemberType: m.internal_member_type ?? undefined,
    contact: m.contact,
    type: MEMBER_TYPE_FROM_DB[m.member_type],
  }));
}

// Shared client directory: every gestor sees every client ever created by
// any gestor (not just their own projects' clients), so "Nuevo Proyecto"
// can reuse an existing client instead of creating a near-duplicate.
export async function fetchClients(): Promise<string[]> {
  const { data, error } = await supabase.from('clients').select('name').order('name');
  if (error) throw error;
  return (data as { name: string }[]).map((row) => row.name);
}

export interface OrphanClient {
  id: string;
  name: string;
}

// Clients the current gestor created that no longer have any project
// attached (e.g. a project got edited to a different client, or deleted).
// Runs through a security-definer RPC since checking "zero projects" needs
// to see across every gestor's projects, not just the ones visible to me
// under projects_select RLS -- see my_orphan_clients() in the migration.
export async function fetchMyOrphanClients(): Promise<OrphanClient[]> {
  const { data, error } = await supabase.rpc('my_orphan_clients');
  if (error) throw error;
  return (data ?? []) as OrphanClient[];
}

export async function fetchInternalRates(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('team_members')
    .select('contact, default_hourly_rate')
    .not('default_hourly_rate', 'is', null);
  if (error) throw error;
  const rates: Record<string, number> = {};
  for (const row of data as { contact: string; default_hourly_rate: number }[]) {
    rates[row.contact] = row.default_hourly_rate;
  }
  return rates;
}
