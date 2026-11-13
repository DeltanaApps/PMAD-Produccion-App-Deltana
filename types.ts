
export enum ProjectStatus {
  InProgress = 'En proceso',
  Completed = 'Finalizado',
  Proposal = 'Propuesta',
}

export enum InvoiceSource {
  Agreement = 'Acuerdo',
  Additionals = 'Adicionales',
}

export enum MemberType {
  Internal = 'Interno',
  External = 'Externo',
}

export interface Agreement {
  amount: number;
  offerUrl: string;
  contractUrl?: string;
}

export interface Additional {
  id?: string; // stable DB id, used as the "Origen" reference from invoices -- not a display field
  description: string;
  amount: number;
  url?: string;
}

export interface PlannedInvoice {
  id: string;
  description: string;
  date: string; // Planned date
  amount: number;
  percentage?: number; // Optional helper for UI
  source?: InvoiceSource | string;
}

export interface Invoice {
  id: string;
  amount: number;
  date: string;
  pdfUrl: string;
  percentage?: number;
  source?: InvoiceSource | string;
}

export interface ClientInfo {
  agreement: Agreement;
  additionals: Additional[];
  plannedInvoices: PlannedInvoice[]; // New field for planned billing
  invoices: Invoice[];
}

export interface CollaboratorAgreement {
    amount: number;
    contractUrl: string;
}
  
export interface CollaboratorAdditional {
    id?: string; // stable DB id, used as the "Origen" reference from invoices -- not a display field
    description: string;
    amount: number;
    url?: string; // Link to the agreement of this additional
}

export interface ReceivedInvoice {
    id: string;
    amount: number;
    date: string;
    pdfUrl: string;
    percentage?: number;
    source?: InvoiceSource | string;
}

export interface CollaboratorPartialDelivery {
    id: string;
    description: string;
    date: string;
    completed: boolean;
}
  
export interface CollaboratorInfo {
    agreement: CollaboratorAgreement;
    additionals: CollaboratorAdditional[];
    plannedInvoices?: PlannedInvoice[]; // New field for planned billing
    invoices: ReceivedInvoice[];
    partialDeliveries?: CollaboratorPartialDelivery[]; // Specific milestones for the collaborator
    startDate?: string;
    endDate?: string;
    workReceived?: boolean;
}

export interface PartialDelivery {
    id: string;
    description: string;
    date: string;
    completed: boolean;
}

// NEW: Internal Cost Tracking based on Ranges
export interface InternalWorkRange {
    id: string;
    taskName: string;
    startDate: string;
    endDate: string;
    dedicationPercentage: number; // 0 to 100
    holidaysCount: number; // Number of non-working days in this range to exclude
    manualHours?: number; // Override calculated hours directly
    partialDeliveries?: PartialDelivery[]; // Specific deadlines for this internal task
}

export interface InternalCostInfo {
    hourlyRate: number; // Coste hora empresa para este empleado en este proyecto
    workRanges: InternalWorkRange[]; // Replaces hoursLogs
}

export interface TeamMember {
  name: string;
  company?: string;
  role: string;
  internalMemberType?: string; // Producción España, Producción Colombia, etc.
  contact: string;
  type: MemberType;
  task?: string;
  collaboratorInfo?: CollaboratorInfo; // For External
  internalCostInfo?: InternalCostInfo; // For Internal
  active?: boolean; // true = working now, false = finished task in this project
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  description?: string;
}

// Actual Time Tracking (Fichajes Excel / CSV)
export interface ActualTimeLog {
  id: string;
  date: string; // YYYY-MM-DD
  employeeName: string; // Col C: Empleado
  hours: number; // Col D: Cantidad (positive or negative)
  projectNameRef?: string; // Col A: Nombre de proyecto (referencial)
  description?: string; // Col E: Descripción
}

export interface ActualTimeTrackingUpload {
  fileName?: string;
  uploadedAt?: string;
  logs: ActualTimeLog[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  exportName?: string;
  client: string;
  status: ProjectStatus;
  statusDetail: string;
  startDate?: string;
  endDate?: string;
  partialDeliveries?: PartialDelivery[];
  team: TeamMember[];
  clientInfo?: ClientInfo;
  actualTimeTracking?: ActualTimeTrackingUpload; // Logged actual hours from time tracking Excel/CSV
  closingEmailSent?: boolean; // New field check
  technicalContacts?: ContactInfo[];
  economicContacts?: ContactInfo[];
  generalContact?: ContactInfo;
}

export type View = 'dashboard' | 'projects' | 'team' | 'clients' | 'collaborators' | 'internal-team' | 'planning' | 'economic-tracking' | 'executive-dashboard' | 'administration';
