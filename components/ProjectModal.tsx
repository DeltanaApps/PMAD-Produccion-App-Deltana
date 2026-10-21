
import React, { useState, useEffect } from 'react';
import type { Project, TeamMember, PartialDelivery, ContactInfo } from '../types';
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
}

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

const ProjectModal: React.FC<ProjectModalProps> = ({ project, availableClients, availableTeamMembers, onClose, onSave, onDelete }) => {
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
  
  // Contact Info State
  const [techContacts, setTechContacts] = useState<ContactInfo[]>([]);
  const [ecoContacts, setEcoContacts] = useState<ContactInfo[]>([]);
  const [generalContact, setGeneralContact] = useState<ContactInfo>({ name: '', email: '', phone: '', description: '' });
  
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
      
      // Load Contacts
      if (project.technicalContacts) {
          setTechContacts(project.technicalContacts);
      } else if ((project as any).technicalContact) {
          const old = (project as any).technicalContact;
          setTechContacts([{ ...old, description: '' }]);
      } else {
          setTechContacts([]);
      }

      if (project.economicContacts) {
          setEcoContacts(project.economicContacts);
      } else if ((project as any).economicContact) {
          const old = (project as any).economicContact;
          setEcoContacts([{ ...old, description: '' }]);
      } else {
          setEcoContacts([]);
      }
      
      setGeneralContact(project.generalContact || { name: '', email: '', phone: '', description: '' });

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
      
      // Reset Contacts
      setTechContacts([]);
      setEcoContacts([]);
      setGeneralContact({ name: '', email: '', phone: '', description: '' });
    }
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !client.trim() || !code.trim()) {
        alert("El código, nombre del proyecto y el cliente son obligatorios.");
        return;
    }
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
        technicalContacts: techContacts,
        economicContacts: ecoContacts,
        generalContact: generalContact
    });
  };
  
  // Handlers for Contacts
  const handleAddTechContact = () => setTechContacts([...techContacts, { name: '', email: '', phone: '', description: '' }]);
  const handleUpdateTechContact = (index: number, field: keyof ContactInfo, value: string) => {
    const updated = [...techContacts];
    updated[index] = { ...updated[index], [field]: value };
    setTechContacts(updated);
  };
  const handleRemoveTechContact = (index: number) => setTechContacts(techContacts.filter((_, i) => i !== index));

  const handleAddEcoContact = () => setEcoContacts([...ecoContacts, { name: '', email: '', phone: '', description: '' }]);
  const handleUpdateEcoContact = (index: number, field: keyof ContactInfo, value: string) => {
    const updated = [...ecoContacts];
    updated[index] = { ...updated[index], [field]: value };
    setEcoContacts(updated);
  };
  const handleRemoveEcoContact = (index: number) => setEcoContacts(ecoContacts.filter((_, i) => i !== index));

  const handleUpdateGeneralContact = (field: keyof ContactInfo, value: string) => {
    setGeneralContact({ ...generalContact, [field]: value });
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
                        <Input label="Código" value={code} onChange={(e) => setCode(e.target.value)} placeholder="EJ: 25-001" required />
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
                        <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                            {Object.values(ProjectStatus).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <Input label="Fecha Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <Input label="Fecha Entrega Final" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
                    <h3 className="text-lg font-semibold text-sky-400 mb-3">Contactos del Cliente</h3>
                    
                    <div className="space-y-6">
                        {/* General Contact */}
                        <div className="bg-gray-800/50 p-3 rounded border border-sky-900/30">
                            <p className="text-xs font-bold text-sky-400 uppercase mb-2">Responsable General (Jefe de Proyecto)</p>
                            <div className="grid grid-cols-1 gap-2">
                                <Input label="Nombre" value={generalContact.name} onChange={(e) => handleUpdateGeneralContact('name', e.target.value)} placeholder="Nombre completo" />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input label="Email" value={generalContact.email} onChange={(e) => handleUpdateGeneralContact('email', e.target.value)} placeholder="email@cliente.com" />
                                    <Input label="Teléfono" value={generalContact.phone} onChange={(e) => handleUpdateGeneralContact('phone', e.target.value)} placeholder="+34 600..." />
                                </div>
                                <Input label="Descripción" value={generalContact.description} onChange={(e) => handleUpdateGeneralContact('description', e.target.value)} placeholder="Ej: Director General de Infraestructura" />
                            </div>
                        </div>

                        {/* Technical Contacts */}
                        <div className="bg-gray-800/50 p-3 rounded border border-gray-700/50">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-bold text-gray-400 uppercase">Responsables Técnicos</p>
                                <button type="button" onClick={handleAddTechContact} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                                    <PlusIcon className="w-3 h-3"/> Añadir
                                </button>
                            </div>
                            <div className="space-y-3">
                                {techContacts.map((c, idx) => (
                                    <div key={idx} className="grid grid-cols-1 gap-2 p-3 bg-gray-900/50 rounded border border-gray-800 relative group">
                                        <button type="button" onClick={() => handleRemoveTechContact(idx)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                        <Input label="Nombre" value={c.name} onChange={(e) => handleUpdateTechContact(idx, 'name', e.target.value)} placeholder="Nombre completo" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input label="Email" value={c.email} onChange={(e) => handleUpdateTechContact(idx, 'email', e.target.value)} placeholder="email@cliente.com" />
                                            <Input label="Teléfono" value={c.phone} onChange={(e) => handleUpdateTechContact(idx, 'phone', e.target.value)} placeholder="+34 600..." />
                                        </div>
                                        <Input label="Descripción / Disciplina" value={c.description} onChange={(e) => handleUpdateTechContact(idx, 'description', e.target.value)} placeholder="Ej: Responsable BoQ / Estructuras" />
                                    </div>
                                ))}
                                {techContacts.length === 0 && <p className="text-[10px] text-gray-500 italic text-center">No hay responsables técnicos añadidos.</p>}
                            </div>
                        </div>

                        {/* Economic Contacts */}
                        <div className="bg-gray-800/50 p-3 rounded border border-gray-700/50">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-bold text-gray-400 uppercase">Responsables Económicos</p>
                                <button type="button" onClick={handleAddEcoContact} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                                    <PlusIcon className="w-3 h-3"/> Añadir
                                </button>
                            </div>
                            <div className="space-y-3">
                                {ecoContacts.map((c, idx) => (
                                    <div key={idx} className="grid grid-cols-1 gap-2 p-3 bg-gray-900/50 rounded border border-gray-800 relative group">
                                        <button type="button" onClick={() => handleRemoveEcoContact(idx)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                        <Input label="Nombre" value={c.name} onChange={(e) => handleUpdateEcoContact(idx, 'name', e.target.value)} placeholder="Nombre completo" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input label="Email" value={c.email} onChange={(e) => handleUpdateEcoContact(idx, 'email', e.target.value)} placeholder="facturacion@cliente.com" />
                                            <Input label="Teléfono" value={c.phone} onChange={(e) => handleUpdateEcoContact(idx, 'phone', e.target.value)} placeholder="+34 600..." />
                                        </div>
                                        <Input label="Descripción" value={c.description} onChange={(e) => handleUpdateEcoContact(idx, 'description', e.target.value)} placeholder="Ej: Responsable de Facturación" />
                                    </div>
                                ))}
                                {ecoContacts.length === 0 && <p className="text-[10px] text-gray-500 italic text-center">No hay responsables económicos añadidos.</p>}
                            </div>
                        </div>
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
                                        <option value="Producción Colombia">Producción Colombia</option>
                                        <option value="Coordinación España">Coordinación España</option>
                                        <option value="Coordinación Colombia">Coordinación Colombia</option>
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
                <button type="submit" onClick={handleSubmit} className="px-6 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors font-bold shadow-lg shadow-sky-900/50">
                    {project ? 'Guardar Cambios' : 'Crear Proyecto'}
                </button>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default ProjectModal;
