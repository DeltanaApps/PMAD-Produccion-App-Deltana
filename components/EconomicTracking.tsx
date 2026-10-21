import React, { useState, useMemo } from 'react';
import type { Project, InternalWorkRange } from '../types';
import { MemberType, ProjectStatus } from '../types';
import { EyeIcon } from './ui/Icons';

interface EconomicTrackingProps {
  projects: Project[];
  globalRates: Record<string, number>;
  projectManagers?: Record<string, { id: string; name: string }>;
}

const formatEuro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(amount);

// --- HELPER FUNCTIONS ---

const parseDateLocal = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
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

const calculateCapacityHours = (startDate: string, endDate: string, holidays: number): number => {
    const businessDays = getBusinessDays(startDate, endDate);
    const actualWorkDays = Math.max(0, businessDays - (holidays || 0));
    return actualWorkDays * 8;
};

const calculateRangeHours = (range: InternalWorkRange): number => {
    if (range.manualHours !== undefined && range.manualHours !== null && range.manualHours > 0) {
        return range.manualHours;
    }
    const capacity = calculateCapacityHours(range.startDate, range.endDate, range.holidaysCount);
    return capacity * (range.dedicationPercentage / 100);
};

// Modal Component
const BreakdownModal: React.FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-gray-800 rounded-xl max-w-2xl w-full border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-lg text-white">{title}</h3>
                <button 
                    onClick={onClose}
                    className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
                >
                    ✕
                </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-gray-300 space-y-4">
                {children}
            </div>
            <div className="p-4 bg-gray-900 border-t border-gray-700 flex justify-end">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors"
                >
                    Cerrar
                </button>
            </div>
        </div>
    </div>
);

