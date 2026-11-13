import { supabase } from '../supabaseClient';
import type {
  Project,
  TeamMember,
  ClientInfo,
  CollaboratorInfo,
  InternalCostInfo,
} from '../../types';
import { PROJECT_STATUS_TO_DB, MEMBER_TYPE_TO_DB, INVOICE_SOURCE_TO_DB } from '../enumMappers';

// Matching is case-insensitive and trims whitespace so "Pedro@x.com" and
// "pedro@x.com " reuse the same shared catalog row instead of creating a
// near-duplicate person (same spirit as findOrCreateClientId below).
async function findOrCreateTeamMemberId(member: TeamMember): Promise<string> {
  const trimmedContact = member.contact.trim();
  const { data: existing, error: findError } = await supabase
    .from('team_members')
    .select('id')
    .ilike('contact', trimmedContact)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  // Upsert (not insert): when a multi-project fichaje import saves several
  // projects concurrently and a brand-new person appears in more than one
  // of them, two of these calls can race past the select above at the same
  // time. A plain insert would have one of them hit the `contact` unique
  // constraint and throw, aborting that whole project's save. The upsert
  // lets Postgres resolve the race atomically via the same unique index
  // instead, so every project's save still gets back a valid id.
  const { data: created, error: createError } = await supabase
    .from('team_members')
    .upsert(
      {
        contact: trimmedContact,
        name: member.name,
        company: member.company ?? null,
        member_type: MEMBER_TYPE_TO_DB[member.type],
        internal_member_type: member.internalMemberType ?? null,
      },
      { onConflict: 'contact' }
    )
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id;
}

// Resolves a client name to its shared clients.id, creating the row the
// first time any gestor types that name. Matching is case-insensitive so
// "Acme Corp" and "acme corp" reuse the same client instead of creating a
// near-duplicate.
async function findOrCreateClientId(name: string, createdBy: string): Promise<string> {
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
    .insert({ name: trimmed, created_by: createdBy })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id;
}

// Inserts the new rows before removing the old ones (captured by id
// beforehand), instead of deleting first. Previously every "replace all
// rows for this project/member" sync deleted first and inserted after: if
// the insert threw partway (validation, RLS, a dropped connection), the
// table was left empty — real invoices/payments gone with no transaction to
// roll it back. Inserting first means a failed insert leaves the old rows
// untouched; the worst case if the later delete itself fails is duplicate
// rows (visible and fixable), never zero rows.
async function replaceRows(
  table: string,
  fkColumn: string,
  fkValue: string,
  newRows: Record<string, unknown>[]
): Promise<void> {
  const { data: oldRows, error: selectError } = await supabase.from(table).select('id').eq(fkColumn, fkValue);
  if (selectError) throw selectError;
  const oldIds = (oldRows ?? []).map((r) => r.id);

  if (newRows.length > 0) {
    const { error: insertError } = await supabase.from(table).insert(newRows);
    if (insertError) throw insertError;
  }

  if (oldIds.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().in('id', oldIds);
    if (deleteError) throw deleteError;
  }
}

