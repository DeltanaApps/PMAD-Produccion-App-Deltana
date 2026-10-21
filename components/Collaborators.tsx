
import React, { useState, useMemo } from 'react';
import type { Project, TeamMember, CollaboratorInfo } from '../types';
import { MemberType } from '../types';
import Card from './ui/Card';
import { CalendarIcon, EyeIcon, LinkIcon, FileTextIcon } from './ui/Icons';
import CollaboratorFinancialsModal from './CollaboratorFinancialsModal';

interface CollaboratorsProps {
  projects: Project[];
  onSaveFinancials: (projectId: string, memberContact: string, financialInfo: CollaboratorInfo) => void;
  onRemoveFromProject: (projectId: string, memberContact: string) => boolean;
  onUpdateCollaboratorName: (contact: string, newName: string) => void;
  projectManagers?: Record<string, { id: string; name: string }>;
  readOnly?: boolean;
}

const formatEuro = (amount: number) => (
    <span className="font-mono flex items-center gap-0.5">
      {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}
      <span className="text-xs text-gray-500">€</span>
    </span>
);

interface DetailModalData {
    title: string;
    type: 'AGREED' | 'BILLED' | 'PLANNED';
    info: CollaboratorInfo;
}

const DetailModal: React.FC<{ data: DetailModalData; onClose: () => void }> = ({ data, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
             <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{data.title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {data.type === 'AGREED' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded border border-gray-700/50">
                                <div>
                                    <p className="text-sm font-medium text-white">Acuerdo Base</p>
                                    <p className="text-xs text-gray-400">Contrato Principal</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-mono">{formatEuro(data.info.agreement.amount)}</p>
                                    {data.info.agreement.contractUrl && (
                                        <a href={data.info.agreement.contractUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline flex items-center justify-end gap-1 mt-1">
                                            <LinkIcon className="w-3 h-3" /> Ver Contrato
                                        </a>
                                    )}
                                </div>
                            </div>
                            
                            {data.info.additionals.length > 0 && (
                                <div>
                                    <p className="text-xs uppercase text-gray-500 font-bold mb-2">Adicionales / Extras</p>
                                    <div className="space-y-2">
                                        {data.info.additionals.map((add, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-gray-700/20 rounded border-l-2 border-purple-500">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="text-sm text-gray-300 truncate" title={add.description}>{add.description}</p>
                                                    {add.url && (
                                                        <a href={add.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-purple-400 hover:underline flex items-center gap-1 mt-0.5">
                                                            <LinkIcon className="w-3 h-3" /> Ver Acuerdo Extra
                                                        </a>
                                                    )}
                                                </div>
                                                <span className="text-sm text-white font-mono">{formatEuro(add.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                                <span className="font-bold text-white">Total Acordado</span>
                                <span className="font-bold text-xl text-sky-400">
                                    {formatEuro(data.info.agreement.amount + data.info.additionals.reduce((acc, curr) => acc + curr.amount, 0))}
                                </span>
                            </div>
                        </div>
                    )}

                    {data.type === 'BILLED' && (
                        <div className="space-y-3">
                             {data.info.invoices.length === 0 ? (
                                 <p className="text-gray-500 text-center py-4">No hay facturas registradas.</p>
                             ) : (
                                 data.info.invoices.map((inv, idx) => (
                                     <div key={idx} className="flex justify-between items-center p-3 bg-gray-700/30 rounded border border-gray-700/50 hover:bg-gray-700/50 transition-colors">
                                         <div>
                                             <div className="flex flex-wrap items-center gap-2">
                                                 <span className="text-sm font-bold text-white">{inv.id || 'S/N'}</span>
                                                 {inv.date && <span className="text-xs text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">{inv.date}</span>}
                                                 <span className="text-[11px] px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/60 text-sky-300 font-medium">
                                                     {inv.source || 'Acuerdo Principal'}
                                                 </span>
                                                 {inv.percentage !== undefined && inv.percentage > 0 && (
                                                     <span className="text-xs text-gray-400 font-mono">({inv.percentage}%)</span>
                                                 )}
                                             </div>
                                             {inv.pdfUrl ? (
                                                 <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:underline flex items-center gap-1 mt-1">
                                                     <FileTextIcon className="w-3 h-3" /> Ver Factura PDF
                                                 </a>
                                             ) : <span className="text-[10px] text-gray-600 italic">Sin PDF adjunto</span>}
                                         </div>
                                         <span className="font-mono text-green-400 font-medium">{formatEuro(inv.amount)}</span>
                                     </div>
                                 ))
                             )}
                             
                             <div className="border-t border-gray-700 pt-3 flex justify-between items-center mt-4">
                                <span className="font-bold text-white">Total Facturado</span>
                                <span className="font-bold text-xl text-green-400">
                                    {formatEuro(data.info.invoices.reduce((acc, curr) => acc + curr.amount, 0))}
                                </span>
                            </div>
                        </div>
                    )}

                    {data.type === 'PLANNED' && (
                        <div className="space-y-3">
                             {(!data.info.plannedInvoices || data.info.plannedInvoices.length === 0) ? (
                                 <p className="text-gray-500 text-center py-4">No hay facturas previstas registradas.</p>
                             ) : (
                                 data.info.plannedInvoices.map((inv, idx) => (
                                     <div key={idx} className="flex justify-between items-center p-3 bg-gray-700/30 rounded border border-gray-700/50 hover:bg-gray-700/50 transition-colors">
                                         <div>
                                             <div className="flex flex-wrap items-center gap-2">
                                                 <span className="text-sm font-bold text-white">{inv.description || 'S/N'}</span>
                                                 {inv.date && <span className="text-xs text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">{inv.date}</span>}
                                                 <span className="text-[11px] px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/60 text-sky-300 font-medium">
                                                     {inv.source || 'Acuerdo Principal'}
                                                 </span>
                                                 {inv.percentage !== undefined && inv.percentage > 0 && (
                                                     <span className="text-xs text-gray-400 font-mono">({inv.percentage}%)</span>
                                                 )}
                                             </div>
                                         </div>
                                         <span className="font-mono text-sky-400 font-medium">{formatEuro(inv.amount)}</span>
                                     </div>
                                 ))
                             )}
                             
                             <div className="border-t border-gray-700 pt-3 flex justify-between items-center mt-4">
                                <span className="font-bold text-white">Total Previsto</span>
                                <span className="font-bold text-xl text-sky-400">
                                    {formatEuro((data.info.plannedInvoices || []).reduce((acc, curr) => acc + curr.amount, 0))}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
};

const ProjectCollaboratorCard: React.FC<{ project: Project; collaborator: TeamMember, onEdit: () => void; onViewDetails: (type: 'AGREED' | 'BILLED' | 'PLANNED') => void; readOnly?: boolean; }> = ({ project, collaborator, onEdit, onViewDetails, readOnly }) => {
    
    // Financial Calculations
    const info = collaborator.collaboratorInfo;
    const baseAmount = info?.agreement.amount || 0;
    const extrasAmount = info?.additionals.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    const totalAgreed = baseAmount + extrasAmount;
    
    const totalBilled = info?.invoices.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    const totalPlanned = info?.plannedInvoices?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    const pending = totalAgreed - totalBilled;
    
    const paidPercentage = totalAgreed > 0 ? (totalBilled / totalAgreed) * 100 : 0;
    const clampedPercentage = Math.min(100, Math.max(0, paidPercentage));

    // Time Calculations
    let daysRemainingColor = "text-gray-400";
    let statusText = "Sin fecha fin";

    if (info?.endDate) {
        const today = new Date();
        const end = new Date(info.endDate);
        const diffTime = end.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (info.workReceived) {
            statusText = "Trabajo Entregado";
            daysRemainingColor = "text-green-500";
        } else if (diffDays < 0) {
            statusText = `${Math.abs(diffDays)} días de retraso`;
            daysRemainingColor = "text-red-500 font-bold";
        } else if (diffDays === 0) {
            statusText = "Entrega Hoy";
            daysRemainingColor = "text-orange-500 font-bold";
        } else {
            statusText = `${diffDays} días restantes`;
            if (diffDays <= 7) daysRemainingColor = "text-orange-400";
            else daysRemainingColor = "text-sky-400";
        }
    } else if (info?.workReceived) {
        statusText = "Trabajo Entregado";
        daysRemainingColor = "text-green-500";
    }

    return (
        <Card className="mb-4 border border-gray-700/50 hover:border-gray-600 transition-colors">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                  <span className="block text-xs font-mono text-gray-400 mb-1">{project.code}</span>
                  <h3 className="text-lg font-bold text-sky-400">{project.name}</h3>
              </div>
              {!readOnly && (
                <button onClick={onEdit} className="text-xs bg-gray-700 hover:bg-gray-600 text-white font-medium py-1.5 px-3 rounded-lg transition-colors border border-gray-600">
                  {info ? 'Editar Gestión' : 'Configurar Gestión'}
                </button>
              )}
            </div>

            {info ? (
              <div className="space-y-5">
                
                {/* 1. Financial Grid */}
                <div className="grid grid-cols-4 gap-2 text-sm bg-gray-900/40 p-3 rounded-lg border border-gray-700/30">
                    <div className="flex flex-col relative group">
                        <div className="flex justify-between items-center pr-1">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Acordado Total</span>
                            <button onClick={() => onViewDetails('AGREED')} className="text-gray-500 hover:text-sky-400 transition-colors" title="Ver desglose y contratos">
                                <EyeIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <span className="text-white font-semibold text-base">{formatEuro(totalAgreed)}</span>
                        {extrasAmount > 0 && <span className="text-[9px] text-purple-400">Incl. {formatEuro(extrasAmount)} extras</span>}
                    </div>

                    <div className="flex flex-col border-l border-gray-700/50 pl-3">
                        <div className="flex justify-between items-center pr-1">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Previsto</span>
                            <button onClick={() => onViewDetails('PLANNED')} className="text-gray-500 hover:text-sky-400 transition-colors" title="Ver facturas previstas">
                                <CalendarIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <span className="text-sky-400 font-semibold text-base">{formatEuro(totalPlanned)}</span>
                        <span className="text-[9px] text-gray-500">{(info.plannedInvoices || []).length} previsiones</span>
                    </div>
                    
                    <div className="flex flex-col border-l border-gray-700/50 pl-3">
                        <div className="flex justify-between items-center pr-1">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Facturado</span>
                            <button onClick={() => onViewDetails('BILLED')} className="text-gray-500 hover:text-green-400 transition-colors" title="Ver lista de facturas">
                                <FileTextIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <span className="text-green-400 font-semibold text-base">{formatEuro(totalBilled)}</span>
                        <span className="text-[9px] text-gray-500">{info.invoices.length} facturas</span>
                    </div>
                    
                    <div className="flex flex-col border-l border-gray-700/50 pl-3">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide">Pendiente Pago</span>
                        <span className="text-red-400 font-semibold text-base">{formatEuro(pending)}</span>
                    </div>
                </div>

                {/* 2. Progress Bar */}
                <div className="space-y-1">
                     <div className="flex justify-between text-xs text-gray-400">
                        <span>Progreso de Pagos</span>
                        <span>{paidPercentage.toFixed(0)}%</span>
                     </div>
                     <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${paidPercentage >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-sky-500 to-sky-400'}`} 
                            style={{ width: `${clampedPercentage}%` }}
                        ></div>
                     </div>
                </div>

                {/* 3. Timeline & Dates */}
                <div className="flex items-center justify-between text-sm bg-gray-800/50 p-2 rounded border border-gray-700/30">
                    <div className="flex items-center gap-2 text-gray-300">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <div className="flex flex-col leading-tight">
                            <span className="text-[10px] text-gray-500 uppercase">Periodo</span>
                            <span>{info.startDate || '?'} <span className="text-gray-600 mx-1">➜</span> {info.endDate || '?'}</span>
                        </div>
                    </div>
                    <div className={`text-right font-medium ${daysRemainingColor} bg-gray-900 px-2 py-1 rounded text-xs border border-gray-700`}>
                        {statusText}
                    </div>
                </div>

                {/* 4. Partial Deliveries / Milestones */}
                {info.partialDeliveries && info.partialDeliveries.length > 0 && (
                     <div className="pt-2 border-t border-gray-700/30">
                        <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Hitos / Entregas Parciales</h4>
                        <div className="space-y-1">
                            {info.partialDeliveries.map((pd, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs bg-gray-900/30 px-2 py-1.5 rounded">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded border flex items-center justify-center ${pd.completed ? 'bg-green-500/20 border-green-500 text-green-500' : 'border-gray-600'}`}>
                                            {pd.completed && <span className="text-[8px]">✓</span>}
                                        </div>
                                        <span className={`text-gray-300 ${pd.completed ? 'line-through text-gray-500' : ''}`}>{pd.description}</span>
                                    </div>
                                    <span className="font-mono text-gray-500">{pd.date}</span>
                                </div>
                            ))}
                        </div>
                     </div>
                )}
              </div>
            ) : (
                <div className="p-4 bg-gray-800/50 rounded-lg text-center border-t border-gray-700/50 border-dashed">
                    <p className="text-sm text-gray-500 italic">No se ha configurado información económica para este recurso externo en este proyecto.</p>
                </div>
            )}
        </Card>
    );
}

const Collaborators: React.FC<CollaboratorsProps> = ({ projects, onSaveFinancials, onRemoveFromProject, onUpdateCollaboratorName, projectManagers, readOnly }) => {
  const [selectedCollaborator, setSelectedCollaborator] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [financialsModalData, setFinancialsModalData] = useState<{ project: Project; collaborator: TeamMember } | null>(null);
  const [detailModalData, setDetailModalData] = useState<DetailModalData | null>(null);
  const [managerFilter, setManagerFilter] = useState<string>('all');

  const managerOptions = useMemo(() => {
    if (!projectManagers) return [];
    const seen = new Map<string, string>();
    projects.forEach(p => {
      const m = projectManagers[p.id];
      if (m && !seen.has(m.id)) seen.set(m.id, m.name);
    });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects, projectManagers]);

  const filteredProjects = useMemo(() => {
    if (managerFilter === 'all') return projects;
    return projects.filter(p => projectManagers?.[p.id]?.id === managerFilter);
  }, [projects, projectManagers, managerFilter]);

  // Only externals the logged-in gestor actually has on one of their own
  // (visible) projects -- the full shared catalog (including ones with zero
  // projects, or assigned to another gestor) lives in "Recursos" instead.
  const collaborators = useMemo(() => {
    const collaboratorMap = new Map<string, { member: TeamMember, projects: Project[] }>();
    filteredProjects.forEach(project => {
      project.team.forEach(member => {
        if (member.type === MemberType.External) {
          if (!collaboratorMap.has(member.contact)) {
            collaboratorMap.set(member.contact, { member, projects: [] });
          }
          collaboratorMap.get(member.contact)!.projects.push(project);
        }
      });
    });

    return Array.from(collaboratorMap.values()).sort((a,b) => a.member.name.localeCompare(b.member.name));
  }, [filteredProjects]);

  if (collaborators.length > 0 && (!selectedCollaborator || !collaborators.some(c => c.member.contact === selectedCollaborator))) {
      setSelectedCollaborator(collaborators[0].member.contact);
  } else if (collaborators.length === 0 && selectedCollaborator) {
      setSelectedCollaborator(null);
  }
  
  const selectedData = collaborators.find(c => c.member.contact === selectedCollaborator);

  const handleSave = (financialInfo: CollaboratorInfo) => {
    if (financialsModalData) {
        onSaveFinancials(financialsModalData.project.id, financialsModalData.collaborator.contact, financialInfo);
        setFinancialsModalData(null);
    }
  };

  const handleRemove = () => {
    if (financialsModalData) {
        const removed = onRemoveFromProject(financialsModalData.project.id, financialsModalData.collaborator.contact);
        if (removed) {
            setFinancialsModalData(null);
        }
    }
  };

  const handleViewDetails = (collaborator: TeamMember, type: 'AGREED' | 'BILLED' | 'PLANNED') => {
      if (!collaborator.collaboratorInfo) return;
      
      setDetailModalData({
          title: type === 'AGREED' ? 'Desglose del Acuerdo' : type === 'BILLED' ? 'Historial de Facturación' : 'Facturas Previstas',
          type,
          info: collaborator.collaboratorInfo
      });
  };

  const handleStartEditName = () => {
    if (selectedData) {
      setEditNameValue(selectedData.member.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = () => {
    if (selectedCollaborator && editNameValue.trim()) {
      onUpdateCollaboratorName(selectedCollaborator, editNameValue.trim());
      setIsEditingName(false);
    }
  };

  return (
    <>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Gestión de Recursos Externos</h1>
          <div className="flex items-center gap-3">
            {managerOptions.length > 0 && (
              <select
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                title="Filtrar por gestor"
              >
                <option value="all">Todos los gestores</option>
                {managerOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <aside className="md:col-span-1">
            <Card className="p-4 sticky top-6 max-h-[85vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-3 text-white border-b border-gray-700 pb-2">Recursos Externos</h2>
              <ul className="space-y-1">
                {collaborators.map(({ member, projects }) => (
                  <li key={member.contact}>
                    <button 
                      onClick={() => setSelectedCollaborator(member.contact)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm flex justify-between items-center ${
                        selectedCollaborator === member.contact
                          ? 'bg-gradient-to-r from-sky-600 to-sky-700 text-white font-bold shadow-md transform scale-105' 
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      }`}
                    >
                      <span className="truncate">{member.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedCollaborator === member.contact ? 'bg-sky-800 text-sky-100' : 'bg-gray-700 text-gray-500'}`}>
                        {projects.length}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {collaborators.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No hay recursos externos.</p>}
            </Card>
          </aside>
          
          <main className="md:col-span-3">
             {selectedData && (
                 <div className="animate-fade-in">
                     <div className="flex items-center justify-between mb-6 border-b border-gray-700 pb-4">
                         <div className="flex items-baseline gap-4">
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={editNameValue} 
                                        onChange={(e) => setEditNameValue(e.target.value)}
                                        className="bg-gray-800 border border-sky-500 rounded px-3 py-1 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveName();
                                            if (e.key === 'Escape') setIsEditingName(false);
                                        }}
                                    />
                                    <button onClick={handleSaveName} className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-sm font-bold">Guardar</button>
                                    <button onClick={() => setIsEditingName(false)} className="text-gray-400 hover:text-white px-2 py-1 text-sm">Cancelar</button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-bold text-white">{selectedData.member.name}</h2>
                                    {!readOnly && (
                                        <button
                                            onClick={handleStartEditName}
                                            className="text-gray-500 hover:text-sky-400 p-1 transition-colors"
                                            title="Editar nombre"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    )}
                                </>
                            )}
                            <span className="text-sm text-gray-500">{selectedData.member.role} {selectedData.member.company ? ` - ${selectedData.member.company}` : ''}</span>
                         </div>
                    </div>

                    {selectedData.projects.map(project => {
                        const memberInProject = project.team.find(m => m.contact === selectedData.member.contact);
                        if (!memberInProject) return null;
                        return <ProjectCollaboratorCard 
                                    key={project.id} 
                                    project={project} 
                                    collaborator={memberInProject} 
                                    onEdit={() => setFinancialsModalData({ project, collaborator: memberInProject })}
                                    onViewDetails={(type) => handleViewDetails(memberInProject, type)}
                                    readOnly={readOnly}
                                />
                    })}
                 </div>
             )}
          </main>
        </div>
      </div>
      
      {financialsModalData && (
        <CollaboratorFinancialsModal
            project={financialsModalData.project}
            collaborator={financialsModalData.collaborator}
            onClose={() => setFinancialsModalData(null)}
            onSave={handleSave}
            onRemoveFromProject={handleRemove}
        />
      )}

      {detailModalData && (
          <DetailModal 
            data={detailModalData} 
            onClose={() => setDetailModalData(null)} 
          />
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </>
  );
};

export default Collaborators;
