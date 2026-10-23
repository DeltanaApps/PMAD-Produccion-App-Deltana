import React, { useState, useEffect, useMemo } from 'react';
import type { Project, TeamMember, InternalCostInfo, InternalWorkRange, ActualTimeLog } from '../types';
import { MemberType, ProjectStatus } from '../types';
import Card from './ui/Card';
import { PlusIcon, TrashIcon, CalendarIcon, UploadIcon, EyeIcon, PencilIcon } from './ui/Icons';
import { parseTimeTrackingFile } from '../utils/timeTrackingParser';
import { HoursBreakdownModal } from './HoursBreakdownModal';

interface InternalTeamProps {
  projects: Project[];
  globalRates: Record<string, number>;
  availableGlobalMembers?: TeamMember[];
  onUpdateInternalCost: (projectId: string, memberContact: string, costInfo: InternalCostInfo) => void;
  onUpdateProject?: (updatedProject: Project, newGlobalMembers?: TeamMember[]) => void;
}

const formatEuro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(amount);

// Disciplinas fijas para "Nueva Tarea / Rol" de un rango de trabajo.
const WORK_RANGE_TASK_OPTIONS = [
  'TIERRAS',
  'ESTRUCTURAS',
  'ARQUITECTURA',
  'MEP- FONTANERÍA',
  'MEP - HVAC',
  'MEP - DRENAJES',
  'MEP- ELECTRICIDAD',
  'MEP- TELECOMUNICACIÓN',
  'UTILITIES DRY',
  'UTILITIES WET',
  'CIVIL & LANDSCAPE (Caminos, peatonales, zonas verdes)',
];

// --- HELPER FUNCTIONS ---

export const normalizeNameExactUnicode = (name: string): string => {
    if (!name) return '';
    return name.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
};

export const normalizeNameKey = (name: string): string => {
    if (!name) return '';
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
};

export const findMatchingMember = (empName: string, candidates: TeamMember[]): TeamMember | undefined => {
    if (!empName || !candidates || candidates.length === 0) return undefined;

    const exactUnicode = normalizeNameExactUnicode(empName);
    const key = normalizeNameKey(empName);

    // 1. Exact Unicode or contact match
    let match = candidates.find(m => 
        normalizeNameExactUnicode(m.name) === exactUnicode || 
        m.contact.toLowerCase().trim() === empName.toLowerCase().trim()
    );
    if (match) return match;

    // 2. Accent-free key match (handles ñ vs n, accents, casing, extra spaces)
    match = candidates.find(m => normalizeNameKey(m.name) === key);
    if (match) return match;

    // 3. Match if one key contains the other
    match = candidates.find(m => {
        const candidateKey = normalizeNameKey(m.name);
        if (candidateKey.length >= 4 && key.length >= 4) {
            return candidateKey.includes(key) || key.includes(candidateKey);
        }
        return false;
    });

    return match;
};

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

// Helper to merge and deduplicate logs (prevents duplicates when re-uploading)
const mergeAndDeduplicateLogs = (existing: ActualTimeLog[], incoming: ActualTimeLog[]) => {
    const existingKeys = new Set(
        existing.map(l => `${l.date.trim()}|${l.employeeName.toLowerCase().trim()}|${l.hours}|${(l.projectNameRef || '').toLowerCase().trim()}`)
    );

    const newUniqueLogs: ActualTimeLog[] = [];
    let duplicateCount = 0;

    incoming.forEach(log => {
        const key = `${log.date.trim()}|${log.employeeName.toLowerCase().trim()}|${log.hours}|${(log.projectNameRef || '').toLowerCase().trim()}`;
        if (existingKeys.has(key)) {
            duplicateCount++;
        } else {
            existingKeys.add(key);
            newUniqueLogs.push(log);
        }
    });

    const merged = [...existing, ...newUniqueLogs];
    merged.sort((a, b) => a.date.localeCompare(b.date));

    return {
        mergedLogs: merged,
        addedCount: newUniqueLogs.length,
        duplicateCount
    };
};

// Helper to group actual logs by YYYY-MM
const getLogsByMonth = (logs: ActualTimeLog[]) => {
  const map = new Map<string, { monthLabel: string; totalHours: number; count: number }>();
  
  logs.forEach(l => {
    if (!l.date) return;
    const monthKey = l.date.substring(0, 7); // "YYYY-MM"
    const [y, m] = monthKey.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m || '1') - 1, 1);
    const monthName = !isNaN(dateObj.getTime()) 
      ? dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      : monthKey;
    const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const existing = map.get(monthKey) || { monthLabel: capitalized, totalHours: 0, count: 0 };
    existing.totalHours += l.hours;
    existing.count += 1;
    map.set(monthKey, existing);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, val]) => ({ monthKey, ...val }));
};

// --- COMPONENTS ---

