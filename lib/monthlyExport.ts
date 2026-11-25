import type { Project } from '../types';
import { ProjectStatus, InvoiceSource } from '../types';

// Same CSV-export logic as components/Dashboard.tsx's handleExportMonthlySummary,
// extracted so ExecutiveDashboard.tsx can offer it too without touching that
// frozen component (components/ stays untouched).

const parseDateLocal = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
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

const getBusinessDaysInMonth = (startDate: string, endDate: string, targetMonth: string): number => {
  const [y, m] = targetMonth.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);
  const rangeStart = parseDateLocal(startDate);
  const rangeEnd = parseDateLocal(endDate);
  if (!rangeStart || !rangeEnd) return 0;
  const intersectionStart = new Date(Math.max(monthStart.getTime(), rangeStart.getTime()));
  const intersectionEnd = new Date(Math.min(monthEnd.getTime(), rangeEnd.getTime()));
  if (intersectionStart > intersectionEnd) return 0;
  let count = 0;
  const cur = new Date(intersectionStart);
  while (cur <= intersectionEnd) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const calculateHoursInMonth = (range: any, targetMonth: string): number => {
  const totalBusinessDays = getBusinessDays(range.startDate, range.endDate);
  if (totalBusinessDays === 0) return 0;
  const monthBusinessDays = getBusinessDaysInMonth(range.startDate, range.endDate, targetMonth);
  if (monthBusinessDays === 0) return 0;
  if (range.manualHours !== undefined && range.manualHours !== null && range.manualHours > 0) {
    return (range.manualHours / totalBusinessDays) * monthBusinessDays;
  }
  const proportionalHolidays = (range.holidaysCount || 0) * (monthBusinessDays / totalBusinessDays);
  const netDays = Math.max(0, monthBusinessDays - proportionalHolidays);
  return netDays * 8 * (range.dedicationPercentage / 100);
};

