
import React, { useMemo, useState, useEffect } from 'react';
import type { Project, TeamMember } from '../types';
import { ProjectStatus, MemberType } from '../types';
import Card from './ui/Card';
import { PencilIcon } from './ui/Icons';

interface TeamMemberModalProps {
  member: TeamMember & { projects: any[] }; // Using loose type here to avoid complex re-mapping, filtering is done based on projects list
  projects: Project[];
  internalRate?: number;
  onUpdateRate?: (rate: number) => void;
  onUpdateMemberType?: (type: string) => void;
  onUpdateMemberName?: (newName: string) => void;
  onUpdateMemberContact?: (newContact: string) => Promise<void>;
  onClose: () => void;
}

const statusBadgeStyles = {
    [ProjectStatus.InProgress]: 'bg-sky-500/20 text-sky-300',
    [ProjectStatus.Completed]: 'bg-green-500/20 text-green-300',
    [ProjectStatus.Proposal]: 'bg-orange-500/20 text-orange-300',
};

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);


const TeamMemberModal: React.FC<TeamMemberModalProps> = ({ member, projects, internalRate, onUpdateRate, onUpdateMemberType, onUpdateMemberName, onUpdateMemberContact, onClose }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(member.name);

  useEffect(() => {
    setNameValue(member.name);
  }, [member.name]);

  const handleSaveName = () => {
    if (nameValue.trim() && onUpdateMemberName) {
      onUpdateMemberName(nameValue.trim());
      setIsEditingName(false);
    }
  };

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactValue, setContactValue] = useState(member.contact);
  const [contactError, setContactError] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);

  useEffect(() => {
    setContactValue(member.contact);
  }, [member.contact]);

  const cancelEditContact = () => {
    setContactValue(member.contact);
    setContactError(null);
    setIsEditingContact(false);
  };

  const handleSaveContact = async () => {
    const trimmed = contactValue.trim();
    if (!onUpdateMemberContact || !trimmed) return;
    if (trimmed === member.contact) {
      setIsEditingContact(false);
      return;
    }
    setIsSavingContact(true);
    setContactError(null);
    try {
      await onUpdateMemberContact(trimmed);
      setIsEditingContact(false);
    } catch (err: any) {
      setContactError(
        err?.code === '23505'
          ? 'Ya existe otro recurso con ese correo electrónico.'
          : 'No se pudo guardar el cambio.'
      );
    } finally {
      setIsSavingContact(false);
    }
  };

  const memberProjects = useMemo(() => {
    // Find all project objects that this member is part of
    const involvedProjects = projects.filter(p => p.team.some(t => t.contact === member.contact));
    
    // Sort them
    return {
        activeWork: involvedProjects.filter(p => {
             const teamMember = p.team.find(t => t.contact === member.contact);
             // Active if Project is NOT completed AND Member is Active
             return p.status !== ProjectStatus.Completed && teamMember?.active !== false;
        }),
        inactiveWork: involvedProjects.filter(p => {
             const teamMember = p.team.find(t => t.contact === member.contact);
             // Inactive if Project IS Completed OR Member is NOT Active
             return p.status === ProjectStatus.Completed || teamMember?.active === false;
        })
    }
  }, [member, projects]);

  const renderProjectList = (title: string, projectList: Project[], isHistorical: boolean = false) => {
    if (projectList.length === 0) return null;
    return (
        <div className="mb-6">
            <h4 className="font-semibold text-gray-300 mb-2">{title} ({projectList.length})</h4>
            <ul className="space-y-2">
                {projectList.map(p => {
                    const teamMember = p.team.find(t => t.contact === member.contact);
                    const memberIsInactive = teamMember?.active === false;

                    return (
                        <li key={p.id} className={`text-sm bg-gray-900 p-3 rounded-md flex flex-col gap-1 transition-colors hover:bg-gray-700/50 ${memberIsInactive && p.status !== ProjectStatus.Completed ? 'border border-gray-700 opacity-75' : ''}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="block text-xs font-mono text-gray-500 mb-0.5">{p.code}</span>
                                    <span className={`font-medium ${isHistorical ? 'text-gray-500' : 'text-gray-200'}`}>{p.name}</span>
                                </div>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${statusBadgeStyles[p.status]}`}>
                                    {p.status}
                                </span>
                            </div>
                            {memberIsInactive && p.status !== ProjectStatus.Completed && (
                                <span className="text-xs text-orange-400 italic">Participación Finalizada (Proyecto en curso)</span>
                            )}
                            {p.status === ProjectStatus.Completed && (
                                <span className="text-xs text-gray-500">Proyecto Finalizado</span>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    );
  }

  return (
    <div
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in"
    >
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
      <Card 
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
                <div className="h-16 w-16 flex-shrink-0 bg-sky-500 rounded-full flex items-center justify-center font-bold text-white text-2xl">
                    {member.name.split(' ').map(n=>n[0]).join('')}
                </div>
                <div>
                    {isEditingName ? (
                        <div className="flex items-center gap-2 mb-1">
                            <input 
                                type="text" 
                                value={nameValue} 
                                onChange={(e) => setNameValue(e.target.value)}
                                className="bg-gray-900 border border-sky-500 rounded px-2.5 py-1 text-white text-xl font-bold focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveName();
                                    if (e.key === 'Escape') {
                                        setNameValue(member.name);
                                        setIsEditingName(false);
                                    }
                                }}
                            />
                            <button 
                                onClick={handleSaveName}
                                className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded text-xs font-semibold"
                            >
                                Guardar
                            </button>
                            <button 
                                onClick={() => {
                                    setNameValue(member.name);
                                    setIsEditingName(false);
                                }}
                                className="text-gray-400 hover:text-white text-xs px-2 py-1"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold text-white">{member.name}</h2>
                            {onUpdateMemberName && (
                                <button 
                                    onClick={() => {
                                        setNameValue(member.name);
                                        setIsEditingName(true);
                                    }}
                                    className="text-gray-400 hover:text-sky-400 transition-colors p-1"
                                    title="Modificar nombre"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                    {member.company && <p className="text-md text-gray-400">{member.company}</p>}
                    
                    {/* Internal Member Type Selector */}
                    {member.type === MemberType.Internal && onUpdateRate && (
                        <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-sky-400 font-semibold uppercase">Tipo:</label>
                            <select 
                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white focus:ring-1 focus:ring-sky-500 text-sm"
                                value={member.internalMemberType || ''}
                                onChange={(e) => onUpdateMemberType?.(e.target.value)}
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

                    <p className="text-md text-gray-400">{member.role}</p>
                    {isEditingContact ? (
                        <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-2">
                                <input
                                    type="email"
                                    value={contactValue}
                                    onChange={(e) => setContactValue(e.target.value)}
                                    className="bg-gray-900 border border-sky-500 rounded px-2 py-1 text-sm text-sky-300 focus:outline-none"
                                    autoFocus
                                    disabled={isSavingContact}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveContact();
                                        if (e.key === 'Escape') cancelEditContact();
                                    }}
                                />
                                <button
                                    onClick={handleSaveContact}
                                    disabled={isSavingContact}
                                    className="bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded text-xs font-bold disabled:opacity-50"
                                >
                                    {isSavingContact ? '...' : 'Guardar'}
                                </button>
                                <button
                                    onClick={cancelEditContact}
                                    disabled={isSavingContact}
                                    className="text-gray-400 hover:text-white text-xs px-2 py-1"
                                >
                                    Cancelar
                                </button>
                            </div>
                            {contactError && <span className="text-xs text-red-400">{contactError}</span>}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <a href={`mailto:${member.contact}`} className="text-sky-400 hover:underline">{member.contact}</a>
                            {onUpdateMemberContact && (
                                <button
                                    onClick={() => { setContactValue(member.contact); setContactError(null); setIsEditingContact(true); }}
                                    className="text-gray-400 hover:text-sky-400 transition-colors p-1"
                                    title="Modificar correo"
                                >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Internal Rate Input */}
                    {member.type === MemberType.Internal && onUpdateRate && (
                        <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-sky-400 font-semibold uppercase">Tarifa Global:</label>
                            <div className="flex items-center">
                                <input 
                                    type="number" 
                                    min="0"
                                    className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-right text-white focus:ring-1 focus:ring-sky-500 text-sm"
                                    value={internalRate || ''}
                                    placeholder="0"
                                    onChange={(e) => onUpdateRate(parseFloat(e.target.value) || 0)}
                                />
                                <span className="ml-1 text-sm text-gray-400">€/h</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors">
                <CloseIcon className="h-6 w-6" />
            </button>
        </div>
        
        <div className="mt-6 border-t border-gray-700 pt-6">
            <h3 className="text-xl font-bold text-white mb-4">Resumen de Actividad</h3>
            
            {renderProjectList('Proyectos Activos', memberProjects.activeWork)}
            {renderProjectList('Historial / Finalizados', memberProjects.inactiveWork, true)}

            {memberProjects.activeWork.length === 0 && memberProjects.inactiveWork.length === 0 && (
                <p className="text-gray-500 mt-4">Este miembro no está asignado a ningún proyecto.</p>
            )}
        </div>

      </Card>
    </div>
  );
};

export default TeamMemberModal;
