import { supabase } from '../supabaseClient';
import type {
  Project,
  TeamMember,
  ClientInfo,
  CollaboratorInfo,
  InternalCostInfo,
} from '../../types';
import { PROJECT_STATUS_TO_DB, MEMBER_TYPE_TO_DB, INVOICE_SOURCE_TO_DB } from '../enumMappers';

async function findOrCreateTeamMemberId(member: TeamMember): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('team_members')
    .select('id')
    .eq('contact', member.contact)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('team_members')
    .insert({
      contact: member.contact,
      name: member.name,
      company: member.company ?? null,
      member_type: MEMBER_TYPE_TO_DB[member.type],
      internal_member_type: member.internalMemberType ?? null,
    })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id;
}

// Resolves a client name to its shared clients.id, creating the row the
// first time any gestor types that name. Matching is case-insensitive so
// "Acme Corp" and "acme corp" reuse the same client instead of creating a
// near-duplicate.
async function findOrCreateClientId(name: string): Promise<string> {
  const trimmed = name.trim();
  const { data: existing, error: findError } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', trimmed)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('clients')
    .insert({ name: trimmed })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id;
}

async function findProjectMemberId(projectId: string, contact: string): Promise<string> {
  const { data: teamMember, error: tmError } = await supabase
    .from('team_members')
    .select('id')
    .eq('contact', contact)
    .single();
  if (tmError) throw tmError;

  const { data: pm, error: pmError } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('team_member_id', teamMember.id)
    .single();
  if (pmError) throw pmError;
  return pm.id;
}

// Reconciles project_members against the submitted team[] array: creates
// any brand-new team_members, upserts each roster row (role/task/active),
// and removes rows for people dropped from the team (cascades their
// financial data, matching the original "just filter them out" behaviour).
async function syncProjectRoster(projectId: string, team: TeamMember[]): Promise<void> {
  const { data: existingRows, error: existingError } = await supabase
    .from('project_members')
    .select('id, team_member_id')
    .eq('project_id', projectId);
  if (existingError) throw existingError;

  const keptTeamMemberIds = new Set<string>();

  for (const member of team) {
    const teamMemberId = await findOrCreateTeamMemberId(member);
    keptTeamMemberIds.add(teamMemberId);

    const { error: upsertError } = await supabase
      .from('project_members')
      .upsert(
        {
          project_id: projectId,
          team_member_id: teamMemberId,
          role: member.role ?? null,
          task: member.task ?? null,
          active: member.active ?? true,
        },
        { onConflict: 'project_id,team_member_id' }
      );
    if (upsertError) throw upsertError;
  }

  const removedIds = (existingRows ?? [])
    .filter((r) => !keptTeamMemberIds.has(r.team_member_id))
    .map((r) => r.id);
  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase.from('project_members').delete().in('id', removedIds);
    if (deleteError) throw deleteError;
  }
}