export function exportMonthlySummary(projects: Project[], internalRates: Record<string, number>, exportMonth: string): void {
  if (!exportMonth) return;

  try {
    const monthsToInclude = [exportMonth];
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const rows: string[][] = [[
      'Periodo/tipo',
      'Proyecto (Exportación)',
      'Cliente/Equipo (Interno o Externo)',
      'Importe acuerdo',
      'Porcentaje',
      'Horas Deltana (solo para equipo interno)',
      'Total Factura o total estimación',
      'Fecha',
      'Código',
      'Proyecto',
      'Concepto / Nº Factura',
      'Estado',
      'Resta por facturar en meses siguientes',
      'Estimación del Mes',
      'Facturado del Mes'
    ]];

    projects
      .filter((p) => p.status !== ProjectStatus.Proposal)
      .forEach((p) => {
        // --- CLIENT INCOME LOGIC ---
        if (p.clientInfo) {
          const agreementBudget = p.clientInfo.agreement?.amount || 0;
          const totalExtrasBudget = p.clientInfo.additionals?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
          const totalBudget = agreementBudget + totalExtrasBudget;

          const invoicedBeforeStart = (p.clientInfo.invoices || [])
            .filter((inv) => inv.date && inv.date < exportMonth)
            .reduce((sum, inv) => sum + (inv.amount || 0), 0);

          let runningClientPending = totalBudget - invoicedBeforeStart;

          monthsToInclude.forEach((m) => {
            const [y, monthIdx] = m.split('-').map(Number);
            const periodLabel = `Presupuesto Proyectos ${monthNames[monthIdx - 1]} ${y} (Ingresos)`;

            const getExtraBudget = (src: string | undefined): number => {
              if (!src) return 0;
              if (src.startsWith('Adicional ')) {
                const idx = parseInt(src.split(' ')[1], 10) - 1;
                if (idx >= 0 && p.clientInfo!.additionals && p.clientInfo!.additionals[idx]) {
                  return p.clientInfo!.additionals[idx].amount || 0;
                }
              }
              return 0;
            };

            const agreementInvoices = (p.clientInfo!.invoices || []).filter((inv) => inv.date && inv.date.startsWith(m) && (inv.source || InvoiceSource.Agreement) === InvoiceSource.Agreement);
            const agreementPlanned = (p.clientInfo!.plannedInvoices || []).filter((inv) => inv.date && inv.date.startsWith(m) && (inv.source || InvoiceSource.Agreement) === InvoiceSource.Agreement);

            let agreementEvent: any = null;
            if (agreementInvoices.length > 0) {
              agreementEvent = {
                desc: agreementInvoices.map((inv) => `Factura ${inv.id || ''}`).join(', '),
                status: 'Emitida',
                amount: agreementInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
                date: agreementInvoices[0].date,
                percentage: agreementInvoices.reduce((sum, inv) => sum + (inv.percentage || 0), 0)
              };
            } else if (agreementPlanned.length > 0) {
              agreementEvent = {
                desc: agreementPlanned.map((inv) => inv.description || '').join(', '),
                status: 'Pendiente de Emitir',
                amount: agreementPlanned.reduce((sum, inv) => sum + (inv.amount || 0), 0),
                date: agreementPlanned[0].date,
                percentage: agreementPlanned.reduce((sum, inv) => sum + (inv.percentage || 0), 0)
              };
            }

            if (agreementEvent) {
              runningClientPending -= agreementEvent.amount;
              rows.push([
                periodLabel,
                p.exportName || p.name,
                p.client || '',
                agreementBudget.toFixed(2).replace('.', ','),
                (agreementEvent.percentage / 100).toString().replace('.', ','),
                '',
                agreementEvent.amount.toString().replace('.', ','),
                agreementEvent.date,
                p.code || '',
                p.name || '',
                agreementEvent.desc,
                agreementEvent.status,
                Math.max(0, runningClientPending).toFixed(2).replace('.', ','),
                agreementEvent.status === 'Pendiente de Emitir' ? agreementEvent.amount.toFixed(2).replace('.', ',') : '0,00',
                agreementEvent.status === 'Emitida' ? agreementEvent.amount.toFixed(2).replace('.', ',') : '0,00'
              ]);
            }

            const extrasInvoices = (p.clientInfo!.invoices || []).filter((inv) => inv.date && inv.date.startsWith(m) && (inv.source || InvoiceSource.Agreement) !== InvoiceSource.Agreement);
            const extrasPlanned = (p.clientInfo!.plannedInvoices || []).filter((inv) => inv.date && inv.date.startsWith(m) && (inv.source || InvoiceSource.Agreement) !== InvoiceSource.Agreement);

            extrasInvoices.forEach((inv) => {
              runningClientPending -= inv.amount;
              const extraBudget = getExtraBudget(inv.source) || inv.amount;
              rows.push([
                periodLabel,
                p.exportName || p.name,
                p.client || '',
                extraBudget.toFixed(2).replace('.', ','),
                ((inv.percentage || 0) / 100).toString().replace('.', ','),
                '',
                inv.amount.toString().replace('.', ','),
                inv.date,
                p.code || '',
                p.name || '',
                `Factura ${inv.id || ''} (${inv.source || 'Extra'})`,
                'Emitida',
                Math.max(0, runningClientPending).toFixed(2).replace('.', ','),
                '0,00',
                inv.amount.toFixed(2).replace('.', ',')
              ]);
            });

            extrasPlanned.forEach((inv) => {
              runningClientPending -= inv.amount;
              const extraBudget = getExtraBudget(inv.source) || inv.amount;
              rows.push([
                periodLabel,
                p.exportName || p.name,
                p.client || '',
                extraBudget.toFixed(2).replace('.', ','),
                ((inv.percentage || 0) / 100).toString().replace('.', ','),
                '',
                inv.amount.toString().replace('.', ','),
                inv.date,
                p.code || '',
                p.name || '',
                `${inv.description || ''} (${inv.source || 'Extra'})`,
                'Pendiente de Emitir',
                Math.max(0, runningClientPending).toFixed(2).replace('.', ','),
                inv.amount.toFixed(2).replace('.', ','),
                '0,00'
              ]);
            });
          });
        }

        // --- TEAM LOGIC (COLLABORATORS & INTERNAL) ---
        (p.team || []).forEach((m) => {
          if (m.collaboratorInfo) {
            const collabBudget = (m.collaboratorInfo.agreement?.amount || 0) + (m.collaboratorInfo.additionals?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0);

            const monthlyTotals = monthsToInclude.reduce((acc, month) => {
              acc[month] = {
                planned: (m.collaboratorInfo!.plannedInvoices || [])
                  .filter((inv) => inv.date && inv.date.startsWith(month))
                  .reduce((sum, inv) => sum + (inv.amount || 0), 0),
                invoiced: (m.collaboratorInfo!.invoices || [])
                  .filter((inv) => inv.date && inv.date.startsWith(month))
                  .reduce((sum, inv) => sum + (inv.amount || 0), 0)
              };
              return acc;
            }, {} as Record<string, { planned: number; invoiced: number }>);

            const invoicedBeforeStart = (m.collaboratorInfo.invoices || [])
              .filter((inv) => inv.date && inv.date < exportMonth)
              .reduce((sum, inv) => sum + (inv.amount || 0), 0);

            let runningCollabPending = collabBudget - invoicedBeforeStart;

            monthsToInclude.forEach((month) => {
              const monthInvoices = (m.collaboratorInfo!.invoices || []).filter((inv) => inv.date && inv.date.startsWith(month));
              const monthPlanned = (m.collaboratorInfo!.plannedInvoices || []).filter((inv) => inv.date && inv.date.startsWith(month));

              let eventToExport: { desc: string; status: string; amount: number; date: string; percentage: number } | null = null;

              if (monthInvoices.length > 0) {
                eventToExport = {
                  desc: monthInvoices.map((inv) => `Factura ${inv.id || ''}`).join(', '),
                  status: 'Recibida',
                  amount: monthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
                  date: monthInvoices[0].date,
                  percentage: monthInvoices.reduce((sum, inv) => sum + (inv.percentage || 0), 0)
                };
              } else if (monthPlanned.length > 0) {
                eventToExport = {
                  desc: monthPlanned.map((inv) => inv.description || '').join(', '),
                  status: 'Pendiente',
                  amount: monthPlanned.reduce((sum, inv) => sum + (inv.amount || 0), 0),
                  date: monthPlanned[0].date,
                  percentage: monthPlanned.reduce((sum, inv) => sum + (inv.percentage || 0), 0)
                };
              }

              if (eventToExport) {
                runningCollabPending -= eventToExport.amount;
                const [y, monthIdx] = month.split('-').map(Number);
                const periodLabel = `Presupuesto Proyectos ${monthNames[monthIdx - 1]} ${y} (Gastos)`;

                rows.push([
                  periodLabel,
                  p.exportName || p.name,
                  m.name || '',
                  collabBudget.toFixed(2).replace('.', ','),
                  (eventToExport.percentage / 100).toString().replace('.', ','),
                  '',
                  eventToExport.amount.toString().replace('.', ','),
                  eventToExport.date,
                  p.code || '',
                  p.name || '',
                  eventToExport.desc,
                  eventToExport.status,
                  Math.max(0, runningCollabPending).toFixed(2).replace('.', ','),
                  monthlyTotals[month].planned.toFixed(2).replace('.', ','),
                  monthlyTotals[month].invoiced.toFixed(2).replace('.', ',')
                ]);
              }
            });
          }

          if (m.internalCostInfo && !m.internalCostInfo.excludeFromActualTotal) {
            const info = m.internalCostInfo;
            const rate = info && info.hourlyRate > 0 ? info.hourlyRate : internalRates[m.contact] || 0;

            monthsToInclude.forEach((month) => {
              const [y, mIdx] = month.split('-').map(Number);
              const periodLabel = `Presupuesto Proyectos ${monthNames[mIdx - 1]} ${y} (Gastos)`;

              let monthHours = 0;

              (info.workRanges || []).forEach((range) => {
                const hours = calculateHoursInMonth(range, month);
                if (hours > 0) {
                  monthHours += hours;
                }
              });

              if (monthHours > 0) {
                const monthCost = monthHours * rate;

                rows.push([
                  periodLabel,
                  p.exportName || p.name,
                  m.internalMemberType || m.name || '',
                  '0,00',
                  '0,00',
                  monthHours.toFixed(2).replace('.', ','),
                  monthCost.toFixed(2).replace('.', ','),
                  `${month}-01`,
                  p.code || '',
                  p.name || '',
                  `Coste Interno - ${m.name}`,
                  'Asignado',
                  '',
                  '',
                  ''
                ]);
              }
            });
          }
        });
      });

    const csvContent = '﻿' + rows.map((e) => e.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Resumen_Mensual_${exportMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Hubo un error al generar el Excel. Por favor, revisa los datos de los proyectos.');
  }
}