const MemberRow: React.FC<{
    member: TeamMember;
    globalRate: number;
    actualLogs: ActualTimeLog[];
    projectName: string;
    availableGlobalMembers?: TeamMember[];
    onUpdate: (costInfo: InternalCostInfo) => void;
    onRemoveLog?: (logId: string) => void;
    onAddLog?: (log: ActualTimeLog) => void;
    onReassignMember?: (oldMemberContact: string, newMember: TeamMember) => void;
    onRenameMember?: (oldMemberContact: string, newName: string) => void;
    onRemoveMemberFromProject?: (memberContact: string) => void;
}> = ({ 
    member, 
    globalRate, 
    actualLogs, 
    projectName, 
    availableGlobalMembers = [],
    onUpdate, 
    onRemoveLog, 
    onAddLog,
    onReassignMember,
    onRenameMember,
    onRemoveMemberFromProject
}) => {
    
    const costInfo = member.internalCostInfo || { hourlyRate: 0, workRanges: [] };
    
    // Determine effective rate
    const effectiveRate = costInfo.hourlyRate > 0 ? costInfo.hourlyRate : globalRate;
    const isUsingGlobal = costInfo.hourlyRate === 0 || costInfo.hourlyRate === undefined;

    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'projected' | 'actual'>('projected');
    const [rate, setRate] = useState(effectiveRate);
    const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

    // Editing / Reassigning Member state
    const [isEditingMember, setIsEditingMember] = useState(false);
    const [selectedGlobalContact, setSelectedGlobalContact] = useState('');
    const [editNameInput, setEditNameInput] = useState(member.name);

    useEffect(() => {
        setEditNameInput(member.name);
    }, [member.name]);

    // Sync rate when global rate changes ONLY if we are using global
    useEffect(() => {
        if (isUsingGlobal) {
            setRate(globalRate);
        }
    }, [globalRate, isUsingGlobal]);

    // Form state for new range
    const [newTaskName, setNewTaskName] = useState('');
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [newPercentage, setNewPercentage] = useState(100);
    const [newHolidays, setNewHolidays] = useState(0);

    // State for adding a milestone
    const [addingMilestoneTo, setAddingMilestoneTo] = useState<string | null>(null);
    const [newMilestoneDesc, setNewMilestoneDesc] = useState('');
    const [newMilestoneDate, setNewMilestoneDate] = useState('');

    // State for manual actual log addition
    const [manualLogDate, setManualLogDate] = useState(new Date().toISOString().substring(0, 10));
    const [manualLogHours, setManualLogHours] = useState<number | ''>('');

    // Projected Calculations
    const projectedHours = (costInfo.workRanges || []).reduce((acc, r) => acc + calculateRangeHours(r), 0);
    const projectedCost = projectedHours * rate;

    // Actual Calculations
    const actualHours = actualLogs.reduce((acc, l) => acc + l.hours, 0);
    const actualCost = actualHours * rate;

    const monthlyBreakdown = getLogsByMonth(actualLogs);

    const handleRateBlur = () => {
        let rateToSave = rate;
        if (rate === globalRate) {
            rateToSave = 0; // 0 means "Use Global"
        }
        if (rateToSave !== costInfo.hourlyRate) {
            onUpdate({ ...costInfo, hourlyRate: rateToSave });
        }
    };

    const handleConfirmReassign = () => {
        if (!selectedGlobalContact || !onReassignMember) return;
        const selectedMember = availableGlobalMembers.find(m => m.contact === selectedGlobalContact);
        if (selectedMember) {
            onReassignMember(member.contact, selectedMember);
            setIsEditingMember(false);
            setSelectedGlobalContact('');
        }
    };

    const handleConfirmRename = () => {
        if (!editNameInput.trim() || !onRenameMember) return;
        onRenameMember(member.contact, editNameInput.trim());
        setIsEditingMember(false);
    };

    const handleConfirmRemove = () => {
        if (window.confirm(`¿Estás seguro de que deseas quitar a "${member.name}" de este proyecto?`)) {
            if (onRemoveMemberFromProject) {
                onRemoveMemberFromProject(member.contact);
            }
            setIsEditingMember(false);
        }
    };

    const handleAddRange = () => {
        if (!newTaskName || !newStart || !newEnd) return;
        
        const newRange: InternalWorkRange = {
            id: `range-${Date.now()}`,
            taskName: newTaskName,
            startDate: newStart,
            endDate: newEnd,
            dedicationPercentage: newPercentage,
            holidaysCount: newHolidays,
            manualHours: undefined,
            partialDeliveries: []
        };
        
        const rateToSave = isUsingGlobal ? 0 : rate;

        onUpdate({
            ...costInfo,
            hourlyRate: rateToSave, 
            workRanges: [...(costInfo.workRanges || []), newRange]
        });

        setNewTaskName('');
        setNewStart('');
        setNewEnd('');
        setNewPercentage(100);
        setNewHolidays(0);
    };

    const handleUpdateRangeValue = (rangeId: string, field: keyof InternalWorkRange, value: any) => {
        const updatedRanges = (costInfo.workRanges || []).map(r => {
            if (r.id === rangeId) {
                let updatedRange = { ...r, [field]: value };

                if (field === 'manualHours') {
                    const hoursInput = parseFloat(value);
                    if (!isNaN(hoursInput) && hoursInput > 0) {
                        const capacity = calculateCapacityHours(updatedRange.startDate, updatedRange.endDate, updatedRange.holidaysCount);
                        let newPercent = 0;
                        if (capacity > 0) {
                            newPercent = (hoursInput / capacity) * 100;
                        }
                        updatedRange.manualHours = hoursInput;
                        updatedRange.dedicationPercentage = parseFloat(newPercent.toFixed(2));
                    } else {
                        updatedRange.manualHours = undefined;
                    }
                }
                else if (field === 'dedicationPercentage') {
                    updatedRange.manualHours = undefined; 
                }
                else if (field === 'startDate' || field === 'endDate' || field === 'holidaysCount') {
                    const newCapacity = calculateCapacityHours(
                        field === 'startDate' ? value : r.startDate,
                        field === 'endDate' ? value : r.endDate,
                        field === 'holidaysCount' ? value : r.holidaysCount
                    );
                    if (updatedRange.manualHours && newCapacity > 0) {
                        updatedRange.dedicationPercentage = parseFloat(((updatedRange.manualHours / newCapacity) * 100).toFixed(2));
                    }
                }

                return updatedRange;
            }
            return r;
        });

        const rateToSave = isUsingGlobal ? 0 : rate;
        onUpdate({ ...costInfo, hourlyRate: rateToSave, workRanges: updatedRanges });
    };

    const handleRemoveRange = (rangeId: string) => {
        const updatedRanges = (costInfo.workRanges || []).filter(r => r.id !== rangeId);
        const rateToSave = isUsingGlobal ? 0 : rate;
        onUpdate({ ...costInfo, hourlyRate: rateToSave, workRanges: updatedRanges });
    };

    const handleAddMilestone = (rangeId: string) => {
        if (!newMilestoneDesc || !newMilestoneDate) return;
        const updatedRanges = (costInfo.workRanges || []).map(r => {
            if (r.id === rangeId) {
                const newMilestone = {
                    id: `ms-${Date.now()}`,
                    date: newMilestoneDate,
                    description: newMilestoneDesc,
                    completed: false
                };
                return {
                    ...r,
                    partialDeliveries: [...(r.partialDeliveries || []), newMilestone]
                };
            }
            return r;
        });

        const rateToSave = isUsingGlobal ? 0 : rate;
        onUpdate({ ...costInfo, hourlyRate: rateToSave, workRanges: updatedRanges });

        setAddingMilestoneTo(null);
        setNewMilestoneDesc('');
        setNewMilestoneDate('');
    };

    const handleRemoveMilestone = (rangeId: string, milestoneId: string) => {
        const updatedRanges = (costInfo.workRanges || []).map(r => {
            if (r.id === rangeId) {
                return {
                    ...r,
                    partialDeliveries: (r.partialDeliveries || []).filter(p => p.id !== milestoneId)
                };
            }
            return r;
        });
        const rateToSave = isUsingGlobal ? 0 : rate;
        onUpdate({ ...costInfo, hourlyRate: rateToSave, workRanges: updatedRanges });
    };

    const handleAddManualActualLog = () => {
        if (!manualLogHours || typeof manualLogHours !== 'number' || manualLogHours === 0) return;
        if (!onAddLog) return;

        const newLog: ActualTimeLog = {
            id: `manual-log-${Date.now()}`,
            date: manualLogDate,
            hours: manualLogHours,
            employeeName: member.name,
            projectNameRef: projectName
        };

        onAddLog(newLog);
        setManualLogHours('');
    };

    return (
        <div className="bg-gray-800/80 rounded-lg border border-gray-700/80 overflow-hidden shadow-sm hover:border-gray-600 transition-all">
            {/* Main Row Header */}
            <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                
                {/* Member Info */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-900/60 border border-sky-500/30 flex items-center justify-center font-bold text-sky-300 text-sm">
                        {member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-base flex items-center gap-2">
                            <span>{member.name}</span>
                            {(onReassignMember || onRenameMember || onRemoveMemberFromProject) && (
                                <button 
                                    onClick={() => setIsEditingMember(true)}
                                    className="text-gray-400 hover:text-sky-400 p-1 rounded hover:bg-gray-700/80 transition-colors"
                                    title="Editar o reasignar recurso en Recursos"
                                >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{member.role || 'Recurso Interno'}</span>
                            <span>•</span>
                            <span className="font-mono text-gray-500">{member.contact}</span>
                        </div>
                    </div>
                </div>

                {/* Metrics & Rates */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full lg:w-auto justify-between lg:justify-end">
                    
                    {/* Rate Input */}
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1 font-bold">
                            Tarifa
                            {isUsingGlobal && <span className="text-sky-400 text-[9px]">(Global)</span>}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                             <input 
                                type="number" 
                                value={rate} 
                                onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                                onBlur={handleRateBlur}
                                className={`bg-gray-900 border rounded px-2 py-0.5 w-16 text-right text-xs font-mono text-white focus:ring-1 focus:ring-sky-500 ${isUsingGlobal ? 'border-sky-500/50 text-sky-100' : 'border-gray-600'}`}
                                min="0"
                            />
                            <span className="text-xs text-gray-400">€/h</span>
                        </div>
                    </div>
                    
                    {/* Projected Box */}
                    <div className="bg-gray-900/80 px-3 py-1.5 rounded border border-gray-700/80 text-right min-w-[125px]">
                        <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">Gasto Proyectado</span>
                        <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                            <span className="text-xs font-mono text-gray-300">{projectedHours.toFixed(1)}h</span>
                            <span className="font-bold text-sm text-sky-400">{formatEuro(projectedCost)}</span>
                        </div>
                    </div>

                    {/* Actual Box - Clickable for Breakdown Modal */}
                    <button 
                        onClick={() => setIsBreakdownModalOpen(true)}
                        className="bg-gray-900/80 px-3 py-1.5 rounded border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/40 text-right min-w-[130px] transition-all group/actual"
                        title="Haz clic para abrir el desglose mensual de horas e importes en Euros"
                    >
                        <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider block flex items-center justify-end gap-1">
                            Gasto Real <EyeIcon className="w-3 h-3 opacity-60 group-hover/actual:opacity-100 transition-opacity" />
                        </span>
                        <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                            <span className="text-xs font-mono text-emerald-200">{actualHours.toFixed(1)}h</span>
                            <span className="font-bold text-sm text-emerald-400">{formatEuro(actualCost)}</span>
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`text-xs px-3 py-1.5 rounded transition-colors font-semibold ${isExpanded ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    >
                        {isExpanded ? 'Ocultar' : 'Detalles'}
                    </button>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="bg-gray-900/60 p-4 border-t border-gray-700/50 animate-fade-in">
                    {/* Tabs Header */}
                    <div className="flex border-b border-gray-700 mb-4 gap-4">
                        <button 
                            onClick={() => setActiveTab('projected')}
                            className={`pb-2 text-xs font-bold transition-colors border-b-2 ${activeTab === 'projected' ? 'border-sky-500 text-sky-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                        >
                            Horas Proyectadas ({projectedHours.toFixed(1)}h)
                        </button>
                        <button 
                            onClick={() => setActiveTab('actual')}
                            className={`pb-2 text-xs font-bold transition-colors border-b-2 ${activeTab === 'actual' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                        >
                            Fichajes Reales ({actualHours.toFixed(1)}h)
                        </button>
                    </div>

                    {activeTab === 'projected' ? (
                        <div>
                            {/* Add New Range Form */}
                            <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,0.8fr,0.8fr,auto] gap-3 items-end mb-4 bg-gray-800/80 p-3 rounded border border-gray-700">
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 mb-1">Nueva Tarea / Rol</label>
                                    <select value={newTaskName} onChange={e => setNewTaskName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white">
                                        <option value="">Seleccionar...</option>
                                        {WORK_RANGE_TASK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 mb-1">Inicio</label>
                                    <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white" />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 mb-1">Fin</label>
                                    <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white" />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 mb-1">% Dedic.</label>
                                    <div className="relative">
                                        <input type="number" value={newPercentage} onChange={e => setNewPercentage(Math.min(100, Math.max(0, parseFloat(e.target.value))))} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white pr-4" />
                                        <span className="absolute right-1 top-1 text-xs text-gray-500">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 mb-1">Festivos (Días)</label>
                                    <input type="number" value={newHolidays} onChange={e => setNewHolidays(Math.max(0, parseInt(e.target.value)))} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white" placeholder="0" />
                                </div>
                                <button onClick={handleAddRange} className="bg-sky-600 hover:bg-sky-500 text-white p-1.5 rounded h-8 w-8 flex items-center justify-center">
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Ranges List */}
                            <div className="space-y-1">
                                {(costInfo.workRanges || []).length === 0 ? (
                                    <p className="text-gray-500 text-xs text-center py-2 italic">No hay rangos de trabajo proyectados asignados.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {(costInfo.workRanges || []).map((range) => {
                                            const currentHours = calculateRangeHours(range);
                                            const isManual = range.manualHours !== undefined && range.manualHours > 0;
                                            return (
                                                <div key={range.id} className="bg-gray-800/60 p-2.5 rounded border border-gray-700/60">
                                                    <div className="grid grid-cols-1 md:grid-cols-[2fr,1.5fr,1fr,1.2fr,auto] gap-2 items-center text-xs">
                                                        <select
                                                            value={range.taskName}
                                                            onChange={(e) => handleUpdateRangeValue(range.id, 'taskName', e.target.value)}
                                                            className="bg-transparent border-b border-transparent hover:border-gray-600 focus:border-sky-500 font-bold text-white text-xs focus:outline-none rounded"
                                                        >
                                                            {!WORK_RANGE_TASK_OPTIONS.includes(range.taskName) && range.taskName && (
                                                                <option value={range.taskName}>{range.taskName} (anterior)</option>
                                                            )}
                                                            {WORK_RANGE_TASK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                        </select>
                                                        
                                                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                                            <input 
                                                                type="date" 
                                                                value={range.startDate} 
                                                                onChange={(e) => handleUpdateRangeValue(range.id, 'startDate', e.target.value)}
                                                                className="bg-transparent border-b border-transparent hover:border-gray-600 text-gray-300 focus:border-sky-500 focus:outline-none"
                                                            />
                                                            <span>-</span>
                                                            <input 
                                                                type="date" 
                                                                value={range.endDate} 
                                                                onChange={(e) => handleUpdateRangeValue(range.id, 'endDate', e.target.value)}
                                                                className="bg-transparent border-b border-transparent hover:border-gray-600 text-gray-300 focus:border-sky-500 focus:outline-none"
                                                            />
                                                        </div>

                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="number" 
                                                                value={range.dedicationPercentage} 
                                                                onChange={(e) => handleUpdateRangeValue(range.id, 'dedicationPercentage', parseFloat(e.target.value) || 0)}
                                                                className="bg-transparent border-b border-transparent hover:border-gray-600 text-right text-sky-400 font-bold text-xs w-12 focus:border-sky-500 focus:outline-none"
                                                            />
                                                            <span className="text-[10px] text-gray-500">%</span>
                                                            <span className="text-gray-600">|</span>
                                                            <input 
                                                                type="number" 
                                                                value={range.holidaysCount} 
                                                                onChange={(e) => handleUpdateRangeValue(range.id, 'holidaysCount', parseFloat(e.target.value) || 0)}
                                                                className="bg-transparent border-b border-transparent hover:border-gray-600 text-center text-orange-400 text-xs w-8 focus:border-orange-500 focus:outline-none"
                                                            />
                                                            <span className="text-[10px] text-gray-500 uppercase">Fest.</span>
                                                        </div>
                                                        
                                                        <div className="relative">
                                                            <div className="flex items-center justify-end">
                                                                <input 
                                                                    type="number" 
                                                                    value={currentHours > 0 ? parseFloat(currentHours.toFixed(2)) : ''}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleUpdateRangeValue(range.id, 'manualHours', parseFloat(e.target.value))}
                                                                    className={`bg-gray-900 border rounded px-2 py-0.5 text-right text-xs w-20 focus:ring-1 focus:ring-sky-500 ${isManual ? 'border-sky-500 text-sky-300 font-bold' : 'border-gray-700 text-gray-400'}`}
                                                                />
                                                                <span className="text-xs text-gray-500 ml-1">h</span>
                                                            </div>
                                                        </div>

                                                        <button onClick={() => handleRemoveRange(range.id)} className="text-red-400 hover:text-red-300 p-1">
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>

                                                    {/* Milestones */}
                                                    <div className="ml-4 pl-3 border-l border-gray-700/50 mt-2">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Hitos</span>
                                                            {addingMilestoneTo !== range.id && (
                                                                <button 
                                                                    onClick={() => setAddingMilestoneTo(range.id)}
                                                                    className="text-[10px] text-sky-400 hover:underline flex items-center gap-0.5"
                                                                >
                                                                    <PlusIcon className="w-3 h-3" /> Añadir
                                                                </button>
                                                            )}
                                                        </div>

                                                        {addingMilestoneTo === range.id && (
                                                            <div className="flex gap-2 items-center bg-gray-900/50 p-1.5 rounded mb-1 border border-sky-900/50">
                                                                <input type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs text-white" />
                                                                <input type="text" value={newMilestoneDesc} onChange={e => setNewMilestoneDesc(e.target.value)} placeholder="Descripción entrega..." className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs text-white flex-1" />
                                                                <button onClick={() => handleAddMilestone(range.id)} className="bg-sky-600 text-white px-2 py-0.5 rounded text-xs">Guardar</button>
                                                                <button onClick={() => setAddingMilestoneTo(null)} className="text-gray-400 text-xs px-2">X</button>
                                                            </div>
                                                        )}

                                                        <div className="space-y-0.5">
                                                            {(range.partialDeliveries || []).map(pd => (
                                                                <div key={pd.id} className="flex items-center gap-2 text-xs text-gray-300">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                                    <span className="font-mono text-gray-500">{pd.date}</span>
                                                                    <span className="flex-1">{pd.description}</span>
                                                                    <button onClick={() => handleRemoveMilestone(range.id, pd.id)} className="text-gray-600 hover:text-red-400">✕</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Actual Time Logs Tab */
                        <div className="space-y-4">
                            {/* Monthly Breakdown Summary with Euro values & Clickable modal trigger */}
                            {monthlyBreakdown.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-xs uppercase text-gray-400 font-bold">Resumen Mes a Mes</h5>
                                        <button 
                                            onClick={() => setIsBreakdownModalOpen(true)}
                                            className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                                        >
                                            <EyeIcon className="w-3.5 h-3.5" /> Ver Desglose Completo
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {monthlyBreakdown.map(m => (
                                            <div 
                                                key={m.monthKey} 
                                                onClick={() => setIsBreakdownModalOpen(true)}
                                                className="bg-gray-800/80 p-2.5 rounded border border-emerald-500/20 text-center cursor-pointer hover:border-emerald-400 hover:bg-gray-800 transition-all shadow-sm"
                                                title="Haz clic para ver el desglose en Euros"
                                            >
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{m.monthLabel}</p>
                                                <p className="text-sm font-mono font-bold text-emerald-400">{m.totalHours.toFixed(1)} h</p>
                                                <p className="text-[11px] text-sky-300 font-mono font-bold">{formatEuro(m.totalHours * rate)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Add Manual Log Line */}
                            {onAddLog && (
                                <div className="flex flex-wrap gap-2 items-center bg-gray-800/80 p-2.5 rounded border border-gray-700">
                                    <span className="text-xs text-gray-400 font-bold">Añadir Fichaje Manual:</span>
                                    <input 
                                        type="date" 
                                        value={manualLogDate} 
                                        onChange={e => setManualLogDate(e.target.value)} 
                                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white" 
                                    />
                                    <input 
                                        type="number" 
                                        step="0.5"
                                        placeholder="Horas (+/-)" 
                                        value={manualLogHours} 
                                        onChange={e => setManualLogHours(e.target.value ? parseFloat(e.target.value) : '')} 
                                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white w-28" 
                                    />
                                    <button 
                                        onClick={handleAddManualActualLog}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-semibold"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            )}

                            {/* Detailed Log Table */}
                            <div>
                                <h5 className="text-xs uppercase text-gray-400 font-bold mb-2">Registros Importados ({actualLogs.length})</h5>
                                {actualLogs.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic py-3 text-center">No hay registros de fichaje para este recurso en este proyecto.</p>
                                ) : (
                                    <div className="max-h-52 overflow-y-auto border border-gray-700/50 rounded bg-gray-900/40">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-800 text-gray-400 uppercase text-[9px] sticky top-0">
                                                <tr>
                                                    <th className="py-2 px-3">Fecha</th>
                                                    <th className="py-2 px-3">Proyecto Ref.</th>
                                                    <th className="py-2 px-3 text-right">Horas</th>
                                                    <th className="py-2 px-3 text-right">Coste Real</th>
                                                    <th className="py-2 px-3 text-center">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800">
                                                {actualLogs.map((log) => (
                                                    <tr key={log.id} className="hover:bg-gray-800/30">
                                                        <td className="py-1.5 px-3 font-mono text-gray-300">{log.date}</td>
                                                        <td className="py-1.5 px-3 text-gray-400">{log.projectNameRef || '-'}</td>
                                                        <td className={`py-1.5 px-3 text-right font-mono font-bold ${log.hours >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {log.hours > 0 ? `+${log.hours}` : log.hours} h
                                                        </td>
                                                        <td className="py-1.5 px-3 text-right font-mono text-gray-300">
                                                            {formatEuro(log.hours * rate)}
                                                        </td>
                                                        <td className="py-1.5 px-3 text-center">
                                                            {onRemoveLog && (
                                                                <button 
                                                                    onClick={() => onRemoveLog(log.id)}
                                                                    className="text-gray-500 hover:text-red-400 transition-colors"
                                                                    title="Eliminar registro"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Hours Breakdown Modal for Member */}
            {isBreakdownModalOpen && (
                <HoursBreakdownModal
                    title={`Desglose de Horas e Importes en Euros (€)`}
                    projectName={projectName}
                    memberName={member.name}
                    defaultRate={rate}
                    actualLogs={actualLogs}
                    onClose={() => setIsBreakdownModalOpen(false)}
                />
            )}

            {/* Modal for Editing / Reassigning Member */}
            {isEditingMember && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-lg w-full shadow-2xl">
                        <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-700">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-sky-400 font-mono">{projectName}</span>
                                <h3 className="text-lg font-bold text-white mt-0.5">Editar / Reasignar Recurso</h3>
                            </div>
                            <button onClick={() => setIsEditingMember(false)} className="text-gray-400 hover:text-white p-1">✕</button>
                        </div>

                        <p className="text-xs text-gray-300 mb-4">
                            Recurso actual en proyecto: <strong className="text-sky-300">{member.name}</strong> ({member.contact})
                        </p>

                        {/* Option 1: Reassign to Global Member */}
                        <div className="bg-gray-900/80 p-3.5 rounded-lg border border-gray-700 mb-4">
                            <label className="block text-xs font-bold text-sky-400 uppercase mb-1.5">
                                1. Reasignar a un Recurso Existente:
                            </label>
                            <p className="text-[11px] text-gray-400 mb-2">
                                Vincula este recurso a uno ya existente en tu base de datos de Recursos. Todos sus fichajes e historial se actualizarán al recurso seleccionado.
                            </p>
                            <div className="flex gap-2">
                                <select
                                    value={selectedGlobalContact}
                                    onChange={(e) => setSelectedGlobalContact(e.target.value)}
                                    className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-3 py-2 flex-1 focus:outline-none focus:border-sky-500"
                                >
                                    <option value="">-- Seleccionar de Recursos --</option>
                                    {availableGlobalMembers
                                        .filter(m => m.type === MemberType.Internal && m.contact !== member.contact)
                                        .map(m => (
                                            <option key={m.contact} value={m.contact}>
                                                {m.name} ({m.role || 'Recurso Interno'}) - {m.contact}
                                            </option>
                                        ))}
                                </select>
                                <button
                                    disabled={!selectedGlobalContact}
                                    onClick={handleConfirmReassign}
                                    className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs px-3 py-2 rounded transition-colors"
                                >
                                    Reasignar
                                </button>
                            </div>
                        </div>

                        {/* Option 2: Edit Name directly */}
                        <div className="bg-gray-900/80 p-3.5 rounded-lg border border-gray-700 mb-4">
                            <label className="block text-xs font-bold text-purple-400 uppercase mb-1.5">
                                2. Modificar Nombre de este Recurso:
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={editNameInput}
                                    onChange={(e) => setEditNameInput(e.target.value)}
                                    className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-3 py-2 flex-1 focus:outline-none focus:border-purple-500"
                                    placeholder="Nombre del recurso..."
                                />
                                <button
                                    onClick={handleConfirmRename}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-2 rounded transition-colors"
                                >
                                    Guardar Nombre
                                </button>
                            </div>
                        </div>

                        {/* Option 3: Remove from project */}
                        <div className="flex justify-between items-center pt-3 border-t border-gray-700 mt-4">
                            <button
                                onClick={handleConfirmRemove}
                                className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-950/40 transition-colors"
                            >
                                <TrashIcon className="w-3.5 h-3.5" /> Quitar recurso del proyecto
                            </button>
                            <button
                                onClick={() => setIsEditingMember(false)}
                                className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-4 py-2 rounded font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ProjectSection: React.FC<{
    project: Project;
    globalRates: Record<string, number>;
    availableGlobalMembers?: TeamMember[];
    onUpdateInternalCost: (projectId: string, memberContact: string, costInfo: InternalCostInfo) => void;
    onUpdateProject?: (updatedProject: Project, newGlobalMembers?: TeamMember[]) => void;
}> = ({ project, globalRates, availableGlobalMembers = [], onUpdateInternalCost, onUpdateProject }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isProjectBreakdownModalOpen, setIsProjectBreakdownModalOpen] = useState(false);
    
    const internalMembers = project.team.filter(m => m.type === MemberType.Internal);

    // Calculate Projected Internal Costs
    let projectProjectedCost = 0;
    let projectProjectedHours = 0;

    internalMembers.forEach(m => {
        const info = m.internalCostInfo;
        const rate = (info && info.hourlyRate > 0) ? info.hourlyRate : (globalRates[m.contact] || 0);
        const totalMemberHours = (info?.workRanges || []).reduce((hAcc, r) => hAcc + calculateRangeHours(r), 0);
        
        projectProjectedCost += (totalMemberHours * rate);
        projectProjectedHours += totalMemberHours;
    });

    // Calculate Actual Internal Costs from Excel time logs
    const actualLogs = project.actualTimeTracking?.logs || [];
    let projectActualCost = 0;
    let projectActualHours = 0;

    // Group actual logs by member using smart matching
    const memberActualLogsMap = new Map<string, ActualTimeLog[]>();
    actualLogs.forEach(log => {
        const matchedMember = findMatchingMember(log.employeeName, internalMembers);
        const key = matchedMember ? matchedMember.contact : normalizeNameKey(log.employeeName);
        const existing = memberActualLogsMap.get(key) || [];
        existing.push(log);
        memberActualLogsMap.set(key, existing);
    });

    // Compute actual cost per internal member
    internalMembers.forEach(m => {
        const mLogs = memberActualLogsMap.get(m.contact) || memberActualLogsMap.get(normalizeNameKey(m.name)) || [];
        const mHours = mLogs.reduce((acc, l) => acc + l.hours, 0);
        const info = m.internalCostInfo;
        const rate = (info && info.hourlyRate > 0) ? info.hourlyRate : (globalRates[m.contact] || 0);
        
        projectActualHours += mHours;
        projectActualCost += (mHours * rate);
    });

    // Variance (Actual vs Projected)
    const costVariance = projectActualCost - projectProjectedCost;
    const hoursVariance = projectActualHours - projectProjectedHours;

    // Excel upload handler with INCREMENTAL DE-DUPLICATION and smart member matching
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const allRawLogs = await parseTimeTrackingFile(file);
            if (allRawLogs.length === 0) {
                alert("No se encontraron registros válidos en el archivo. Verifica las columnas: Col A: Proyecto, Col B: Fecha, Col C: Empleado, Col D: Horas.");
                return;
            }

            // Only accept rows whose Columna A (Export Ref / nombre / código)
            // matches ESTE proyecto -- de lo contrario estaríamos cargando
            // fichajes de otro proyecto por error (mismo chequeo que ya hace
            // "Cargar Fichaje Multiproyecto").
            const expName = (project.exportName || '').toLowerCase().trim();
            const pName = project.name.toLowerCase().trim();
            const pCode = project.code.toLowerCase().trim();
            const rawLogs = allRawLogs.filter(l => {
                const ref = (l.projectNameRef || '').toLowerCase().trim();
                return (expName && ref === expName) || (pName && ref === pName) || (pCode && ref === pCode);
            });
            const mismatchedCount = allRawLogs.length - rawLogs.length;

            if (rawLogs.length === 0) {
                alert(
                    `El archivo no coincide con este proyecto.\n\n` +
                    `Ninguna fila de la Columna A coincide con el código ("${project.code}"), el nombre o el nombre de exportación de "${project.name}". No se cargó ningún fichaje.`
                );
                return;
            }

            // Find unique employee names in imported logs
            const uniqueEmpNames = Array.from(new Set(rawLogs.map(l => l.employeeName)));
            const updatedTeam = [...project.team];
            const newGlobalMembers: TeamMember[] = [];

            uniqueEmpNames.forEach(empName => {
                // 1. Check if already in project team
                const existingInProject = findMatchingMember(empName, updatedTeam);
                if (existingInProject) return;

                // 2. Check if exists in Global Team database
                const existingInGlobal = findMatchingMember(empName, availableGlobalMembers);
                if (existingInGlobal) {
                    updatedTeam.push({ ...existingInGlobal, type: MemberType.Internal });
                    return;
                }

                // 3. Create new member if not found anywhere
                const key = normalizeNameKey(empName);
                const normalizedContact = (key || 'recurso') + '@internal.com';
                const newMember: TeamMember = {
                    name: empName,
                    role: 'Recurso Interno',
                    contact: normalizedContact,
                    type: MemberType.Internal,
                    internalCostInfo: { hourlyRate: 0, workRanges: [] }
                };
                updatedTeam.push(newMember);
                newGlobalMembers.push(newMember);
            });

            // Merge & Deduplicate with existing logs
            const existingLogs = project.actualTimeTracking?.logs || [];
            const { mergedLogs, addedCount, duplicateCount } = mergeAndDeduplicateLogs(existingLogs, rawLogs);

            const confirmed = window.confirm(
                `¿Confirmás guardar estos fichajes en la base de datos?\n\n` +
                `• Proyecto: ${project.name}\n` +
                `• Registros nuevos a guardar: ${addedCount}\n` +
                `• Duplicados que se omitirán: ${duplicateCount}\n` +
                (mismatchedCount > 0 ? `• Filas de otro proyecto ignoradas: ${mismatchedCount}\n` : '') +
                `\nEsta acción no se puede deshacer.`
            );
            if (!confirmed) {
                e.target.value = '';
                return;
            }

            const updatedProject: Project = {
                ...project,
                team: updatedTeam,
                actualTimeTracking: {
                    fileName: file.name,
                    uploadedAt: new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    logs: mergedLogs
                }
            };

            if (onUpdateProject) {
                onUpdateProject(updatedProject, newGlobalMembers);
            }

            alert(`¡Fichajes procesados e integrados correctamente en la base de datos!\n\n` +
                  `• Proyecto: ${project.name}\n` +
                  `• Nuevos registros añadidos: ${addedCount}\n` +
                  `• Registros duplicados (ya existentes) omitidos: ${duplicateCount}\n` +
                  (mismatchedCount > 0 ? `• Filas de otro proyecto ignoradas (no coinciden): ${mismatchedCount}\n` : '') +
                  `• Total fichajes guardados en el proyecto: ${mergedLogs.length}\n` +
                  `• Nuevos recursos creados: ${newGlobalMembers.length}`);
        } catch (err) {
            console.error("Error al leer archivo Excel/CSV", err);
            alert("Error al procesar el archivo. Asegúrate de subir un archivo .xlsx, .xls o .csv válido.");
        }

        // Reset input
        e.target.value = '';
    };

    const handleClearLogs = () => {
        if (window.confirm(`¿Estás seguro de que deseas borrar los fichajes importados para ${project.name}?`)) {
            const updatedProject: Project = {
                ...project,
                actualTimeTracking: undefined
            };
            if (onUpdateProject) {
                onUpdateProject(updatedProject);
            }
        }
    };

    const handleRemoveSingleLog = (logId: string) => {
        if (!project.actualTimeTracking) return;
        const filteredLogs = project.actualTimeTracking.logs.filter(l => l.id !== logId);
        const updatedProject: Project = {
            ...project,
            actualTimeTracking: filteredLogs.length > 0 ? {
                ...project.actualTimeTracking,
                logs: filteredLogs
            } : undefined
        };
        if (onUpdateProject) {
            onUpdateProject(updatedProject);
        }
    };

    const handleAddSingleLogForMember = (log: ActualTimeLog) => {
        const existingLogs = project.actualTimeTracking?.logs || [];
        const { mergedLogs } = mergeAndDeduplicateLogs(existingLogs, [log]);

        const updatedProject: Project = {
            ...project,
            actualTimeTracking: {
                fileName: project.actualTimeTracking?.fileName || 'Manual',
                uploadedAt: new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                logs: mergedLogs
            }
        };
        if (onUpdateProject) {
            onUpdateProject(updatedProject);
        }
    };

    // Reassign Member Handler
    const handleReassignMember = (oldMemberContact: string, newMember: TeamMember) => {
        const oldMember = project.team.find(m => m.contact === oldMemberContact);
        const oldName = oldMember ? oldMember.name : '';

        const isNewInTeam = project.team.some(m => m.contact === newMember.contact);
        let updatedTeam = [...project.team];

        if (isNewInTeam) {
            updatedTeam = updatedTeam.filter(m => m.contact !== oldMemberContact);
        } else {
            updatedTeam = updatedTeam.map(m => m.contact === oldMemberContact ? { ...newMember, type: MemberType.Internal } : m);
        }

        let updatedLogs = project.actualTimeTracking?.logs || [];
        if (oldName && updatedLogs.length > 0) {
            updatedLogs = updatedLogs.map(l => {
                if (findMatchingMember(l.employeeName, [oldMember!]) || normalizeNameKey(l.employeeName) === normalizeNameKey(oldName)) {
                    return { ...l, employeeName: newMember.name };
                }
                return l;
            });
        }

        const updatedProject: Project = {
            ...project,
            team: updatedTeam,
            actualTimeTracking: project.actualTimeTracking ? {
                ...project.actualTimeTracking,
                logs: updatedLogs
            } : undefined
        };

        if (onUpdateProject) {
            onUpdateProject(updatedProject);
        }
    };

    // Rename Member Handler
    const handleRenameMember = (oldMemberContact: string, newName: string) => {
        const oldMember = project.team.find(m => m.contact === oldMemberContact);
        const oldName = oldMember ? oldMember.name : '';

        const updatedTeam = project.team.map(m => m.contact === oldMemberContact ? { ...m, name: newName } : m);

        let updatedLogs = project.actualTimeTracking?.logs || [];
        if (oldName && updatedLogs.length > 0) {
            updatedLogs = updatedLogs.map(l => {
                if (findMatchingMember(l.employeeName, [oldMember!]) || normalizeNameKey(l.employeeName) === normalizeNameKey(oldName)) {
                    return { ...l, employeeName: newName };
                }
                return l;
            });
        }

        const updatedProject: Project = {
            ...project,
            team: updatedTeam,
            actualTimeTracking: project.actualTimeTracking ? {
                ...project.actualTimeTracking,
                logs: updatedLogs
            } : undefined
        };

        if (onUpdateProject) {
            onUpdateProject(updatedProject);
        }
    };

    // Remove Member From Project Handler
    const handleRemoveMemberFromProject = (memberContact: string) => {
        const updatedProject: Project = {
            ...project,
            team: project.team.filter(m => m.contact !== memberContact)
        };
        if (onUpdateProject) {
            onUpdateProject(updatedProject);
        }
    };

    // Global Member addition selector state
    const projectMemberContacts = new Set(project.team.map(m => m.contact.toLowerCase().trim()));
    const unassignedGlobalMembers = availableGlobalMembers.filter(
        m => m.type === MemberType.Internal && !projectMemberContacts.has(m.contact.toLowerCase().trim())
    );
    const [selectedAddMemberContact, setSelectedAddMemberContact] = useState('');

    const handleAddGlobalMemberToProject = () => {
        if (!selectedAddMemberContact) return;
        const globalMember = availableGlobalMembers.find(m => m.contact === selectedAddMemberContact);
        if (!globalMember) return;

        const newTeamMember: TeamMember = {
            ...globalMember,
            type: MemberType.Internal,
            internalCostInfo: globalMember.internalCostInfo || { hourlyRate: 0, workRanges: [] }
        };

        const updatedProject: Project = {
            ...project,
            team: [...project.team, newTeamMember]
        };

        if (onUpdateProject) {
            onUpdateProject(updatedProject);
        }
        setSelectedAddMemberContact('');
    };

    return (
        <Card className="border border-gray-700 shadow-md transition-all duration-200 hover:border-gray-600">
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                
                {/* Title & Clickable info */}
                <div 
                    className="flex items-center gap-4 cursor-pointer select-none flex-1"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className={`p-2 rounded-full bg-gray-800 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                             <span className="block text-xs font-mono text-gray-500">{project.code}</span>
                             <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                project.status === ProjectStatus.InProgress ? 'bg-sky-500/20 text-sky-300' :
                                project.status === ProjectStatus.Completed ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>{project.status}</span>
                            {project.exportName && (
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                                    Export Ref: {project.exportName}
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-white mt-0.5">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3"/> {project.startDate || '?'} - {project.endDate || '?'}
                            </span>
                            <span className="text-gray-600 text-xs">|</span>
                            <span className="text-xs text-gray-400">{internalMembers.length} Miembros Internos</span>
                        </div>
                    </div>
                </div>

                {/* Metrics Comparison & Upload Button */}
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-between xl:justify-end border-t xl:border-t-0 pt-3 xl:pt-0 border-gray-800">
                    
                    {/* Projected Box */}
                    <div className="bg-gray-900/80 px-3 py-2 rounded border border-gray-700 text-right min-w-[130px]">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Gasto Proyectado</p>
                        <p className="text-sm font-mono text-gray-300">{projectProjectedHours.toFixed(1)} h</p>
                        <p className="text-base font-bold text-sky-400">{formatEuro(projectProjectedCost)}</p>
                    </div>

                    {/* Actual Box - Clickable for Monthly Breakdown Modal */}
                    <button 
                        onClick={() => setIsProjectBreakdownModalOpen(true)}
                        className="bg-gray-900/80 px-3 py-2 rounded border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/40 text-right min-w-[135px] transition-all group/btn"
                        title="Haz clic para ver el desglose mensual de horas e importes en Euros (€)"
                    >
                        <p className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider flex items-center justify-end gap-1">
                            Gasto Real ({actualLogs.length}) <EyeIcon className="w-3.5 h-3.5 opacity-60 group-hover/btn:opacity-100 transition-opacity" />
                        </p>
                        <p className="text-sm font-mono text-emerald-200">{projectActualHours.toFixed(1)} h</p>
                        <p className="text-base font-bold text-emerald-400">{formatEuro(projectActualCost)}</p>
                    </button>

                    {/* Variance Box */}
                    <div className={`px-3 py-2 rounded border text-right min-w-[120px] ${
                        costVariance <= 0 ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400' : 'bg-amber-950/30 border-amber-800/40 text-amber-400'
                    }`}>
                        <p className="text-[9px] uppercase font-bold tracking-wider text-gray-400">Desviación</p>
                        <p className="text-xs font-mono">{hoursVariance >= 0 ? `+${hoursVariance.toFixed(1)}` : hoursVariance.toFixed(1)} h</p>
                        <p className="text-sm font-bold font-mono">{costVariance >= 0 ? `+${formatEuro(costVariance)}` : formatEuro(costVariance)}</p>
                    </div>

                    {/* Excel Upload Control */}
                    <div className="flex flex-col items-end gap-1">
                        <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-2 rounded font-semibold flex items-center gap-1.5 transition-colors shadow">
                            <UploadIcon className="w-4 h-4" />
                            <span>Cargar Fichajes</span>
                            <input 
                                type="file" 
                                accept=".xlsx, .xls, .csv" 
                                onChange={handleFileUpload} 
                                className="hidden" 
                            />
                        </label>
                        {project.actualTimeTracking && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <span className="truncate max-w-[110px]" title={project.actualTimeTracking.fileName}>
                                    📄 {project.actualTimeTracking.fileName}
                                </span>
                                <button 
                                    onClick={handleClearLogs}
                                    className="text-red-400 hover:text-red-300 font-bold px-1"
                                    title="Borrar fichajes importados"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="mt-6 border-t border-gray-700/50 pt-4 animate-fade-in">
                    <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.2s ease-out; }`}</style>
                    
                    {internalMembers.length === 0 ? (
                        <p className="text-center text-gray-500 py-6 italic">
                            Este proyecto no tiene miembros internos asignados.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {internalMembers.map(member => {
                                const mActualLogs = memberActualLogsMap.get(member.contact) || memberActualLogsMap.get(normalizeNameKey(member.name)) || [];

                                return (
                                    <MemberRow 
                                        key={member.contact} 
                                        member={member} 
                                        globalRate={globalRates[member.contact] || 0}
                                        actualLogs={mActualLogs}
                                        projectName={project.name}
                                        availableGlobalMembers={availableGlobalMembers}
                                        onUpdate={(info) => onUpdateInternalCost(project.id, member.contact, info)}
                                        onRemoveLog={handleRemoveSingleLog}
                                        onAddLog={handleAddSingleLogForMember}
                                        onReassignMember={handleReassignMember}
                                        onRenameMember={handleRenameMember}
                                        onRemoveMemberFromProject={handleRemoveMemberFromProject}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* Selector to add member from Recursos */}
                    {unassignedGlobalMembers.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700/60 flex flex-wrap items-center justify-between gap-3 bg-gray-900/40 p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-300">¿Añadir otro recurso existente a este proyecto?</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedAddMemberContact}
                                    onChange={(e) => setSelectedAddMemberContact(e.target.value)}
                                    className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-3 py-1.5 focus:outline-none focus:border-sky-500"
                                >
                                    <option value="">-- Seleccionar Recurso --</option>
                                    {unassignedGlobalMembers.map(m => (
                                        <option key={m.contact} value={m.contact}>
                                            {m.name} ({m.role || 'Recurso Interno'})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    disabled={!selectedAddMemberContact}
                                    onClick={handleAddGlobalMemberToProject}
                                    className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-all"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" /> Añadir al Proyecto
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Monthly Breakdown Modal for Project */}
            {isProjectBreakdownModalOpen && (
                <HoursBreakdownModal
                    title={`Desglose Mensual de Horas e Importes en Euros (€)`}
                    projectName={project.name}
                    actualLogs={actualLogs}
                    teamMembers={project.team}
                    globalRates={globalRates}
                    onClose={() => setIsProjectBreakdownModalOpen(false)}
                />
            )}
        </Card>
    );
};

const InternalTeam: React.FC<InternalTeamProps> = ({ projects, globalRates, availableGlobalMembers = [], onUpdateInternalCost, onUpdateProject }) => {
  
  // Status Filter State
  const [selectedStatuses, setSelectedStatuses] = useState<ProjectStatus[]>([
      ProjectStatus.InProgress,
      ProjectStatus.Completed,
      ProjectStatus.Proposal
  ]);

  const toggleStatus = (status: ProjectStatus) => {
      setSelectedStatuses(prev => {
          if (prev.includes(status)) {
              if (prev.length === 1) return prev; // Keep at least one selected
              return prev.filter(s => s !== status);
          } else {
              return [...prev, status];
          }
      });
  };

  const filteredProjects = useMemo(() => {
      return projects.filter(p => selectedStatuses.includes(p.status));
  }, [projects, selectedStatuses]);
  
  // Handler for importing a multi-project Excel file with INCREMENTAL DE-DUPLICATION and smart member matching
  const handleMultiProjectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const rawLogs = await parseTimeTrackingFile(file);
        if (rawLogs.length === 0) {
            alert("No se encontraron registros de fichaje válidos en el archivo.");
            return;
        }

        // Pass 1: compute what WOULD change per project, without saving
        // anything yet -- the user confirms the totals first.
        type ProjectUpdatePlan = {
            project: Project;
            updatedTeam: TeamMember[];
            mergedLogs: ActualTimeLog[];
            addedCount: number;
            duplicateCount: number;
        };
        const plans: ProjectUpdatePlan[] = [];
        const newGlobalMembersAll: TeamMember[] = [];

        projects.forEach(p => {
            const expName = (p.exportName || '').toLowerCase().trim();
            const pName = p.name.toLowerCase().trim();
            const pCode = p.code.toLowerCase().trim();

            const pLogs = rawLogs.filter(l => {
                const ref = (l.projectNameRef || '').toLowerCase().trim();
                return (expName && ref === expName) || (pName && ref === pName) || (pCode && ref === pCode);
            });

            if (pLogs.length === 0) return;

            const existingLogs = p.actualTimeTracking?.logs || [];
            const { mergedLogs, addedCount, duplicateCount } = mergeAndDeduplicateLogs(existingLogs, pLogs);

            const uniqueEmpNames = Array.from(new Set(pLogs.map(l => l.employeeName)));
            const updatedTeam = [...p.team];

            uniqueEmpNames.forEach(empName => {
                const existingInProject = findMatchingMember(empName, updatedTeam);
                if (existingInProject) return;

                const existingInGlobal = findMatchingMember(empName, [...availableGlobalMembers, ...newGlobalMembersAll]);
                if (existingInGlobal) {
                    updatedTeam.push({ ...existingInGlobal, type: MemberType.Internal });
                    return;
                }

                const key = normalizeNameKey(empName);
                const normalizedContact = (key || 'recurso') + '@internal.com';
                const newMember: TeamMember = {
                    name: empName,
                    role: 'Recurso Interno',
                    contact: normalizedContact,
                    type: MemberType.Internal,
                    internalCostInfo: { hourlyRate: 0, workRanges: [] }
                };
                updatedTeam.push(newMember);
                newGlobalMembersAll.push(newMember);
            });

            plans.push({ project: p, updatedTeam, mergedLogs, addedCount, duplicateCount });
        });

        if (plans.length === 0) {
            alert("No se encontraron coincidencias de proyecto en la Columna A del Excel. Comprueba que el 'Nombre de proyecto para exportar' o Nombre del proyecto coincida con la Columna A.");
            e.target.value = '';
            return;
        }

        const totalNewAdded = plans.reduce((acc, p) => acc + p.addedCount, 0);
        const totalDuplicates = plans.reduce((acc, p) => acc + p.duplicateCount, 0);

        const confirmed = window.confirm(
            `¿Confirmás guardar estos fichajes en la base de datos?\n\n` +
            `• Proyectos vinculados: ${plans.length}\n` +
            `• Registros nuevos a guardar: ${totalNewAdded}\n` +
            `• Duplicados que se omitirán: ${totalDuplicates}\n` +
            `\nEsta acción no se puede deshacer.`
        );
        if (!confirmed) {
            e.target.value = '';
            return;
        }

        // Pass 2: now actually persist each matched project.
        plans.forEach(({ project: p, updatedTeam, mergedLogs }) => {
            const updatedProject: Project = {
                ...p,
                team: updatedTeam,
                actualTimeTracking: {
                    fileName: file.name,
                    uploadedAt: new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    logs: mergedLogs
                }
            };
            if (onUpdateProject) {
                onUpdateProject(updatedProject, newGlobalMembersAll);
            }
        });

        alert(`¡Importación Multiproyecto realizada con éxito!\n\n` +
              `• Proyectos vinculados: ${plans.length}\n` +
              `• Nuevos registros añadidos: ${totalNewAdded}\n` +
              `• Registros duplicados (omitidos): ${totalDuplicates}\n` +
              `• Nuevos recursos creados: ${newGlobalMembersAll.length}`);
    } catch (err) {
        console.error("Error importando fichaje multiproyecto", err);
        alert("Error al leer el archivo Excel/CSV.");
    }

    e.target.value = '';
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                Gestión de Recursos Internos: Proyectado vs Real
            </h1>
            <p className="text-gray-400 mt-2 max-w-3xl text-sm">
                Compara las horas y costes proyectados (rangos estimados) con los <strong>fichajes reales</strong> extraídos de la plataforma de control horario.
            </p>
        </div>

        {/* Global Multi-project upload button */}
        <div className="shrink-0">
            <label className="cursor-pointer bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all hover:scale-105">
                <UploadIcon className="w-4 h-4" />
                <span>Cargar Fichaje Multiproyecto</span>
                <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleMultiProjectFileUpload} 
                    className="hidden" 
                />
            </label>
        </div>
      </div>

      {/* Filter Selector Bar */}
      <div className="bg-gray-800/90 p-4 rounded-xl border border-gray-700 shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-gray-300 tracking-wider">Filtrar por Estado de Proyecto:</span>
                  <span className="text-xs text-gray-400 font-mono">({filteredProjects.length} de {projects.length} mostrados)</span>
              </div>
              <div className="flex gap-2 text-xs">
                  <button 
                      onClick={() => setSelectedStatuses([ProjectStatus.InProgress, ProjectStatus.Completed, ProjectStatus.Proposal])}
                      className="text-sky-400 hover:underline font-medium"
                  >
                      Mostrar Todos
                  </button>
                  <span className="text-gray-600">|</span>
                  <button 
                      onClick={() => setSelectedStatuses([ProjectStatus.InProgress])}
                      className="text-gray-400 hover:text-white"
                  >
                      Solo en Proceso
                  </button>
                  <span className="text-gray-600">|</span>
                  <button 
                      onClick={() => setSelectedStatuses([ProjectStatus.Completed])}
                      className="text-gray-400 hover:text-white"
                  >
                      Solo Finalizados
                  </button>
                  <span className="text-gray-600">|</span>
                  <button 
                      onClick={() => setSelectedStatuses([ProjectStatus.Proposal])}
                      className="text-gray-400 hover:text-white"
                  >
                      Solo Propuestas
                  </button>
              </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
              {[
                  { status: ProjectStatus.InProgress, label: 'Proyectos en Proceso', color: 'sky' },
                  { status: ProjectStatus.Completed, label: 'Proyectos Finalizados', color: 'green' },
                  { status: ProjectStatus.Proposal, label: 'Propuestas', color: 'amber' },
              ].map(item => {
                  const isSelected = selectedStatuses.includes(item.status);
                  const count = projects.filter(p => p.status === item.status).length;

                  return (
                      <button
                          key={item.status}
                          onClick={() => toggleStatus(item.status)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition-all ${
                              isSelected
                                  ? item.color === 'sky' ? 'bg-sky-600/90 text-white border-sky-400 shadow-md shadow-sky-900/30' :
                                    item.color === 'green' ? 'bg-emerald-600/90 text-white border-emerald-400 shadow-md shadow-emerald-900/30' :
                                    'bg-amber-600/90 text-white border-amber-400 shadow-md shadow-amber-900/30'
                                  : 'bg-gray-900/60 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200'
                          }`}
                      >
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-500'}`}></span>
                          <span>{item.label}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              isSelected ? 'bg-black/30 text-white' : 'bg-gray-800 text-gray-400'
                          }`}>
                              {count}
                          </span>
                      </button>
                  );
              })}
          </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {filteredProjects.map(project => (
            <ProjectSection 
                key={project.id} 
                project={project} 
                globalRates={globalRates}
                availableGlobalMembers={availableGlobalMembers}
                onUpdateInternalCost={onUpdateInternalCost} 
                onUpdateProject={onUpdateProject}
            />
        ))}
        {filteredProjects.length === 0 && (
             <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700 border-dashed">
                <p className="text-gray-400 text-base">No hay proyectos que coincidan con los estados seleccionados.</p>
                <button 
                    onClick={() => setSelectedStatuses([ProjectStatus.InProgress, ProjectStatus.Completed, ProjectStatus.Proposal])}
                    className="mt-3 text-xs text-sky-400 hover:underline font-bold"
                >
                    Restablecer filtros para ver todos los proyectos
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default InternalTeam;