async function syncProjectContacts(
  projectId: string,
  project: Pick<Project, 'technicalContacts' | 'economicContacts' | 'generalContact'>
): Promise<void> {
  const { error: deleteError } = await supabase.from('project_contacts').delete().eq('project_id', projectId);
  if (deleteError) throw deleteError;

  const rows = [
    ...(project.technicalContacts ?? []).map((c) => ({ ...c, contact_group: 'tecnico' as const })),
    ...(project.economicContacts ?? []).map((c) => ({ ...c, contact_group: 'economico' as const })),
    ...(project.generalContact && project.generalContact.name
      ? [{ ...project.generalContact, contact_group: 'general' as const }]
      : []),
  ].map((c) => ({
    project_id: projectId,
    contact_group: c.contact_group,
    name: c.name,
    email: c.email || null,
    phone: c.phone || null,
    description: c.description || null,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('project_contacts').insert(rows);
    if (insertError) throw insertError;
  }
}

async function syncPartialDeliveries(projectId: string, deliveries: Project['partialDeliveries']): Promise<void> {
  const { error: deleteError } = await supabase
    .from('project_partial_deliveries')
    .delete()
    .eq('project_id', projectId);
  if (deleteError) throw deleteError;

  if (deliveries && deliveries.length > 0) {
    const { error: insertError } = await supabase.from('project_partial_deliveries').insert(
      deliveries.map((d) => ({
        project_id: projectId,
        description: d.description,
        date: d.date,
        completed: d.completed,
      }))
    );
    if (insertError) throw insertError;
  }
}

async function upsertProjectCore(
  projectId: string,
  isNew: boolean,
  projectData: Omit<Project, 'id'>,
  managerId: string
): Promise<void> {
  const clientId = await findOrCreateClientId(projectData.client);
  const row = {
    code: projectData.code,
    name: projectData.name,
    export_name: projectData.exportName ?? null,
    client_id: clientId,
    status: PROJECT_STATUS_TO_DB[projectData.status],
    status_detail: projectData.statusDetail,
    start_date: projectData.startDate || null,
    end_date: projectData.endDate || null,
    closing_email_sent: projectData.closingEmailSent ?? false,
  };

  if (!isNew) {
    const { error } = await supabase.from('projects').update(row).eq('id', projectId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('projects').insert({ id: projectId, ...row, manager_id: managerId });
  if (error) throw error;
}

// Mirrors handleSaveProject: full create/update of a project's core fields,
// contacts, partial deliveries and team roster. Client financials and each
// member's internal/collaborator financials are handled by their own
// dedicated functions below (same split as the original modals). `projectId`
// is generated client-side (crypto.randomUUID()) by the caller for new
// projects, same spirit as the original `proj-${Date.now()}` local id.
export async function saveProject(
  projectId: string,
  isNew: boolean,
  projectData: Omit<Project, 'id'>,
  managerId: string
): Promise<void> {
  await upsertProjectCore(projectId, isNew, projectData, managerId);
  await syncProjectContacts(projectId, projectData);
  await syncPartialDeliveries(projectId, projectData.partialDeliveries);
  await syncProjectRoster(projectId, projectData.team);
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

// Mirrors handleUpdateProjectWithMembers: same full sync as saveProject.
// newGlobalMembers needs no separate handling — syncProjectRoster already
// creates a team_members row for anyone in `team` who doesn't have one yet.
export async function updateProjectWithMembers(updatedProject: Project): Promise<void> {
  await upsertProjectCore(updatedProject.id, false, updatedProject, '');
  await syncProjectContacts(updatedProject.id, updatedProject);
  await syncPartialDeliveries(updatedProject.id, updatedProject.partialDeliveries);
  await syncProjectRoster(updatedProject.id, updatedProject.team);
}

export async function saveClientFinancials(projectId: string, clientInfo: ClientInfo): Promise<void> {
  const { error: agreementError } = await supabase.from('project_client_agreement').upsert(
    {
      project_id: projectId,
      amount: clientInfo.agreement.amount,
      offer_url: clientInfo.agreement.offerUrl || null,
      contract_url: clientInfo.agreement.contractUrl || null,
    },
    { onConflict: 'project_id' }
  );
  if (agreementError) throw agreementError;

  await supabase.from('project_client_additionals').delete().eq('project_id', projectId);
  if (clientInfo.additionals.length > 0) {
    const { error } = await supabase.from('project_client_additionals').insert(
      clientInfo.additionals.map((a) => ({
        project_id: projectId,
        description: a.description,
        amount: a.amount,
        url: a.url || null,
      }))
    );
    if (error) throw error;
  }

  await supabase.from('project_planned_invoices').delete().eq('project_id', projectId);
  if (clientInfo.plannedInvoices.length > 0) {
    const { error } = await supabase.from('project_planned_invoices').insert(
      clientInfo.plannedInvoices.map((pi) => ({
        project_id: projectId,
        description: pi.description,
        date: pi.date,
        amount: pi.amount,
        percentage: pi.percentage ?? null,
        source: INVOICE_SOURCE_TO_DB(pi.source),
        invoiced: false,
      }))
    );
    if (error) throw error;
  }

  await supabase.from('project_invoices').delete().eq('project_id', projectId);
  if (clientInfo.invoices.length > 0) {
    const { error } = await supabase.from('project_invoices').insert(
      clientInfo.invoices.map((inv) => ({
        project_id: projectId,
        amount: inv.amount,
        date: inv.date,
        pdf_url: inv.pdfUrl || null,
        percentage: inv.percentage ?? null,
        source: INVOICE_SOURCE_TO_DB(inv.source),
      }))
    );
    if (error) throw error;
  }
}

export async function removeCollaboratorFromProject(projectId: string, memberContact: string): Promise<void> {
  const projectMemberId = await findProjectMemberId(projectId, memberContact);
  const { error } = await supabase.from('project_members').delete().eq('id', projectMemberId);
  if (error) throw error;
}

export async function saveCollaboratorFinancials(
  projectId: string,
  memberContact: string,
  financialInfo: CollaboratorInfo | null
): Promise<void> {
  const projectMemberId = await findProjectMemberId(projectId, memberContact);

  if (!financialInfo) {
    await Promise.all([
      supabase.from('collaborator_agreements').delete().eq('project_member_id', projectMemberId),
      supabase.from('collaborator_additionals').delete().eq('project_member_id', projectMemberId),
      supabase.from('collaborator_partial_deliveries').delete().eq('project_member_id', projectMemberId),
      supabase.from('collaborator_planned_invoices').delete().eq('project_member_id', projectMemberId),
      supabase.from('collaborator_payments').delete().eq('project_member_id', projectMemberId),
    ]);
    return;
  }

  const { error: agreementError } = await supabase.from('collaborator_agreements').upsert(
    {
      project_member_id: projectMemberId,
      amount: financialInfo.agreement.amount,
      contract_url: financialInfo.agreement.contractUrl || null,
      start_date: financialInfo.startDate || null,
      end_date: financialInfo.endDate || null,
      work_received: financialInfo.workReceived ?? false,
    },
    { onConflict: 'project_member_id' }
  );
  if (agreementError) throw agreementError;

  await supabase.from('collaborator_additionals').delete().eq('project_member_id', projectMemberId);
  if (financialInfo.additionals.length > 0) {
    const { error } = await supabase.from('collaborator_additionals').insert(
      financialInfo.additionals.map((a) => ({
        project_member_id: projectMemberId,
        description: a.description,
        amount: a.amount,
        url: a.url || null,
      }))
    );
    if (error) throw error;
  }

  await supabase.from('collaborator_partial_deliveries').delete().eq('project_member_id', projectMemberId);
  if (financialInfo.partialDeliveries && financialInfo.partialDeliveries.length > 0) {
    const { error } = await supabase.from('collaborator_partial_deliveries').insert(
      financialInfo.partialDeliveries.map((d) => ({
        project_member_id: projectMemberId,
        description: d.description,
        date: d.date,
        completed: d.completed,
      }))
    );
    if (error) throw error;
  }

  await supabase.from('collaborator_planned_invoices').delete().eq('project_member_id', projectMemberId);
  if (financialInfo.plannedInvoices && financialInfo.plannedInvoices.length > 0) {
    const { error } = await supabase.from('collaborator_planned_invoices').insert(
      financialInfo.plannedInvoices.map((pi) => ({
        project_member_id: projectMemberId,
        description: pi.description,
        date: pi.date,
        amount: pi.amount,
        percentage: pi.percentage ?? null,
        source: INVOICE_SOURCE_TO_DB(pi.source),
        invoiced: false,
      }))
    );
    if (error) throw error;
  }

  await supabase.from('collaborator_payments').delete().eq('project_member_id', projectMemberId);
  if (financialInfo.invoices.length > 0) {
    const { error } = await supabase.from('collaborator_payments').insert(
      financialInfo.invoices.map((inv) => ({
        project_member_id: projectMemberId,
        amount: inv.amount,
        date: inv.date,
        pdf_url: inv.pdfUrl || null,
        percentage: inv.percentage ?? null,
        source: INVOICE_SOURCE_TO_DB(inv.source),
      }))
    );
    if (error) throw error;
  }
}

export async function saveInternalFinancials(
  projectId: string,
  memberContact: string,
  costInfo: InternalCostInfo
): Promise<void> {
  const projectMemberId = await findProjectMemberId(projectId, memberContact);

  const { error: rateError } = await supabase
    .from('project_member_rates')
    .upsert({ project_member_id: projectMemberId, hourly_rate: costInfo.hourlyRate }, { onConflict: 'project_member_id' });
  if (rateError) throw rateError;

  await supabase.from('internal_work_ranges').delete().eq('project_member_id', projectMemberId);

  for (const range of costInfo.workRanges) {
    const { data: created, error: rangeError } = await supabase
      .from('internal_work_ranges')
      .insert({
        project_member_id: projectMemberId,
        task_name: range.taskName,
        start_date: range.startDate,
        end_date: range.endDate,
        dedication_percentage: range.dedicationPercentage,
        holidays_count: range.holidaysCount,
        manual_hours: range.manualHours ?? null,
      })
      .select('id')
      .single();
    if (rangeError) throw rangeError;

    if (range.partialDeliveries && range.partialDeliveries.length > 0) {
      const { error: deliveriesError } = await supabase.from('internal_work_range_deliveries').insert(
        range.partialDeliveries.map((d) => ({
          work_range_id: created.id,
          description: d.description,
          date: d.date,
          completed: d.completed,
        }))
      );
      if (deliveriesError) throw deliveriesError;
    }
  }
}
