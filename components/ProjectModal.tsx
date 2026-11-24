
import React, { useState, useEffect } from 'react';
import type { Project, TeamMember, PartialDelivery, ClientContact, ProjectContact } from '../types';
import { ProjectStatus, MemberType } from '../types';
import Card from './ui/Card';
import { PlusIcon, TrashIcon } from './ui/Icons';

interface ProjectModalProps {
  project: Project | null;
  availableClients: string[];
  availableTeamMembers: TeamMember[];
  onClose: () => void;
  onSave: (projectData: Omit<Project, 'id'>) => void;
  onDelete?: (projectId: string) => void;
  onFetchClientContacts: (clientName: string) => Promise<ClientContact[]>;
  onCreateClientContact: (
    clientName: string,
    contact: { name: string; email: string; phone: string; description?: string }
  ) => Promise<ClientContact>;
}

const ROLE_LABEL_SUGGESTIONS = ['General', 'Técnico', 'Técnico 1', 'Técnico 2', 'Económico', 'Comercial'];

const NEW_CONTACT_VALUE = '__new__';

// One row of "responsable asignado a este proyecto": either an existing
// client_contacts person (mode 'existing', picked by id) or data for a brand
// new one (mode 'new'), not yet saved to the shared directory until submit.
interface ContactRowState {
  mode: 'existing' | 'new';
  roleLabel: string;
  clientContactId: string;
  newName: string;
  newEmail: string;
  newPhone: string;
  newDescription: string;
}

const emptyContactRow = (): ContactRowState => ({
  mode: 'existing',
  roleLabel: '',
  clientContactId: '',
  newName: '',
  newEmail: '',
  newPhone: '',
  newDescription: '',
});

const contactRowFromProjectContact = (c: ProjectContact): ContactRowState => ({
  mode: 'existing',
  roleLabel: c.roleLabel,
  clientContactId: c.clientContactId,
  newName: '',
  newEmail: '',
  newPhone: '',
  newDescription: '',
});

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

interface InputProps extends React.ComponentPropsWithoutRef<'input'> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, className, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input 
            {...props} 
            className={`w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${className || ''}`}
        />
    </div>
);