const EconomicTracking: React.FC<EconomicTrackingProps> = ({ projects, globalRates, projectManagers }) => {
    const [modalData, setModalData] = useState<{
        type: 'budget' | 'internal-projected' | 'internal-actual' | 'external' | 'target-projected' | 'target-actual',
        project: Project
    } | null>(null);
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

    const projectData = useMemo(() => {
        return projects
            .filter(project => project.status !== ProjectStatus.Proposal)
            .filter(project => managerFilter === 'all' || projectManagers?.[project.id]?.id === managerFilter)
            .map(project => {
            // 1. Total Budget
            const baseBudget = project.clientInfo?.agreement.amount || 0;
            const additionalsBudget = project.clientInfo?.additionals.reduce((acc, curr) => acc + curr.amount, 0) || 0;
            const totalBudget = baseBudget + additionalsBudget;

            // 2. Projected Internal Costs
            let projectedInternalCosts = 0;
            let projectedInternalHours = 0;
            const internalMembers = project.team.filter(m => m.type === MemberType.Internal);
            
            internalMembers.forEach(m => {
                const info = m.internalCostInfo;
                const rate = (info && info.hourlyRate > 0) ? info.hourlyRate : (globalRates[m.contact] || 0);
                const totalMemberHours = (info?.workRanges || []).reduce((hAcc, r) => hAcc + calculateRangeHours(r), 0);
                projectedInternalCosts += (totalMemberHours * rate);
                projectedInternalHours += totalMemberHours;
            });

            // 3. Actual Internal Costs (From imported Excel time tracking)
            let actualInternalCosts = 0;
            let actualInternalHours = 0;
            const actualLogs = project.actualTimeTracking?.logs || [];

            internalMembers.forEach(m => {
                const key = m.name.toLowerCase().trim();
                const mLogs = actualLogs.filter(l => l.employeeName.toLowerCase().trim() === key);
                const mHours = mLogs.reduce((acc, l) => acc + l.hours, 0);
                const info = m.internalCostInfo;
                const rate = (info && info.hourlyRate > 0) ? info.hourlyRate : (globalRates[m.contact] || 0);
                
                actualInternalHours += mHours;
                actualInternalCosts += (mHours * rate);
            });

            // 4. External Costs (Collaborators)
            let externalCosts = 0;
            const externalMembers = project.team.filter(m => m.type === MemberType.External);
            externalMembers.forEach(m => {
                const info = m.collaboratorInfo;
                if (info) {
                    const base = info.agreement.amount || 0;
                    const extras = info.additionals.reduce((acc, curr) => acc + curr.amount, 0) || 0;
                    externalCosts += (base + extras);
                }
            });

            // Projected Profitability
            const projectedTotalCosts = projectedInternalCosts + externalCosts;
            const projectedProfit = totalBudget - projectedTotalCosts;
            const projectedProfitPercentage = totalBudget > 0 ? (projectedProfit / totalBudget) * 100 : 0;

            // Actual Profitability to date
            const actualTotalCosts = actualInternalCosts + externalCosts;
            const actualProfit = totalBudget - actualTotalCosts;
            const actualProfitPercentage = totalBudget > 0 ? (actualProfit / totalBudget) * 100 : 0;

            return {
                project,
                totalBudget,
                baseBudget,
                additionalsBudget,
                projectedInternalCosts,
                projectedInternalHours,
                actualInternalCosts,
                actualInternalHours,
                externalCosts,
                projectedTotalCosts,
                projectedProfit,
                projectedProfitPercentage,
                actualTotalCosts,
                actualProfit,
                actualProfitPercentage,
                hasActualTracking: Boolean(project.actualTimeTracking)
            };
        });
    }, [projects, globalRates, projectManagers, managerFilter]);

    const renderBudgetBreakdown = (data: any) => (
        <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded border border-gray-700/50">
                <div>
                    <p className="text-sm font-medium text-white">Acuerdo Principal</p>
                    <p className="text-xs text-gray-400">Presupuesto contratado inicial</p>
                </div>
                <span className="text-white font-mono font-bold">{formatEuro(data.baseBudget)}</span>
            </div>
            {data.project.clientInfo?.additionals.length > 0 && (
                <div>
                    <p className="text-xs uppercase text-gray-500 font-bold mb-2">Adicionales / Extras</p>
                    <div className="space-y-2">
                        {data.project.clientInfo.additionals.map((add: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-gray-700/20 rounded border-l-2 border-sky-500">
                                <p className="text-sm text-gray-300 truncate flex-1 pr-4">{add.description}</p>
                                <span className="text-sm text-white font-mono">{formatEuro(add.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                <span className="font-bold text-white">Total Presupuesto</span>
                <span className="font-bold text-xl text-sky-400">{formatEuro(data.totalBudget)}</span>
            </div>
        </div>
    );

    const renderProjectedInternalBreakdown = (data: any) => {
        const internalMembers = data.project.team.filter((m: any) => m.type === MemberType.Internal);
        return (
            <div className="space-y-4">
                {internalMembers.map((m: any) => {
                    const info = m.internalCostInfo;
                    const rate = (info && info.hourlyRate > 0) ? info.hourlyRate : (globalRates[m.contact] || 0);
                    const totalHours = (info?.workRanges || []).reduce((hAcc: number, r: any) => hAcc + calculateRangeHours(r), 0);
                    const cost = totalHours * rate;
                    return (
                        <div key={m.contact} className="p-3 bg-gray-700/30 rounded border border-gray-700/50">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-sm font-bold text-white">{m.name}</p>
                                    <p className="text-xs text-gray-400">{m.role}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-orange-400 font-bold">{formatEuro(cost)}</p>
                                    <p className="text-[10px] text-gray-500">{totalHours.toFixed(1)}h x {rate}€/h</p>
                                </div>
                            </div>
                            <div className="space-y-1">
                                {(info?.workRanges || []).map((r: any) => (
                                    <div key={r.id} className="flex justify-between text-[10px] text-gray-500 italic">
                                        <span>{r.taskName} ({r.startDate} al {r.endDate})</span>
                                        <span>{calculateRangeHours(r).toFixed(1)}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                    <div>
                        <span className="font-bold text-white block">Total Gasto Interno Proyectado</span>
                        <span className="text-xs text-gray-400 font-mono">{data.projectedInternalHours.toFixed(1)} horas estimadas</span>
                    </div>
                    <span className="font-bold text-xl text-orange-400">{formatEuro(data.projectedInternalCosts)}</span>
                </div>
            </div>
        );
    };

    const renderActualInternalBreakdown = (data: any) => {
        const internalMembers = data.project.team.filter((m: any) => m.type === MemberType.Internal);
        const actualLogs = data.project.actualTimeTracking?.logs || [];

        return (
            <div className="space-y-4">
                {data.project.actualTimeTracking ? (
                    <div className="p-3 bg-emerald-950/30 rounded border border-emerald-500/30 flex justify-between items-center text-xs text-emerald-300">
                        <div>
                            <span className="font-bold block">📄 Archivo: {data.project.actualTimeTracking.fileName}</span>
                            <span className="text-[10px] text-emerald-400/80">Cargado el {data.project.actualTimeTracking.uploadedAt}</span>
                        </div>
                        <span className="font-bold font-mono text-sm bg-emerald-900/60 px-2 py-1 rounded">
                            {actualLogs.length} fichajes
                        </span>
                    </div>
                ) : (
                    <div className="p-3 bg-amber-950/30 rounded border border-amber-500/30 text-xs text-amber-300">
                        ⚠️ No se ha subido ningún archivo de fichajes para este proyecto. Puedes cargarlo en la pestaña de <strong>Gestión de Recursos Internos</strong>.
                    </div>
                )}

                {internalMembers.map((m: any) => {
                    const key = m.name.toLowerCase().trim();
                    const mLogs = actualLogs.filter((l: any) => l.employeeName.toLowerCase().trim() === key);
                    const mHours = mLogs.reduce((acc: number, l: any) => acc + l.hours, 0);
                    const info = m.internalCostInfo;
                    const rate = (info && info.hourlyRate > 0) ? info.hourlyRate : (globalRates[m.contact] || 0);
                    const cost = mHours * rate;

                    return (
                        <div key={m.contact} className="p-3 bg-gray-700/30 rounded border border-gray-700/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-bold text-white">{m.name}</p>
                                    <p className="text-xs text-gray-400">{m.role}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-emerald-400 font-bold">{formatEuro(cost)}</p>
                                    <p className="text-[10px] text-emerald-300/70 font-mono">{mHours.toFixed(1)}h fichadas x {rate}€/h</p>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                    <div>
                        <span className="font-bold text-white block">Total Gasto Interno Real</span>
                        <span className="text-xs text-emerald-400 font-mono">{data.actualInternalHours.toFixed(1)} horas fichadas en plataforma</span>
                    </div>
                    <span className="font-bold text-xl text-emerald-400">{formatEuro(data.actualInternalCosts)}</span>
                </div>
            </div>
        );
    };

    const renderExternalBreakdown = (data: any) => {
        const externalMembers = data.project.team.filter((m: any) => m.type === MemberType.External);
        return (
            <div className="space-y-4">
                {externalMembers.map((m: any) => {
                    const info = m.collaboratorInfo;
                    if (!info) return null;
                    const base = info.agreement.amount || 0;
                    const extras = info.additionals.reduce((acc: number, curr: any) => acc + curr.amount, 0) || 0;
                    const total = base + extras;
                    return (
                        <div key={m.contact} className="p-3 bg-gray-700/30 rounded border border-gray-700/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-bold text-white">{m.name}</p>
                                    <p className="text-xs text-gray-400">{m.company || 'Colaborador'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-purple-400 font-bold">{formatEuro(total)}</p>
                                    {extras > 0 && <p className="text-[10px] text-gray-500">Base: {formatEuro(base)} + Extras: {formatEuro(extras)}</p>}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                    <span className="font-bold text-white">Total Coste Recursos Externos</span>
                    <span className="font-bold text-xl text-purple-400">{formatEuro(data.externalCosts)}</span>
                </div>
            </div>
        );
    };

    const renderTargetBreakdown = (data: any, isActual: boolean) => {
        const targetProfit = data.totalBudget * 0.5;
        const currentProfit = isActual ? data.actualProfit : data.projectedProfit;
        const currentPercentage = isActual ? data.actualProfitPercentage : data.projectedProfitPercentage;
        const diff = currentProfit - targetProfit;
        const isAboveTarget = diff >= 0;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">
                            {isActual ? 'Beneficio Real a Fecha' : 'Beneficio Proyectado'}
                        </p>
                        <p className={`text-xl font-bold font-mono ${currentProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatEuro(currentProfit)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{currentPercentage.toFixed(1)}% del presupuesto</p>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Objetivo Rentabilidad (50%)</p>
                        <p className="text-xl font-bold font-mono text-white">
                            {formatEuro(targetProfit)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Basado en {formatEuro(data.totalBudget)}</p>
                    </div>
                </div>

                <div className={`p-6 rounded-xl border-2 flex flex-col items-center text-center ${isAboveTarget ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2">Estado del Objetivo</p>
                    <h4 className={`text-3xl font-black mb-2 ${isAboveTarget ? 'text-green-400' : 'text-orange-400'}`}>
                        {isAboveTarget ? 'DENTRO DE OBJETIVO' : 'POR DEBAJO DEL OBJETIVO'}
                    </h4>
                    <p className={`text-4xl font-mono font-bold ${isAboveTarget ? 'text-green-400' : 'text-orange-400'}`}>
                        {formatEuro(Math.abs(diff))}
                    </p>
                    <p className="text-sm text-gray-400 mt-4 max-w-sm">
                        {isAboveTarget 
                            ? `El proyecto mantiene un alto margen de rentabilidad, superando el objetivo del 50% por ${formatEuro(diff)}.`
                            : `El margen actual se encuentra ${formatEuro(Math.abs(diff))} por debajo del objetivo ideal del 50%.`
                        }
                    </p>
                </div>

                <div className="bg-gray-700/20 p-4 rounded-lg">
                    <p className="text-xs text-gray-500 italic text-center">
                        * Cálculo: Presupuesto Total - ({isActual ? 'Gasto Interno Real de Fichajes' : 'Gasto Interno Proyectado'} + Coste Recursos Externos).
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className="mb-8 flex justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        Seguimiento Económico y Rentabilidad
                    </h1>
                    <p className="text-gray-400 mt-2 max-w-3xl text-sm">
                        Análisis comparativo de rentabilidad. Evalúa el <strong>Gasto Interno Proyectado</strong> frente al <strong>Gasto Interno Real (de fichajes)</strong>, y el impacto sobre el beneficio del proyecto.
                    </p>
                </div>
                {managerOptions.length > 0 && (
                    <select
                        value={managerFilter}
                        onChange={(e) => setManagerFilter(e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 flex-shrink-0"
                        title="Filtrar por gestor"
                    >
                        <option value="all">Todos los gestores</option>
                        {managerOptions.map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-700 shadow-xl bg-gray-800/60">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700 text-[10px] uppercase text-gray-400 tracking-wider bg-gray-900/80">
                            <th className="py-4 px-4">Mis Proyectos</th>
                            <th className="py-4 px-4 text-right">Presupuesto</th>
                            <th className="py-4 px-4 text-right">Gasto Int. Proyectado</th>
                            <th className="py-4 px-4 text-right text-emerald-400 font-bold">Gasto Int. Real (Fichaje)</th>
                            <th className="py-4 px-4 text-right">Coste Recursos Externos</th>
                            <th className="py-4 px-4 text-right">Beneficio Proyectado</th>
                            <th className="py-4 px-4 text-right text-emerald-400 font-bold">Beneficio Real a Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-sm">
                        {projectData.map((data) => {
                            const isProjectedAbove = data.projectedProfitPercentage >= 50;
                            const isActualAbove = data.actualProfitPercentage >= 50;

                            return (
                                <tr key={data.project.id} className="hover:bg-gray-800/40 transition-colors group">
                                    {/* Project Code & Name */}
                                    <td className="py-4 px-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-mono text-gray-500">{data.project.code}</span>
                                            <span className="font-bold text-white group-hover:text-sky-400 transition-colors">{data.project.name}</span>
                                        </div>
                                    </td>

                                    {/* Total Budget */}
                                    <td className="py-4 px-4 text-right font-mono">
                                        <button 
                                            onClick={() => setModalData({ type: 'budget', project: data.project })}
                                            className="text-white hover:text-sky-400 inline-flex items-center gap-1.5 justify-end"
                                        >
                                            {formatEuro(data.totalBudget)}
                                            <EyeIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    </td>

                                    {/* Projected Internal Cost */}
                                    <td className="py-4 px-4 text-right font-mono">
                                        <button 
                                            onClick={() => setModalData({ type: 'internal-projected', project: data.project })}
                                            className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-1.5 justify-end"
                                        >
                                            {formatEuro(data.projectedInternalCosts)}
                                            <EyeIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    </td>

                                    {/* Actual Internal Cost (Excel Logs) */}
                                    <td className="py-4 px-4 text-right font-mono bg-emerald-950/10">
                                        <button 
                                            onClick={() => setModalData({ type: 'internal-actual', project: data.project })}
                                            className="text-emerald-400 font-bold hover:text-emerald-300 inline-flex items-center gap-1.5 justify-end"
                                        >
                                            {formatEuro(data.actualInternalCosts)}
                                            <EyeIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    </td>

                                    {/* Collaborators */}
                                    <td className="py-4 px-4 text-right font-mono">
                                        <button 
                                            onClick={() => setModalData({ type: 'external', project: data.project })}
                                            className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1.5 justify-end"
                                        >
                                            {formatEuro(data.externalCosts)}
                                            <EyeIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    </td>

                                    {/* Projected Profit & % */}
                                    <td className="py-4 px-4 text-right">
                                        <button 
                                            onClick={() => setModalData({ type: 'target-projected', project: data.project })}
                                            className="flex flex-col items-end w-full group/btn"
                                        >
                                            <span className={`font-mono font-bold ${data.projectedProfit >= 0 ? 'text-sky-300' : 'text-red-400'}`}>
                                                {formatEuro(data.projectedProfit)}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isProjectedAbove ? 'bg-sky-500/20 text-sky-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {data.projectedProfitPercentage.toFixed(1)}%
                                            </span>
                                        </button>
                                    </td>

                                    {/* Actual Profit & % */}
                                    <td className="py-4 px-4 text-right bg-emerald-950/10">
                                        <button 
                                            onClick={() => setModalData({ type: 'target-actual', project: data.project })}
                                            className="flex flex-col items-end w-full group/btn"
                                        >
                                            <span className={`font-mono font-bold ${data.actualProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {formatEuro(data.actualProfit)}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${isActualAbove ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {data.actualProfitPercentage.toFixed(1)}%
                                            </span>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {modalData && (
                <BreakdownModal 
                    title={
                        modalData.type === 'budget' ? `Desglose Presupuesto: ${modalData.project.name}` :
                        modalData.type === 'internal-projected' ? `Desglose Gasto Interno Proyectado: ${modalData.project.name}` :
                        modalData.type === 'internal-actual' ? `Desglose Gasto Interno Real (Fichajes): ${modalData.project.name}` :
                        modalData.type === 'external' ? `Desglose Coste Recursos Externos: ${modalData.project.name}` :
                        modalData.type === 'target-projected' ? `Análisis Beneficio Proyectado: ${modalData.project.name}` :
                        `Análisis Beneficio Real a Fecha: ${modalData.project.name}`
                    }
                    onClose={() => setModalData(null)}
                >
                    {modalData.type === 'budget' && renderBudgetBreakdown(projectData.find(d => d.project.id === modalData.project.id))}
                    {modalData.type === 'internal-projected' && renderProjectedInternalBreakdown(projectData.find(d => d.project.id === modalData.project.id))}
                    {modalData.type === 'internal-actual' && renderActualInternalBreakdown(projectData.find(d => d.project.id === modalData.project.id))}
                    {modalData.type === 'external' && renderExternalBreakdown(projectData.find(d => d.project.id === modalData.project.id))}
                    {modalData.type === 'target-projected' && renderTargetBreakdown(projectData.find(d => d.project.id === modalData.project.id), false)}
                    {modalData.type === 'target-actual' && renderTargetBreakdown(projectData.find(d => d.project.id === modalData.project.id), true)}
                </BreakdownModal>
            )}

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default EconomicTracking;