// Additionals need their id to survive a re-save (invoices reference it as
// their "Origen" -- see INVOICE_SOURCE_TO_DB), so this can't reuse
// replaceRows above: that one assumes "new" rows never collide with "old"
// ones, which breaks the moment a kept additional reinserts under the same
// id while its old row is still there. Upsert instead (update kept rows in
// place, insert brand-new ones), then delete whichever old ids didn't come
// back in the new list -- same "never leaves the table empty on a failed
// write" guarantee, just via update-or-insert instead of insert-then-delete.
async function syncAdditionals(
  table: string,
  fkColumn: string,
  fkValue: string,
  additionals: { id?: string; description: string; amount: number; url?: string }[]
): Promise<void> {
  const { data: oldRows, error: selectError } = await supabase.from(table).select('id').eq(fkColumn, fkValue);
  if (selectError) throw selectError;

  const rows = additionals.map((a) => ({
    id: a.id ?? crypto.randomUUID(),
    [fkColumn]: fkValue,
    description: a.description,
    amount: a.amount,
    url: a.url || null,
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(rows);
    if (upsertError) throw upsertError;
  }

  const keptIds = new Set(rows.map((r) => r.id));
  const removedIds = (oldRows ?? []).map((r) => r.id).filter((id) => !keptIds.has(id));
  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().in('id', removedIds);
    if (deleteError) throw deleteError;
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw error;
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

  await replaceRows('project_contacts', 'project_id', projectId, rows);
}

async function syncPartialDeliveries(projectId: string, deliveries: Project['partialDeliveries']): Promise<void> {
  await replaceRows(
    'project_partial_deliveries',
    'project_id',
    projectId,
    (deliveries ?? []).map((d) => ({
      project_id: projectId,
      description: d.description,
      date: d.date,
      completed: d.completed,
    }))
  );
}

// Persists the fichaje import shown in "Gestión de Recursos Internos" --
// this was previously never written to the DB at all (only kept in React
// state), so it looked like it saved but vanished on refresh. Replace-all
// semantics: the caller already computed the correct merged/deduplicated
// set in memory, so we just make the DB match it exactly, including
// clearing both tables when tracking is undefined (the explicit "borrar
// fichajes importados" action).
async function syncActualTimeTracking(projectId: string, tracking: Project['actualTimeTracking']): Promise<void> {
  await replaceRows(
    'project_time_logs',
    'project_id',
    projectId,
    (tracking?.logs ?? []).map((log) => ({
      project_id: projectId,
      date: log.date,
      employee_name: log.employeeName,
      hours: log.hours,
      project_name_ref: log.projectNameRef ?? null,
      description: log.description ?? null,
    }))
  );

  if (tracking) {
    const { error: uploadError } = await supabase.from('project_time_log_uploads').upsert(
      {
        project_id: projectId,
        file_name: tracking.fileName ?? null,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'project_id' }
    );
    if (uploadError) throw uploadError;
  } else {
    const { error: deleteUploadError } = await supabase.from('project_time_log_uploads').delete().eq('project_id', projectId);
    if (deleteUploadError) throw deleteUploadError;
  }
}

async function upsertProjectCore(
  projectId: string,
  isNew: boolean,
  projectData: Omit<Project, 'id'>,
  managerId: string
): Promise<void> {
  const clientId = await findOrCreateClientId(projectData.client, managerId);
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

// Mirrors handleUpdateProjectWithMembers, which InternalTeam uses exclusively:
// every call site there only ever changes `team` and/or `actualTimeTracking`,
// so this only syncs the roster and the fichaje logs — never the project's
// core fields, contacts or partial deliveries (those stay on saveProject's
// full sync). Keeping this narrow is also what lets the 'administrador' role
// write here: the RLS grant for her only needs to cover these two syncs'
// tables (team_members, project_members, project_time_logs,
// project_time_log_uploads), not every project table.
// newGlobalMembers needs no separate handling — syncProjectRoster already
// creates a team_members row for anyone in `team` who doesn't have one yet.
export async function updateProjectWithMembers(updatedProject: Project): Promise<void> {
  await syncProjectRoster(updatedProject.id, updatedProject.team);
  await syncActualTimeTracking(updatedProject.id, updatedProject.actualTimeTracking);
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

  await syncAdditionals('project_client_additionals', 'project_id', projectId, clientInfo.additionals);

  await replaceRows(
    'project_planned_invoices',
    'project_id',
    projectId,
    clientInfo.plannedInvoices.map((pi) => {
      const { source, additionalId } = INVOICE_SOURCE_TO_DB(pi.source, clientInfo.additionals);
      return {
        project_id: projectId,
        description: pi.description,
        date: pi.date,
        amount: pi.amount,
        percentage: pi.percentage ?? null,
        source,
        additional_id: additionalId,
        invoiced: false,
      };
    })
  );

  await replaceRows(
    'project_invoices',
    'project_id',
    projectId,
    clientInfo.invoices.map((inv) => {
      const { source, additionalId } = INVOICE_SOURCE_TO_DB(inv.source, clientInfo.additionals);
      return {
        project_id: projectId,
        amount: inv.amount,
        date: inv.date,
        pdf_url: inv.pdfUrl || null,
        percentage: inv.percentage ?? null,
        source,
        additional_id: additionalId,
        invoice_number: inv.id || null,
      };
    })
  );
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

  await syncAdditionals('collaborator_additionals', 'project_member_id', projectMemberId, financialInfo.additionals);

  await replaceRows(
    'collaborator_partial_deliveries',
    'project_member_id',
    projectMemberId,
    (financialInfo.partialDeliveries ?? []).map((d) => ({
      project_member_id: projectMemberId,
      description: d.description,
      date: d.date,
      completed: d.completed,
    }))
  );

  await replaceRows(
    'collaborator_planned_invoices',
    'project_member_id',
    projectMemberId,
    (financialInfo.plannedInvoices ?? []).map((pi) => {
      const { source, additionalId } = INVOICE_SOURCE_TO_DB(pi.source, financialInfo.additionals);
      return {
        project_member_id: projectMemberId,
        description: pi.description,
        date: pi.date,
        amount: pi.amount,
        percentage: pi.percentage ?? null,
        source,
        additional_id: additionalId,
        invoiced: false,
      };
    })
  );

  await replaceRows(
    'collaborator_payments',
    'project_member_id',
    projectMemberId,
    financialInfo.invoices.map((inv) => {
      const { source, additionalId } = INVOICE_SOURCE_TO_DB(inv.source, financialInfo.additionals);
      return {
        project_member_id: projectMemberId,
        amount: inv.amount,
        date: inv.date,
        pdf_url: inv.pdfUrl || null,
        percentage: inv.percentage ?? null,
        source,
        additional_id: additionalId,
        invoice_number: inv.id || null,
      };
    })
  );
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
