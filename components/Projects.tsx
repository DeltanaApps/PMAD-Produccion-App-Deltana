
import React, { useState, useMemo } from 'react';
import type { Project, InternalWorkRange } from '../types';
import { ProjectStatus, MemberType } from '../types';
import ProjectCard from './ProjectCard';
import { PlusIcon, MoneyIcon } from './ui/Icons';
import Card from './ui/Card';

interface ProjectsProps {
  projects: Project[];
  internalRates: Record<string, number>;
  onAddProject: () => void;
  onEditProject: (project: Project) => void;
  onViewProject?: (project: Project) => void;
  projectManagers?: Record<string, { id: string; name: string }>;
  readOnly?: boolean;
}

type ProjectTab = ProjectStatus | 'all';

// --- HELPER FUNCTIONS FOR CALCULATIONS (Synchronized with InternalTeam.tsx) ---

// Parse date string (YYYY-MM-DD) to Local Date object
const parseDateLocal = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d); // Months are 0-indexed in JS
};

const getBusinessDays = (startDate: string, endDate: string): number => {
    const start = parseDateLocal(startDate);
    const end = parseDateLocal(endDate);
    
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const dayOfWeek = cur.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
            count++;
        }
        cur.setDate(cur.getDate() + 1);
    }
    return count;
};

const calculateRangeHours = (range: InternalWorkRange): number => {
    // If manual hours are set, use them
    if (range.manualHours !== undefined && range.manualHours !== null && range.manualHours > 0) {
        return range.manualHours;
    }
    // Otherwise calculate based on business days and percentage
    const businessDays = getBusinessDays(range.startDate, range.endDate);
    const actualWorkDays = Math.max(0, businessDays - (range.holidaysCount || 0));
    const capacity = actualWorkDays * 8;
    return capacity * (range.dedicationPercentage / 100);
};

const calculateTotalHours = (ranges: InternalWorkRange[]): number => {
    return ranges.reduce((acc, range) => acc + calculateRangeHours(range), 0);
};

const formatEuro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);