const ProjectModal: React.FC<ProjectModalProps> = ({ project, availableClients, availableTeamMembers, onClose, onSave, onDelete, onFetchClientContacts, onCreateClientContact }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [exportName, setExportName] = useState('');
  const [client, setClient] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);
  
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.InProgress);
  const [statusDetail, setStatusDetail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [closingEmailSent, setClosingEmailSent] = useState(false);
  const [profitabilityTarget, setProfitabilityTarget] = useState('');
  const [proposalCode, setProposalCode] = useState('');
  const [proposalEstimateUrl, setProposalEstimateUrl] = useState('');

  // Snapshot of the status this project had when the modal was opened (never
  // changes during this session) so we can detect a Propuesta -> real-status
  // transition and archive the old code exactly once per edit session.
  const originalStatusRef = React.useRef<ProjectStatus | null>(project?.status ?? null);
  const proposalTransitionHandledRef = React.useRef(false);

  // Contact Info State
  const [contactRows, setContactRows] = useState<ContactRowState[]>([]);
  const [clientContactOptions, setClientContactOptions] = useState<ClientContact[]>([]);
  const [savingContacts, setSavingContacts] = useState(false);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [partialDeliveries, setPartialDeliveries] = useState<PartialDelivery[]>([]);
  
  // Team Member Form State
  const [selectedMemberContact, setSelectedMemberContact] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberContact, setNewMemberContact] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberType, setNewMemberType] = useState<MemberType>(MemberType.Internal);
  const [newInternalMemberType, setNewInternalMemberType] = useState('');


  useEffect(() => {
    if (project) {
      setCode(project.code || '');
      setName(project.name);
      setExportName(project.exportName || '');
      setClient(project.client);
      setIsNewClient(false);
      setStatus(project.status);
      setStatusDetail(project.statusDetail);
      setStartDate(project.startDate || '');
      setEndDate(project.endDate || '');
      setTeam(project.team || []);
      setPartialDeliveries(project.partialDeliveries || []);
      setClosingEmailSent(project.closingEmailSent || false);
      setProfitabilityTarget(project.profitabilityTarget !== undefined ? String(project.profitabilityTarget) : '');
      setProposalCode(project.proposalCode || '');
      setProposalEstimateUrl(project.proposalEstimateUrl || '');
      originalStatusRef.current = project.status;
      proposalTransitionHandledRef.current = false;

      // Load Contacts
      setContactRows((project.contacts ?? []).map(contactRowFromProjectContact));

    } else {
      // Reset for new project
      setCode('');
      setName('');
      setExportName('');
      setClient('');
      setIsNewClient(false);
      setStatus(ProjectStatus.Proposal);
      setStatusDetail('');
      setStartDate('');
      setEndDate('');
      setTeam([]);
      setPartialDeliveries([]);
      setClosingEmailSent(false);
      setProfitabilityTarget('');
      setProposalCode('');
      setProposalEstimateUrl('');
      originalStatusRef.current = ProjectStatus.Proposal;
      proposalTransitionHandledRef.current = false;

      // Reset Contacts
      setContactRows([]);
    }
  }, [project]);

  // Loads the picker's options whenever the selected client changes. A
  // brand-new client (still being typed) has nothing to pick from yet.
  useEffect(() => {
    if (!client.trim() || isNewClient) {
      setClientContactOptions([]);
      return;
    }
    let cancelled = false;
    onFetchClientContacts(client)
      .then((options) => { if (!cancelled) setClientContactOptions(options); })
      .catch(() => { if (!cancelled) setClientContactOptions([]); });
    return () => { cancelled = true; };
  }, [client, isNewClient]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as ProjectStatus;
    if (
        originalStatusRef.current === ProjectStatus.Proposal &&
        newStatus !== ProjectStatus.Proposal &&
        !proposalTransitionHandledRef.current
    ) {
        proposalTransitionHandledRef.current = true;
        setProposalCode(prev => prev || code);
        setCode('');
    }
    setStatus(newStatus);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !client.trim() || !code.trim()) {
        const codeLabel = status === ProjectStatus.Proposal ? 'código de propuesta' : 'código de proyecto';
        alert(`El ${codeLabel}, nombre del proyecto y el cliente son obligatorios.`);
        return;
    }
    const trimmedTarget = profitabilityTarget.trim();
    if (trimmedTarget !== '' && (isNaN(Number(trimmedTarget)) || Number(trimmedTarget) < 0 || Number(trimmedTarget) > 100)) {
        alert("El umbral de rentabilidad personalizado debe ser un número entre 0 y 100.");
        return;
    }
    for (const row of contactRows) {
        if (!row.roleLabel.trim()) continue;
        if (row.mode === 'existing' && !row.clientContactId) {
            alert("Hay un responsable sin seleccionar. Elige a la persona o quítala de la lista.");
            return;
        }
        if (row.mode === 'new' && !row.newName.trim()) {
            alert("Hay un responsable nuevo sin nombre. Complétalo o quítalo de la lista.");
            return;
        }
    }

    let resolvedContacts: ProjectContact[];
    try {
        setSavingContacts(true);
        resolvedContacts = await Promise.all(
            contactRows
                .filter((row) => row.roleLabel.trim())
                .map(async (row): Promise<ProjectContact> => {
                    if (row.mode === 'existing') {
                        const opt = clientContactOptions.find((o) => o.id === row.clientContactId);
                        return {
                            clientContactId: row.clientContactId,
                            roleLabel: row.roleLabel.trim(),
                            name: opt?.name ?? '',
                            email: opt?.email ?? '',
                            phone: opt?.phone ?? '',
                            description: opt?.description,
                        };
                    }
                    const created = await onCreateClientContact(client, {
                        name: row.newName.trim(),
                        email: row.newEmail.trim(),
                        phone: row.newPhone.trim(),
                        description: row.newDescription.trim() || undefined,
                    });
                    return {
                        clientContactId: created.id,
                        roleLabel: row.roleLabel.trim(),
                        name: created.name,
                        email: created.email,
                        phone: created.phone,
                        description: created.description,
                    };
                })
        );
    } catch (err) {
        console.error(err);
        alert("No se pudo guardar uno de los responsables nuevos. Inténtalo de nuevo.");
        setSavingContacts(false);
        return;
    }
    setSavingContacts(false);

    onSave({
        code,
        name,
        exportName,
        client,
        status,
        statusDetail,
        startDate,
        endDate,
        partialDeliveries,
        team,
        clientInfo: project?.clientInfo,
        closingEmailSent,
        profitabilityTarget: trimmedTarget === '' ? undefined : Number(trimmedTarget),
        proposalCode: proposalCode.trim() || undefined,
        proposalEstimateUrl: proposalEstimateUrl.trim() || undefined,
        contacts: resolvedContacts,
    });
  };

  // Handlers for Contacts
  const handleAddContactRow = () => setContactRows([...contactRows, emptyContactRow()]);
  const handleRemoveContactRow = (index: number) => setContactRows(contactRows.filter((_, i) => i !== index));
  const handleUpdateContactRow = (index: number, patch: Partial<ContactRowState>) => {
    const updated = [...contactRows];
    updated[index] = { ...updated[index], ...patch };
    setContactRows(updated);
  };
  const handleContactSelect = (index: number, value: string) => {
    if (value === NEW_CONTACT_VALUE) {
        handleUpdateContactRow(index, { mode: 'new', clientContactId: '' });
    } else {
        handleUpdateContactRow(index, { mode: 'existing', clientContactId: value });
    }
  };

  // Handlers for Partial Deliveries
  const handleAddDelivery = () => {
    setPartialDeliveries([...partialDeliveries, { id: `pd-${Date.now()}`, description: '', date: '', completed: false }]);
  };
  const handleUpdateDelivery = (index: number, field: keyof PartialDelivery, value: any) => {
    const updated = [...partialDeliveries];
    updated[index] = { ...updated[index], [field]: value };
    setPartialDeliveries(updated);
  };
  const handleRemoveDelivery = (index: number) => {
    setPartialDeliveries(partialDeliveries.filter((_, i) => i !== index));
  };


  // Handlers for Team Members
  const handleMemberSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const contact = e.target.value;
    setSelectedMemberContact(contact);
    if (contact === 'new') {
        setNewMemberName('');
        setNewMemberContact('');
        setNewMemberRole('');
        setNewMemberType(MemberType.Internal);
    } else {
        const member = availableTeamMembers.find(m => m.contact === contact);
        if (member) {
            setNewMemberName(member.name);
            setNewMemberContact(member.contact);
            setNewMemberRole(member.role); // Pre-fill default role
            setNewMemberType(member.type);
            setNewInternalMemberType(member.internalMemberType || '');
        }
    }
  };

  const handleAddMember = () => {
    if (!newMemberName.trim() || !newMemberContact.trim() || !newMemberRole.trim()) {
        alert("Nombre, contacto y rol son obligatorios.");
        return;
    }
    const newMember: TeamMember = {
        name: newMemberName,
        contact: newMemberContact,
        role: newMemberRole,
        type: newMemberType,
        internalMemberType: newMemberType === MemberType.Internal ? newInternalMemberType : undefined,
        active: true // Default to active when added
    };
    
    // Check for duplicates in current team
    if (team.some(m => m.contact === newMember.contact)) {
        alert("Esta persona ya está asignada a este proyecto.");
        return;
    }

    setTeam([...team, newMember]);
    // Reset form
    setSelectedMemberContact('');
    setNewMemberName('');
    setNewMemberContact('');
    setNewMemberRole('');
    setNewMemberType(MemberType.Internal);
    setNewInternalMemberType('');
  };

  const handleRemoveMember = (contact: string) => {
    setTeam(team.filter(m => m.contact !== contact));
  };

  const handleToggleMemberActive = (contact: string) => {
      setTeam(team.map(m => {
          if (m.contact === contact) {
              return { ...m, active: !m.active };
          }
          return m;
      }));
  }

  return (
    <div
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in"
    >
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
      <Card 
        className="w-full max-w-4xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold text-white">{project ? 'Editar Proyecto' : 'Añadir Nuevo Proyecto'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors">
                <CloseIcon className="h-6 w-6" />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 -mr-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: General Info & Deliveries */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-sky-400 border-b border-gray-700 pb-2">Información General</h3>
                
                <div className="grid grid-cols-3 gap-3">
                     <div className="col-span-1">
                        <Input
                            label={status === ProjectStatus.Proposal ? 'Código de Propuesta' : 'Código de Proyecto'}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="EJ: 25-001"
                            required
                        />
                        {proposalCode && status !== ProjectStatus.Proposal && (
                            <p className="text-[11px] text-gray-500 mt-1">Código de propuesta original: <span className="font-mono text-gray-400">{proposalCode}</span></p>
                        )}
                     </div>
                     <div className="col-span-2">
                         <Input label="Nombre Resumido de Proyecto" value={name} onChange={(e) => setName(e.target.value)} required />
                     </div>
                </div>

                <div>
                    <Input label="Nombre de proyecto para exportar" value={exportName} onChange={(e) => setExportName(e.target.value)} placeholder="Nombre que aparecerá en el Excel" />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
                    {!isNewClient ? (
                        <div className="flex gap-2">
                             <select 
                                value={client} 
                                onChange={(e) => {
                                    if(e.target.value === '__new__') setIsNewClient(true);
                                    else setClient(e.target.value);
                                }} 
                                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            >
                                <option value="">Seleccionar Cliente...</option>
                                {availableClients.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="__new__" className="font-bold text-sky-400">+ Nuevo Cliente</option>
                            </select>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                             <input 
                                value={client} 
                                onChange={(e) => setClient(e.target.value)} 
                                placeholder="Nombre del nuevo cliente"
                                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                autoFocus
                             />
                             <button type="button" onClick={() => { setIsNewClient(false); setClient(''); }} className="text-xs text-gray-400 underline">Cancelar</button>
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
                        <select value={status} onChange={handleStatusChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                            {Object.values(ProjectStatus).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <Input label="Fecha Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <Input label="Fecha Entrega Final" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>

                <div>
                    <Input
                        label="Umbral de Rentabilidad Personalizado (%)"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={profitabilityTarget}
                        onChange={(e) => setProfitabilityTarget(e.target.value)}
                        placeholder="Vacío = usar el objetivo general de la app (50%)"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                        Deja este campo vacío para que el proyecto use el semáforo de rentabilidad general de la aplicación (50%). Rellénalo solo si este proyecto en concreto debe medirse contra otro objetivo.
                    </p>
                </div>

                <div>
                    <Input
                        label="Link Estimación de la Propuesta"
                        value={proposalEstimateUrl}
                        onChange={(e) => setProposalEstimateUrl(e.target.value)}
                        placeholder="https://onedrive..."
                    />
                </div>

                {/* Closing Email Check - Only visible if Completed */}
                {status === ProjectStatus.Completed && (
                    <div className="bg-gray-800 p-3 rounded-lg border border-green-900/50 shadow-sm animate-fade-in">
                        <label className="flex items-center space-x-3 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                checked={closingEmailSent} 
                                onChange={(e) => setClosingEmailSent(e.target.checked)} 
                                className="form-checkbox h-5 w-5 text-sky-600 rounded bg-gray-700 border-gray-500 focus:ring-sky-500" 
                            />
                            <span className="text-sm font-medium text-gray-200">¿Se envió correo de cierre al cliente?</span>
                        </label>
                    </div>
                )}
            
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Observaciones</label>
                    <textarea value={statusDetail} onChange={(e) => setStatusDetail(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"/>
                </div>

                {/* Client Contacts Section */}
                <div className="border-t border-gray-700 pt-4 mt-4">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-sky-400">Responsables del Cliente</h3>
                        <button type="button" onClick={handleAddContactRow} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                            <PlusIcon className="w-3 h-3"/> Añadir responsable
                        </button>
                    </div>

                    <div className="space-y-3">
                        {contactRows.map((row, idx) => (
                            <div key={idx} className="grid grid-cols-1 gap-2 p-3 bg-gray-900/50 rounded border border-gray-800 relative group">
                                <button type="button" onClick={() => handleRemoveContactRow(idx)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TrashIcon className="w-4 h-4" />
                                </button>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Persona</label>
                                    <select
                                        value={row.mode === 'new' ? NEW_CONTACT_VALUE : row.clientContactId}
                                        onChange={(e) => handleContactSelect(idx, e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                    >
                                        <option value="">Seleccionar persona...</option>
                                        {clientContactOptions.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}{c.description ? ` — ${c.description}` : ''}</option>
                                        ))}
                                        <option value={NEW_CONTACT_VALUE} className="font-bold text-sky-400">+ Crear nuevo contacto</option>
                                    </select>
                                </div>

                                {row.mode === 'existing' && row.clientContactId && (() => {
                                    const opt = clientContactOptions.find((o) => o.id === row.clientContactId);
                                    return opt ? (
                                        <div className="text-xs text-gray-400 px-1">
                                            {opt.email && <span className="mr-3">{opt.email}</span>}
                                            {opt.phone && <span>{opt.phone}</span>}
                                        </div>
                                    ) : null;
                                })()}

                                {row.mode === 'new' && (
                                    <div className="grid grid-cols-1 gap-2 pl-3 border-l-2 border-sky-900/50">
                                        <Input label="Nombre" value={row.newName} onChange={(e) => handleUpdateContactRow(idx, { newName: e.target.value })} placeholder="Nombre completo" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input label="Email" value={row.newEmail} onChange={(e) => handleUpdateContactRow(idx, { newEmail: e.target.value })} placeholder="email@cliente.com" />
                                            <Input label="Teléfono" value={row.newPhone} onChange={(e) => handleUpdateContactRow(idx, { newPhone: e.target.value })} placeholder="+34 600..." />
                                        </div>
                                        <Input label="Cargo" value={row.newDescription} onChange={(e) => handleUpdateContactRow(idx, { newDescription: e.target.value })} placeholder="Ej: Director de Infraestructura" />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Responsabilidad en este proyecto</label>
                                    <input
                                        list="role-label-suggestions"
                                        value={row.roleLabel}
                                        onChange={(e) => handleUpdateContactRow(idx, { roleLabel: e.target.value })}
                                        placeholder="Ej: General, Técnico, Económico..."
                                        className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                    />
                                </div>
                            </div>
                        ))}
                        {contactRows.length === 0 && <p className="text-[10px] text-gray-500 italic text-center">No hay responsables añadidos.</p>}
                        <datalist id="role-label-suggestions">
                            {ROLE_LABEL_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                        </datalist>
                    </div>
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4">
                    <div className="flex justify-between items-center mb-2">
                         <h3 className="text-lg font-semibold text-sky-400">Entregas Parciales</h3>
                         <button type="button" onClick={handleAddDelivery} className="text-sm text-sky-400 hover:text-sky-300 flex items-center gap-1"><PlusIcon className="w-4 h-4"/> Añadir</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {partialDeliveries.map((pd, idx) => (
                            <div key={idx} className="flex gap-2 items-center bg-gray-800/50 p-2 rounded">
                                <input type="checkbox" checked={pd.completed} onChange={(e) => handleUpdateDelivery(idx, 'completed', e.target.checked)} className="rounded bg-gray-700 border-gray-600 text-sky-600 focus:ring-sky-500" />
                                <input type="date" value={pd.date} onChange={(e) => handleUpdateDelivery(idx, 'date', e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs w-28 text-white" />
                                <input type="text" value={pd.description} onChange={(e) => handleUpdateDelivery(idx, 'description', e.target.value)} placeholder="Descripción entrega..." className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs flex-1 text-white" />
                                <button type="button" onClick={() => handleRemoveDelivery(idx)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        ))}
                         {partialDeliveries.length === 0 && <p className="text-xs text-gray-500 text-center italic">No hay entregas parciales definidas.</p>}
                    </div>
                </div>
            </div>

            {/* Right Column: Team Management */}
            <div className="space-y-4 flex flex-col">
                <h3 className="text-lg font-semibold text-sky-400 border-b border-gray-700 pb-2">Equipo del Proyecto</h3>
                
                {/* Team List */}
                <div className="flex-1 min-h-[150px] bg-gray-900/30 rounded-lg p-2 overflow-y-auto border border-gray-700/50">
                    {team.map(member => (
                        <div key={member.contact} className={`flex justify-between items-center p-3 mb-2 rounded border transition-colors ${member.active !== false ? 'bg-gray-800 border-gray-700' : 'bg-gray-800/50 border-gray-800 opacity-70'}`}>
                            <div>
                                <div className="flex items-center gap-2">
                                     <p className="font-bold text-white text-sm">{member.name}</p>
                                     {member.active === false && <span className="text-[10px] uppercase bg-gray-700 text-gray-400 px-1 rounded">Finalizado</span>}
                                </div>
                                <p className="text-xs text-gray-400">{member.role} <span className="text-gray-600">|</span> {member.type}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => handleToggleMemberActive(member.contact)} 
                                    className={`text-xs px-2 py-1 rounded transition-colors ${member.active !== false ? 'bg-green-900/50 text-green-400 hover:bg-green-900' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    title={member.active !== false ? "Marcar como finalizado en este proyecto" : "Marcar como activo en este proyecto"}
                                >
                                    {member.active !== false ? 'Activo' : 'Finalizado'}
                                </button>
                                <button type="button" onClick={() => handleRemoveMember(member.contact)} className="p-1 text-red-400 hover:text-red-300">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {team.length === 0 && <p className="text-sm text-gray-500 text-center py-10">No hay miembros asignados.</p>}
                </div>
                
                {/* Add Member Form */}
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-inner">
                    <p className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Asignar Recurso</p>
                    <div className="space-y-3">
                         <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Seleccionar Miembro Existente</label>
                            <select 
                                value={selectedMemberContact} 
                                onChange={handleMemberSelect} 
                                className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            >
                                <option value="">-- Seleccionar --</option>
                                {availableTeamMembers.map(m => (
                                    <option key={m.contact} value={m.contact}>{m.name} ({m.type})</option>
                                ))}
                                <option value="new">+ Añadir Nuevo Manualmente</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                             {/* Only show details input if manually adding or editing loaded details */}
                             <div className="col-span-2">
                                <Input label="Rol en este proyecto" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} placeholder="Ej. Arquitecto Jefe" />
                             </div>
                             {newMemberType === MemberType.Internal && (
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Tipo de Recurso Interno</label>
                                    <select 
                                        value={newInternalMemberType} 
                                        onChange={(e) => setNewInternalMemberType(e.target.value)} 
                                        className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                    >
                                        <option value="">Seleccionar Tipo...</option>
                                        <option value="Producción España">Producción España</option>
                                        <option value="Producción Latinoamérica">Producción Latinoamérica</option>
                                        <option value="Coordinación España">Coordinación España</option>
                                        <option value="Coordinación Latinoamérica">Coordinación Latinoamérica</option>
                                        <option value="Gestión">Gestión</option>
                                    </select>
                                </div>
                             )}
                             {/* Read-only or editable depending on if it's new */}
                             {selectedMemberContact === 'new' && (
                                <>
                                    <Input label="Nombre" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
                                    <Input label="Email" value={newMemberContact} onChange={(e) => setNewMemberContact(e.target.value)} />
                                    <div>
                                         <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                                         <select value={newMemberType} onChange={(e) => setNewMemberType(e.target.value as MemberType)} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                                            {Object.values(MemberType).map(t => <option key={t} value={t}>{t}</option>)}
                                         </select>
                                    </div>
                                </>
                             )}
                        </div>
                        
                        <button type="button" onClick={handleAddMember} className="w-full mt-2 flex justify-center items-center gap-2 bg-sky-600 text-white px-3 py-2 rounded-lg hover:bg-sky-500 transition-colors text-sm font-medium">
                            <PlusIcon className="w-4 h-4"/>
                            Añadir al Equipo
                        </button>
                    </div>
                </div>
            </div>
        </form>

        <div className="pt-6 mt-4 border-t border-gray-700 flex justify-between items-center flex-shrink-0">
            <div>
                {project && project.status === ProjectStatus.Proposal && onDelete && (
                    <button 
                        type="button" 
                        onClick={() => onDelete(project.id)} 
                        className="px-4 py-2 rounded-md bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all font-medium flex items-center gap-2 border border-red-900/50"
                    >
                        <TrashIcon className="w-4 h-4" />
                        Eliminar Propuesta
                    </button>
                )}
            </div>
            <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors font-medium">
                    Cancelar
                </button>
                <button type="submit" onClick={handleSubmit} disabled={savingContacts} className="px-6 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors font-bold shadow-lg shadow-sky-900/50 disabled:opacity-50 disabled:cursor-not-allowed">
                    {savingContacts ? 'Guardando...' : (project ? 'Guardar Cambios' : 'Crear Proyecto')}
                </button>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default ProjectModal;
