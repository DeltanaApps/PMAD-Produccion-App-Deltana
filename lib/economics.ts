import type { Project, InternalWorkRange } from '../types';
import { MemberType, ProjectStatus } from '../types';

// Same date/hour math as components/EconomicTracking.tsx (kept in sync
// deliberately, not imported from there — components/ stays untouched).

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
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const calculateCapacityHours = (startDate: string, endDate: string, holidays: number): number => {
  const businessDays = getBusinessDays(startDate, endDate);
  const actualWorkDays = Math.max(0, businessDays - (holidays || 0));
  return actualWorkDays * 8;
};

export const calculateRangeHours = (range: InternalWorkRange): number => {
  if (range.manualHours !== undefined && range.manualHours !== null && range.manualHours > 0) {
    return range.manualHours;
  }
  const capacity = calculateCapacityHours(range.startDate, range.endDate, range.holidaysCount);
  return capacity * (range.dedicationPercentage / 100);
};

export interface ProjectFinancials {
  project: Project;
  totalBudget: number;
  projectedInternalCosts: number;
  actualInternalCosts: number;
  externalCosts: number;
  projectedProfit: number;
  projectedProfitPercentage: number;
  actualProfit: number;
  actualProfitPercentage: number;
  totalInvoiced: number;
}

export function computeProjectFinancials(project: Project, globalRates: Record<string, number>): ProjectFinancials {
  const baseBudget = project.clientInfo?.agreement.amount || 0;
  const additionalsBudget = project.clientInfo?.additionals.reduce((acc, curr) => acc + curr.amount, 0) || 0;
  // While still a Proposal there's no client agreement yet, so the manager's
  // estimated "Precio de la Propuesta" stands in as the Presupuesto.
  const totalBudget = project.status === ProjectStatus.Proposal
    ? (project.proposalPrice || 0)
    : baseBudget + additionalsBudget;

  let projectedInternalCosts = 0;
  const internalMembers = project.team.filter((m) => m.type === MemberType.Internal);
  internalMembers.forEach((m) => {
    const info = m.internalCostInfo;
    if (info?.excludeFromActualTotal) return;
    const rate = info && info.hourlyRate > 0 ? info.hourlyRate : globalRates[m.contact] || 0;
    const totalMemberHours = (info?.workRanges || []).reduce((hAcc, r) => hAcc + calculateRangeHours(r), 0);
    projectedInternalCosts += totalMemberHours * rate;
  });

  let actualInternalCosts = 0;
  const actualLogs = project.actualTimeTracking?.logs || [];
  internalMembers.forEach((m) => {
    const info = m.internalCostInfo;
    if (info?.excludeFromActualTotal) return;
    const key = m.name.toLowerCase().trim();
    const mLogs = actualLogs.filter((l) => l.employeeName.toLowerCase().trim() === key);
    const mHours = mLogs.reduce((acc, l) => acc + l.hours, 0);
    const rate = info && info.hourlyRate > 0 ? info.hourlyRate : globalRates[m.contact] || 0;
    actualInternalCosts += mHours * rate;
  });

  let externalCosts = 0;
  const externalMembers = project.team.filter((m) => m.type === MemberType.External);
  externalMembers.forEach((m) => {
    const info = m.collaboratorInfo;
    if (info) {
      const base = info.agreement.amount || 0;
      const extras = info.additionals.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      externalCosts += base + extras;
    }
  });

  const projectedTotalCosts = projectedInternalCosts + externalCosts;
  const projectedProfit = totalBudget - projectedTotalCosts;
  const projectedProfitPercentage = totalBudget > 0 ? (projectedProfit / totalBudget) * 100 : 0;

  const actualTotalCosts = actualInternalCosts + externalCosts;
  const actualProfit = totalBudget - actualTotalCosts;
  const actualProfitPercentage = totalBudget > 0 ? (actualProfit / totalBudget) * 100 : 0;

  const totalInvoiced = project.clientInfo?.invoices.reduce((acc, inv) => acc + inv.amount, 0) || 0;

  return {
    project,
    totalBudget,
    projectedInternalCosts,
    actualInternalCosts,
    externalCosts,
    projectedProfit,
    projectedProfitPercentage,
    actualProfit,
    actualProfitPercentage,
    totalInvoiced,
  };
}

export function computePortfolioFinancials(projects: Project[], globalRates: Record<string, number>): ProjectFinancials[] {
  return projects
    .filter((p) => p.status !== ProjectStatus.Proposal)
    .map((p) => computeProjectFinancials(p, globalRates));
}