const Projects: React.FC<ProjectsProps> = ({ projects, internalRates, onAddProject, onEditProject, onViewProject, projectManagers, readOnly }) => {
  const [activeTab, setActiveTab] = useState<ProjectTab>(ProjectStatus.InProgress);
  const [managerFilter, setManagerFilter] = useState<string>('all');

  const TABS: { id: ProjectTab; label: string }[] = [
    { id: ProjectStatus.InProgress, label: 'En Proceso' },
    { id: ProjectStatus.Completed, label: 'Finalizados' },
    { id: ProjectStatus.Proposal, label: 'Propuestas' },
  ];

  const managerOptions = useMemo(() => {
    if (!projectManagers) return [];
    const seen = new Map<string, string>();
    projects.forEach(p => {
      const m = projectManagers[p.id];
      if (m && !seen.has(m.id)) seen.set(m.id, m.name);
    });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects, projectManagers]);

  const filteredProjects = projects
    .filter(p => p.status === activeTab)
    .filter(p => managerFilter === 'all' || projectManagers?.[p.id]?.id === managerFilter);

  const getTabClass = (tabId: ProjectTab) => {
    return activeTab === tabId
      ? 'bg-sky-600 text-white'
      : 'text-gray-400 hover:bg-gray-700 hover:text-white';
  };

  // --- FINANCIAL SUMMARY LOGIC FOR COMPLETED PROJECTS ---
  const completedFinancials = useMemo(() => {
    if (activeTab !== ProjectStatus.Completed) return null;

    let totalIncome = 0;
    let totalInternalCost = 0;
    let totalExternalCost = 0;

    const details = filteredProjects.map(p => {
        // 1. Income (Client)
        const incomeBase = p.clientInfo?.agreement.amount || 0;
        const incomeExtras = p.clientInfo?.additionals.reduce((sum, item) => sum + item.amount, 0) || 0;
        const projectIncome = incomeBase + incomeExtras;

        // 2. External Costs (Collaborators)
        let projectExternalCost = 0;
        p.team.forEach(m => {
            if (m.type === MemberType.External && m.collaboratorInfo) {
                const agree = m.collaboratorInfo.agreement.amount || 0;
                const extras = m.collaboratorInfo.additionals.reduce((s, i) => s + i.amount, 0) || 0;
                projectExternalCost += (agree + extras);
            }
        });

        // 3. Internal Costs (Team)
        let projectInternalCost = 0;
        p.team.forEach(m => {
            if (m.type === MemberType.Internal) {
                const info = m.internalCostInfo;
                // Use specific rate if > 0, otherwise use global rate from props
                const rate = (info && info.hourlyRate > 0) ? info.hourlyRate : (internalRates[m.contact] || 0);
                const hours = calculateTotalHours(info?.workRanges || []);
                projectInternalCost += (hours * rate);
            }
        });

        const totalCost = projectExternalCost + projectInternalCost;
        const profit = projectIncome - totalCost;
        const margin = projectIncome > 0 ? (profit / projectIncome) * 100 : 0;
        const isTargetMet = margin >= 50; // Target is 50% profit margin

        totalIncome += projectIncome;
        totalInternalCost += projectInternalCost;
        totalExternalCost += projectExternalCost;

        return {
            id: p.id,
            name: p.name,
            code: p.code,
            income: projectIncome,
            internalCost: projectInternalCost,
            externalCost: projectExternalCost,
            totalCost,
            profit,
            margin,
            isTargetMet
        };
    });

    const globalProfit = totalIncome - (totalInternalCost + totalExternalCost);
    // This is intrinsically a weighted margin because it divides Total Profit by Total Income.
    // Projects with higher income contribute more to both the denominator and the numerator.
    const globalMargin = totalIncome > 0 ? (globalProfit / totalIncome) * 100 : 0;

    return {
        totalIncome,
        totalInternalCost,
        totalExternalCost,
        globalProfit,
        globalMargin,
        details
    };

  }, [projects, activeTab, internalRates, filteredProjects]);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Proyectos</h1>
        <div className="flex items-center gap-4">
          <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${getTabClass(tab.id)}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {managerOptions.length > 0 && (
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
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
              onClick={onAddProject}
              className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5"/>
              Añadir Proyecto
            </button>
          )}
        </div>
      </div>

      {/* --- SUMMARY SECTION FOR COMPLETED PROJECTS --- */}
      {activeTab === ProjectStatus.Completed && completedFinancials && (
          <div className="mb-10 space-y-6 animate-fade-in">
              <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.3s ease-out; }`}</style>
              
              {/* High Level Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <Card className="bg-gray-800 border-l-4 border-sky-500">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Ingresos Totales</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatEuro(completedFinancials.totalIncome)}</p>
                   </Card>
                   <Card className="bg-gray-800 border-l-4 border-purple-500">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Gastos Recursos Internos</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatEuro(completedFinancials.totalInternalCost)}</p>
                   </Card>
                   <Card className="bg-gray-800 border-l-4 border-pink-500">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Pagos Colaboradores</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatEuro(completedFinancials.totalExternalCost)}</p>
                   </Card>
                   <Card className={`bg-gray-800 border-l-4 ${completedFinancials.globalMargin >= 50 ? 'border-green-500' : 'border-orange-500'}`}>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Rentabilidad Global (Ponderada)</p>
                        <div className="flex items-end gap-2">
                             <p className={`text-2xl font-bold ${completedFinancials.globalMargin >= 50 ? 'text-green-400' : 'text-orange-400'} mt-1`}>
                                 {completedFinancials.globalMargin.toFixed(1)}%
                             </p>
                             <span className="text-xs text-gray-500 mb-1">Objetivo: 50%</span>
                        </div>
                   </Card>
              </div>

              {/* Detailed Table */}
              <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                  <div className="px-6 py-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center gap-2">
                          <MoneyIcon className="text-green-400"/>
                          Desglose de Rentabilidad por Proyecto
                      </h3>
                      <span className="text-xs text-gray-500 italic">Ordenado por fecha de finalización (implícito)</span>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-400">
                          <thead className="text-xs text-gray-500 uppercase bg-gray-700/50">
                              <tr>
                                  <th className="px-6 py-3">Proyecto</th>
                                  <th className="px-6 py-3 text-right text-sky-400">Ingresos</th>
                                  <th className="px-6 py-3 text-right text-purple-400">Coste Interno</th>
                                  <th className="px-6 py-3 text-right text-pink-400">Coste Externo</th>
                                  <th className="px-6 py-3 text-right text-white">Beneficio</th>
                                  <th className="px-6 py-3 text-center">Margen</th>
                              </tr>
                          </thead>
                          <tbody>
                              {completedFinancials.details.map((p) => (
                                  <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                                      <td className="px-6 py-3">
                                          <div className="font-bold text-white">{p.name}</div>
                                          <div className="text-xs font-mono text-gray-500">{p.code}</div>
                                      </td>
                                      <td className="px-6 py-3 text-right font-medium">{formatEuro(p.income)}</td>
                                      <td className="px-6 py-3 text-right">{formatEuro(p.internalCost)}</td>
                                      <td className="px-6 py-3 text-right">{formatEuro(p.externalCost)}</td>
                                      <td className="px-6 py-3 text-right font-bold text-gray-200">{formatEuro(p.profit)}</td>
                                      <td className="px-6 py-3 text-center">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                              p.isTargetMet ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'
                                          }`}>
                                              {p.margin.toFixed(1)}%
                                          </span>
                                      </td>
                                  </tr>
                              ))}
                              {completedFinancials.details.length === 0 && (
                                  <tr><td colSpan={6} className="text-center py-6 text-gray-500">No hay proyectos finalizados con datos económicos.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} onEdit={onEditProject} onView={onViewProject} readOnly={readOnly} />
          ))
        ) : (
          <p className="text-gray-400 col-span-full text-center py-10">No hay proyectos en esta categoría.</p>
        )}
      </div>
    </div>
  );
};

export default Projects;
