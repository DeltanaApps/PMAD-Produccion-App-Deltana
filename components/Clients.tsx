
import React, { useState, useMemo, useEffect } from 'react';
import { Project, ProjectStatus, InvoiceSource } from '../types';
import Card from './ui/Card';
import { LinkIcon, PlusIcon } from './ui/Icons';

interface ClientsProps {
  projects: Project[];
  onAddClient: () => void;
  onEditFinancials: (project: Project) => void;
  projectManagers?: Record<string, { id: string; name: string }>;
  readOnly?: boolean;
}

const formatEuro = (amount: number) => (
    <span className="font-mono flex items-center justify-end gap-0.5">
      {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}
      <span className="text-xs text-gray-400">€</span>
    </span>
);

interface FinancialTableProps {
  title: string;
  headers: string[];
  data: React.ReactNode[];
  colorClass?: string;
}

const FinancialTable: React.FC<FinancialTableProps> = ({ title, headers, data, colorClass = "text-gray-300" }) => (
  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 h-full flex flex-col">
    <div className="flex justify-between items-center mb-2">
      <h4 className={`font-semibold text-sm uppercase tracking-wide ${colorClass}`}>{title}</h4>
    </div>
    <div className="overflow-x-auto flex-grow">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-700/30 text-gray-400">
          <tr>
            {headers.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-xs uppercase">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {data.map((row, index) => <tr key={index} className="hover:bg-gray-700/30 transition-colors">{row}</tr>)}
        </tbody>
      </table>
      {data.length === 0 && <p className="text-gray-500 text-xs text-center py-4 italic">No hay registros.</p>}
    </div>
  </div>
);

const ProjectFinancialsCard: React.FC<{project: Project; onEdit: () => void; readOnly?: boolean}> = ({ project, onEdit, readOnly }) => {
    
    // Financial Calculations
    // SAFE ACCESS: Use optional chaining and default to empty arrays to handle legacy data
    const baseAgreement = project.clientInfo?.agreement?.amount || 0;
    
    const additionals = project.clientInfo?.additionals || [];
    const totalExtras = additionals.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    const invoices = project.clientInfo?.invoices || [];
    const agreementInvoiced = invoices.filter(i => (i.source || InvoiceSource.Agreement) === InvoiceSource.Agreement).reduce((sum, item) => sum + (item.amount || 0), 0);
    const extrasInvoiced = invoices.filter(i => i.source && i.source !== InvoiceSource.Agreement).reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalInvoiced = agreementInvoiced + extrasInvoiced;
    
    const planned = project.clientInfo?.plannedInvoices || [];
    const totalPlanned = planned.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    const totalBudget = baseAgreement + totalExtras;
    const pendingToInvoice = totalBudget - totalInvoiced;
    const unallocated = totalBudget - totalInvoiced - totalPlanned;
    
    const agreementPercentage = baseAgreement > 0 ? (agreementInvoiced / baseAgreement) * 100 : 0;
    const extrasPercentage = totalExtras > 0 ? (extrasInvoiced / totalExtras) * 100 : 0;

    return (
        <Card className="mb-6 border border-gray-700/50 hover:border-gray-600 transition-colors">
            {/* Project Header Info */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-700">
                <div>
                    <span className="block text-sm font-mono text-gray-400 mb-1">{project.code}</span>
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-white">
                            {project.name}
                        </h3>
                        <div className="flex items-center gap-2">
                           {project.clientInfo?.agreement?.offerUrl && (
                                <a 
                                    href={project.clientInfo.agreement.offerUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center gap-1 text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700 hover:text-sky-400 hover:border-sky-500/50 transition-colors" 
                                    title="Ver Oferta"
                                >
                                   <LinkIcon className="w-3 h-3" />
                                   Oferta
                                </a>
                           )}
                           {project.clientInfo?.agreement?.contractUrl && (
                                <a 
                                    href={project.clientInfo.agreement.contractUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center gap-1 text-[10px] bg-sky-900/40 text-sky-400 px-2 py-0.5 rounded border border-sky-800 hover:text-sky-300 hover:border-sky-600 transition-colors" 
                                    title="Ver Contrato"
                                >
                                   <LinkIcon className="w-3 h-3" />
                                   Contrato
                                </a>
                           )}
                        </div>
                    </div>

                    {/* Contact Info Display */}
                    {(project.generalContact?.name || (project.technicalContacts && project.technicalContacts.length > 0) || (project.economicContacts && project.economicContacts.length > 0)) && (
                        <div className="mt-3 flex flex-wrap gap-y-4 gap-x-8 text-xs text-gray-400 bg-gray-800/30 p-3 rounded border border-gray-700/30 inline-flex">
                            {project.generalContact?.name && (
                                <div className="flex flex-col min-w-[150px]">
                                    <span className="font-bold text-sky-400 uppercase tracking-wider text-[10px] mb-1">Resp. General</span>
                                    <span className="text-white font-medium">{project.generalContact.name}</span>
                                    {project.generalContact.email && <span>{project.generalContact.email}</span>}
                                    {project.generalContact.phone && <span>{project.generalContact.phone}</span>}
                                    {project.generalContact.description && <span className="italic text-gray-500 mt-0.5">{project.generalContact.description}</span>}
                                </div>
                            )}
                            {project.technicalContacts?.map((c, idx) => (
                                <div key={`tech-${idx}`} className="flex flex-col min-w-[150px]">
                                    <span className="font-bold text-sky-500 uppercase tracking-wider text-[10px] mb-1">
                                        Resp. Técnico {project.technicalContacts!.length > 1 ? idx + 1 : ''}
                                    </span>
                                    <span className="text-white font-medium">{c.name}</span>
                                    {c.email && <span>{c.email}</span>}
                                    {c.phone && <span>{c.phone}</span>}
                                    {c.description && <span className="italic text-gray-500 mt-0.5">{c.description}</span>}
                                </div>
                            ))}
                            {project.economicContacts?.map((c, idx) => (
                                <div key={`eco-${idx}`} className="flex flex-col min-w-[150px]">
                                    <span className="font-bold text-green-500 uppercase tracking-wider text-[10px] mb-1">
                                        Resp. Económico {project.economicContacts!.length > 1 ? idx + 1 : ''}
                                    </span>
                                    <span className="text-white font-medium">{c.name}</span>
                                    {c.email && <span>{c.email}</span>}
                                    {c.phone && <span>{c.phone}</span>}
                                    {c.description && <span className="italic text-gray-500 mt-0.5">{c.description}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {!readOnly && (
                    <button
                        onClick={onEdit}
                        className="mt-3 sm:mt-0 bg-sky-600/90 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm transition-colors shadow-lg shadow-sky-900/20 font-medium"
                    >
                        {project.clientInfo ? 'Gestionar Económicos' : 'Inicializar Económicos'}
                    </button>
                )}
            </div>

            {/* Financial Info */}
            {!project.clientInfo ? (
                <div className="bg-gray-800/50 rounded-lg p-6 text-center border-t border-gray-700/50 border-dashed">
                    <p className="text-gray-400">No hay información financiera registrada para este contrato.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    
                    {/* Summary Block */}
                    <div className="bg-gray-900/40 p-5 rounded-xl border border-gray-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center md:text-left">
                            
                            {/* Breakdown */}
                            <div className="flex flex-col justify-center space-y-1">
                                <span className="text-xs text-gray-500 uppercase tracking-wider">Desglose</span>
                                <div className="text-sm text-gray-300 flex justify-between md:justify-start gap-4 border-b border-gray-700 pb-1 border-dashed">
                                    <span>Base:</span>
                                    <span className="font-mono">{formatEuro(baseAgreement)}</span>
                                </div>
                                <div className="text-sm text-purple-300 flex justify-between md:justify-start gap-4">
                                    <span>Extras:</span>
                                    <span className="font-mono">+{formatEuro(totalExtras)}</span>
                                </div>
                            </div>

                            {/* Total Target */}
                            <div className="flex flex-col justify-center items-center border-l border-gray-700/50">
                                <span className="text-xs text-sky-400 uppercase tracking-wider font-bold mb-1">Total Presupuesto</span>
                                <span className="text-2xl font-bold text-white">{formatEuro(totalBudget)}</span>
                            </div>

                            {/* Planned Status */}
                            <div className="flex flex-col justify-center items-center border-l border-gray-700/50">
                                <span className="text-xs text-orange-400 uppercase tracking-wider font-bold mb-1">Planificado</span>
                                <span className="text-xl font-bold text-orange-400">{formatEuro(totalPlanned)}</span>
                                {Math.abs(unallocated) > 1 && (
                                    <span className="text-[10px] text-gray-500 mt-1">Sin asignar: {formatEuro(unallocated)}</span>
                                )}
                            </div>

                            {/* Pending */}
                            <div className="flex flex-col justify-center items-center md:items-end border-l md:border-l-0 border-gray-700/50">
                                <span className="text-xs text-red-400 uppercase tracking-wider font-bold mb-1">Pendiente Cobro</span>
                                <span className="text-2xl font-bold text-red-400">{formatEuro(pendingToInvoice)}</span>
                                <span className="text-xs text-gray-500 mt-1">Total por facturar</span>
                            </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="mt-6 space-y-4">
                            <div>
                                <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider font-bold">
                                    <span className="text-sky-400">Progreso Acuerdo Principal: {formatEuro(agreementInvoiced)}</span>
                                    <span className="text-gray-400">{agreementPercentage.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-sky-500 h-full transition-all duration-500 ease-out" 
                                        style={{ width: `${Math.min(agreementPercentage, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                            
                            {totalExtras > 0 && (
                                <div>
                                    <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider font-bold">
                                        <span className="text-purple-400">Progreso Extras/Adicionales: {formatEuro(extrasInvoiced)}</span>
                                        <span className="text-gray-400">{extrasPercentage.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className="bg-purple-500 h-full transition-all duration-500 ease-out" 
                                            style={{ width: `${Math.min(extrasPercentage, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Tables Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Planned Invoices Table */}
                        <div className="lg:col-span-1">
                            <FinancialTable 
                                title="Facturas Por Emitir"
                                colorClass="text-orange-400"
                                headers={["Hito / Concepto", "Fecha", "Importe"]}
                                data={planned.map(p => (
                                    <React.Fragment key={p.id}>
                                <td className="px-3 py-2 text-gray-300">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span>{p.description}</span>
                                                    <span className={`text-[8px] px-1 rounded border ${p.source && p.source !== InvoiceSource.Agreement ? 'border-purple-500 text-purple-400' : 'border-sky-500 text-sky-400'}`}>
                                                        {p.source && p.source !== InvoiceSource.Agreement ? (p.source.toUpperCase()) : 'ACUERDO'}
                                                    </span>
                                                </div>
                                                {p.percentage && <span className="text-[10px] text-gray-500">{p.percentage}%</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-gray-400 text-xs">{p.date}</td>
                                        <td className="px-3 py-2 text-gray-300 text-right font-medium">{formatEuro(p.amount)}</td>
                                    </React.Fragment>
                                ))}
                            />
                        </div>

                        {/* Invoices Table */}
                        <div className="lg:col-span-1">
                            <FinancialTable 
                                title="Facturas Emitidas"
                                colorClass="text-green-400"
                                headers={["Nº / Fecha", "PDF", "Importe"]}
                                data={invoices.map(i => (
                                    <React.Fragment key={i.id}>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-300 font-mono text-xs">{i.id}</span>
                                                    <span className={`text-[8px] px-1 rounded border ${i.source && i.source !== InvoiceSource.Agreement ? 'border-purple-500 text-purple-400' : 'border-sky-500 text-sky-400'}`}>
                                                        {i.source && i.source !== InvoiceSource.Agreement ? (i.source.toUpperCase()) : 'ACUERDO'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500 text-[10px]">{i.date}</span>
                                                    {i.percentage !== undefined && (
                                                        <span className="text-gray-500 text-[10px] font-mono">({i.percentage}%)</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            {i.pdfUrl && (
                                                <a href={i.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                                                    <LinkIcon className="w-4 h-4" />
                                                </a>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-300 text-right">{formatEuro(i.amount)}</td>
                                    </React.Fragment>
                                ))}
                            />
                        </div>

                         {/* Additionals Table */}
                        <div className="lg:col-span-1">
                             <FinancialTable 
                                title="Extras y Adicionales"
                                colorClass="text-purple-400"
                                headers={["Descripción", "Link", "Importe"]}
                                data={additionals.map(a => (
                                    <React.Fragment key={Math.random()}>
                                        <td className="px-3 py-2 text-gray-300 text-xs">{a.description}</td>
                                        <td className="px-3 py-2">
                                            {a.url ? (
                                                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300" title="Ver documento">
                                                    <LinkIcon className="w-4 h-4" />
                                                </a>
                                            ) : <span className="text-gray-600">-</span>}
                                        </td>
                                        <td className="px-3 py-2 text-gray-300 text-right">{formatEuro(a.amount)}</td>
                                    </React.Fragment>
                                ))}
                            />
                        </div>
                    </div>
                </div>
            )}
        </Card>
    )
}

const Clients: React.FC<ClientsProps> = ({ projects, onAddClient, onEditFinancials, projectManagers, readOnly }) => {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
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

  const clients = useMemo(() => {
    const clientMap = projects
      .filter(project => project.status !== ProjectStatus.Proposal)
      .filter(project => managerFilter === 'all' || projectManagers?.[project.id]?.id === managerFilter)
      .reduce((acc, project) => {
        if (!acc[project.client]) {
          acc[project.client] = [];
        }
        acc[project.client].push(project);
        return acc;
      }, {} as Record<string, Project[]>);
    return Object.entries(clientMap).sort((a,b) => a[0].localeCompare(b[0]));
  }, [projects, projectManagers, managerFilter]);

  useEffect(() => {
    if (clients.length > 0 && (selectedClient === null || !clients.some(([name]) => name === selectedClient))) {
        setSelectedClient(clients[0][0]);
    }
  }, [clients, selectedClient]);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">{readOnly ? 'Gestión de Clientes' : 'Mis Clientes'}</h1>
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
          {!readOnly && (
            <button
                onClick={onAddClient}
                className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors shadow-lg shadow-sky-900/30"
              >
                <PlusIcon className="w-5 h-5"/>
                Añadir Cliente (Nuevo Proyecto)
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="md:col-span-1">
          <Card className="p-4 sticky top-6 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4 text-white border-b border-gray-700 pb-2">Cartera de Clientes</h2>
            <ul className="space-y-1">
              {clients.map(([clientName, clientProjects]) => (
                <li key={clientName}>
                  <button 
                    onClick={() => setSelectedClient(clientName)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm flex justify-between items-center ${
                      selectedClient === clientName 
                        ? 'bg-gradient-to-r from-sky-600 to-sky-700 text-white font-bold shadow-md transform scale-105' 
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`}
                  >
                    <span className="truncate mr-2">{clientName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedClient === clientName ? 'bg-sky-800 text-sky-100' : 'bg-gray-700 text-gray-500'}`}>
                        {clientProjects.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
             {clients.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No hay clientes activos.</p>}
          </Card>
        </aside>
        
        <main className="md:col-span-3 pb-10">
            {selectedClient && (
                <div className="animate-fade-in">
                    <div className="flex items-baseline gap-4 mb-6 border-b border-gray-700 pb-2">
                         <h2 className="text-2xl font-bold text-white">{selectedClient}</h2>
                         <span className="text-sm text-gray-500">{clients.find(([name]) => name === selectedClient)?.[1].length} Proyectos</span>
                    </div>
                    
                    {clients.find(([name]) => name === selectedClient)?.[1]
                     .map(project => (
                        <ProjectFinancialsCard
                            key={project.id}
                            project={project}
                            onEdit={() => onEditFinancials(project)}
                            readOnly={readOnly}
                        />
                     ))
                    }
                </div>
            )}
        </main>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Clients;
