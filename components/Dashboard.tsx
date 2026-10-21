
import React, { useMemo, useState } from 'react';
import type { Project } from '../types';
import { ProjectStatus, InvoiceSource } from '../types';
import Card from './ui/Card';
import { MoneyIcon, TrophyIcon, TrendingUpIcon, TeamIcon, ProjectsIcon, DownloadIcon } from './ui/Icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  projects: Project[];
  internalRates: Record<string, number>;
}

type ModalType = 'TOP_CLIENT' | 'PENDING_PAYMENT' | 'TOP_COLLABORATOR' | 'PENDING_BILLING' | null;

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const DashboardModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
        <style>{`.animate-fade-in { animation: fade-in 0.2s ease-out; } @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col p-0 shadow-2xl border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-lg">
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-900 rounded-b-lg">
                {children}
            </div>
        </Card>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ projects, internalRates }) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7)); // Default YYYY-MM

  // Custom formatter to make Euro symbol smaller and distinct
  const formatEuro = (amount: number) => (
    <span className="font-mono flex items-center gap-0.5 justify-end">
      {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}
      <span className="text-xs text-gray-400">€</span>
    </span>
  );

  // 1. KPI Calculation
  const stats = useMemo(() => {
    let totalAgreementBudget = 0;
    let totalExtrasBudget = 0;
    let totalAgreementInvoiced = 0;
    let totalExtrasInvoiced = 0;
    let totalPendingPayCollaborators = 0;
    
    // Maps for counters
    const clientCount: Record<string, number> = {};
    const collaboratorCount: Record<string, number> = {};

    const activeProjects = projects.filter(p => p.status === ProjectStatus.InProgress);

    // Calculate financials and general stats
    projects.filter(p => p.status !== ProjectStatus.Proposal).forEach(p => {
        // Financials (Income)
        if (p.clientInfo) {
            const agreementAmount = p.clientInfo.agreement.amount || 0;
            const extrasAmount = p.clientInfo.additionals.reduce((sum, a) => sum + (a.amount || 0), 0);
            
            totalAgreementBudget += agreementAmount;
            totalExtrasBudget += extrasAmount;

            p.clientInfo.invoices.forEach(i => {
                const source = i.source || InvoiceSource.Agreement;
                if (source !== InvoiceSource.Agreement) {
                    totalExtrasInvoiced += i.amount;
                } else {
                    totalAgreementInvoiced += i.amount;
                }
            });
        }

        // Financials (Outcome - Collaborators)
        p.team.forEach(m => {
            if (m.collaboratorInfo) {
                const agreed = m.collaboratorInfo.agreement.amount;
                const extras = m.collaboratorInfo.additionals.reduce((sum, add) => sum + add.amount, 0);
                const billed = m.collaboratorInfo.invoices.reduce((sum, inv) => sum + inv.amount, 0);
                totalPendingPayCollaborators += (agreed + extras) - billed;
            }
        });

        // Client Count
        clientCount[p.client] = (clientCount[p.client] || 0) + 1;
    });

    // Collaborator Activity 
    activeProjects.forEach(p => {
        p.team.forEach(m => {
             const role = m.role.toLowerCase();
             const name = m.name.toLowerCase();
             
             const isGestor = role.includes('gestor');
             const isCoordinador = role.includes('coordinador');
             const isRoberto = name.includes('roberto');

             // Exclude if Gestor.
             // Exclude if Coordinator UNLESS it is Roberto.
             const shouldExclude = isGestor || (isCoordinador && !isRoberto);

             if (!shouldExclude) {
                collaboratorCount[m.name] = (collaboratorCount[m.name] || 0) + 1;
             }
        });
    });

    // Find Max Client
    const topClientEntry = Object.entries(clientCount).sort((a, b) => b[1] - a[1])[0];
    const topClient = topClientEntry ? { name: topClientEntry[0], count: topClientEntry[1] } : { name: 'N/A', count: 0 };

    // Find Top Collaborator
    const topCollaboratorEntry = Object.entries(collaboratorCount).sort((a, b) => b[1] - a[1])[0];
    const topCollaborator = topCollaboratorEntry ? { name: topCollaboratorEntry[0], count: topCollaboratorEntry[1] } : { name: 'N/A', count: 0 };
    
    // Top 5 Big Contracts (Recent/Active)
    const topContracts = projects
        .filter(p => p.status !== ProjectStatus.Proposal && p.clientInfo)
        .map(p => {
            const agreement = p.clientInfo?.agreement.amount || 0;
            const extras = p.clientInfo?.additionals.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
            return { ...p, totalBudget: agreement + extras };
        })
        .filter(p => p.totalBudget > 0)
        .sort((a, b) => b.totalBudget - a.totalBudget)
        .slice(0, 5);

    // Prepare Chart Data for Collaborators (Top 5)
    const collaboratorChartData = Object.entries(collaboratorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name: name.split(' ')[0], fullName: name, projects: count }));

    const totalBudget = totalAgreementBudget + totalExtrasBudget;
    const totalInvoiced = totalAgreementInvoiced + totalExtrasInvoiced;
    const pendingBilling = totalBudget - totalInvoiced;
    const pendingAgreement = totalAgreementBudget - totalAgreementInvoiced;
    const pendingExtras = totalExtrasBudget - totalExtrasInvoiced;

    return {
        totalRevenue: totalBudget,
        totalInvoiced: totalInvoiced,
        agreementBudget: totalAgreementBudget,
        extrasBudget: totalExtrasBudget,
        agreementInvoiced: totalAgreementInvoiced,
        extrasInvoiced: totalExtrasInvoiced,
        pendingBilling: pendingBilling,
        pendingAgreement: pendingAgreement,
        pendingExtras: pendingExtras,
        pendingPaymentCollaborators: totalPendingPayCollaborators,
        topClient,
        topCollaborator,
        topContracts,
        collaboratorChartData,
        // Percentages of the PENDING amount (for the dashboard card)
        agreementPendingPercent: pendingBilling > 0 ? (pendingAgreement / pendingBilling) * 100 : 0,
        extrasPendingPercent: pendingBilling > 0 ? (pendingExtras / pendingBilling) * 100 : 0,
        // Overall progress (for reference)
        agreementProgressPercent: totalAgreementBudget > 0 ? (totalAgreementInvoiced / totalAgreementBudget) * 100 : 0,
        extrasProgressPercent: totalExtrasBudget > 0 ? (totalExtrasInvoiced / totalExtrasBudget) * 100 : 0,
        totalPercent: totalBudget > 0 ? (totalInvoiced / totalBudget) * 100 : 0
    };
  }, [projects]);

  // --- CSV EXPORT LOGIC ---
  const handleExportMonthlySummary = () => {
    if (!exportMonth) return;

    try {
        const monthsToInclude = [exportMonth];
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        // --- HELPERS FOR INTERNAL HOURS ---
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

        const rows = [[
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
            .filter(p => p.status !== ProjectStatus.Proposal)
            .forEach(p => {
            // --- CLIENT INCOME LOGIC ---
            if (p.clientInfo) {
                const agreementBudget = p.clientInfo.agreement?.amount || 0;
                const totalExtrasBudget = p.clientInfo.additionals?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
                const totalBudget = agreementBudget + totalExtrasBudget;

                const invoicedBeforeStart = (p.clientInfo.invoices || [])
                    .filter(inv => inv.date && inv.date < exportMonth)
                    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
                
                let runningClientPending = totalBudget - invoicedBeforeStart;

                monthsToInclude.forEach(m => {
                    const [y, monthIdx] = m.split('-').map(Number);
                    const periodLabel = `Presupuesto Proyectos ${monthNames[monthIdx-1]} ${y} (Ingresos)`;

                    // Helper to get corresponding extra budget
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

                    // 1. Agreement Invoices/Planned
                    const agreementInvoices = (p.clientInfo!.invoices || []).filter(inv => inv.date && inv.date.startsWith(m) && (inv.source || InvoiceSource.Agreement) === InvoiceSource.Agreement);
                    const agreementPlanned = (p.clientInfo!.plannedInvoices || []).filter(inv => inv.date && inv.date.startsWith(m) && (inv.source || InvoiceSource.Agreement) === InvoiceSource.Agreement);

                    let agreementEvent: any = null;
                    if (agreementInvoices.length > 0) {
                        agreementEvent = {
                            desc: agreementInvoices.map(inv => `Factura ${inv.id || ''}`).join(', '),
                            status: 'Emitida',
                            amount: agreementInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
                            date: agreementInvoices[0].date,
                            percentage: agreementInvoices.reduce((sum, inv) => sum + (inv.percentage || 0), 0)
                        };
                    } else if (agreementPlanned.length > 0) {
                        agreementEvent = {
                            desc: agreementPlanned.map(inv => inv.description || '').join(', '),
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

                    // 2. Extras Invoices/Planned (Separate lines)
                    const extrasInvoices = (p.clientInfo!.invoices || []).filter(inv => inv.date && inv.date.startsWith(m) && (inv.source || InvoiceSource.Agreement) !== InvoiceSource.Agreement);
                    const extrasPlanned = (p.clientInfo!.plannedInvoices || []).filter(inv => inv.date && inv.date.startsWith(m) && (inv.source || InvoiceSource.Agreement) !== InvoiceSource.Agreement);

                    extrasInvoices.forEach(inv => {
                        runningClientPending -= inv.amount;
                        const extraBudget = getExtraBudget(inv.source) || inv.amount;
                        rows.push([
                            periodLabel,
                            p.exportName || p.name,
                            p.client || '',
                            extraBudget.toFixed(2).replace('.', ','), // Agreement Amount = Corresponding Extra Budget
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

                    extrasPlanned.forEach(inv => {
                        runningClientPending -= inv.amount;
                        const extraBudget = getExtraBudget(inv.source) || inv.amount;
                        rows.push([
                            periodLabel,
                            p.exportName || p.name,
                            p.client || '',
                            extraBudget.toFixed(2).replace('.', ','), // Agreement Amount = Corresponding Extra Budget
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
            (p.team || []).forEach(m => {
                // COLLABORATORS (EXTERNAL)
                if (m.collaboratorInfo) {
                    const collabBudget = (m.collaboratorInfo.agreement?.amount || 0) + (m.collaboratorInfo.additionals?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0);
                    
                    const monthlyTotals = monthsToInclude.reduce((acc, month) => {
                        acc[month] = {
                            planned: (m.collaboratorInfo!.plannedInvoices || [])
                                .filter(inv => inv.date && inv.date.startsWith(month))
                                .reduce((sum, inv) => sum + (inv.amount || 0), 0),
                            invoiced: (m.collaboratorInfo!.invoices || [])
                                .filter(inv => inv.date && inv.date.startsWith(month))
                                .reduce((sum, inv) => sum + (inv.amount || 0), 0)
                        };
                        return acc;
                    }, {} as Record<string, {planned: number, invoiced: number}>);

                    const invoicedBeforeStart = (m.collaboratorInfo.invoices || [])
                        .filter(inv => inv.date && inv.date < exportMonth)
                        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
                    
                    let runningCollabPending = collabBudget - invoicedBeforeStart;

                    monthsToInclude.forEach(month => {
                        const monthInvoices = (m.collaboratorInfo!.invoices || []).filter(inv => inv.date && inv.date.startsWith(month));
                        const monthPlanned = (m.collaboratorInfo!.plannedInvoices || []).filter(inv => inv.date && inv.date.startsWith(month));

                        let eventToExport: { desc: string, status: string, amount: number, date: string, percentage: number } | null = null;

                        if (monthInvoices.length > 0) {
                            eventToExport = {
                                desc: monthInvoices.map(inv => `Factura ${inv.id || ''}`).join(', '),
                                status: 'Recibida',
                                amount: monthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
                                date: monthInvoices[0].date,
                                percentage: monthInvoices.reduce((sum, inv) => sum + (inv.percentage || 0), 0)
                            };
                        } else if (monthPlanned.length > 0) {
                            eventToExport = {
                                desc: monthPlanned.map(inv => inv.description || '').join(', '),
                                status: 'Pendiente',
                                amount: monthPlanned.reduce((sum, inv) => sum + (inv.amount || 0), 0),
                                date: monthPlanned[0].date,
                                percentage: monthPlanned.reduce((sum, inv) => sum + (inv.percentage || 0), 0)
                            };
                        }

                        if (eventToExport) {
                            runningCollabPending -= eventToExport.amount;
                            const [y, monthIdx] = month.split('-').map(Number);
                            const periodLabel = `Presupuesto Proyectos ${monthNames[monthIdx-1]} ${y} (Gastos)`;

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

                // INTERNAL TEAM MEMBERS
                if (m.internalCostInfo) {
                    const info = m.internalCostInfo;
                    const rate = (info && info.hourlyRate > 0) ? info.hourlyRate : (internalRates[m.contact] || 0);

                    monthsToInclude.forEach(month => {
                        const [y, mIdx] = month.split('-').map(Number);
                        const periodLabel = `Presupuesto Proyectos ${monthNames[mIdx-1]} ${y} (Gastos)`;

                        let monthHours = 0;
                        let avgPercentage = 0;
                        let rangesInMonth = 0;

                        (info.workRanges || []).forEach(range => {
                            const hours = calculateHoursInMonth(range, month);
                            if (hours > 0) {
                                monthHours += hours;
                                avgPercentage += range.dedicationPercentage;
                                rangesInMonth++;
                            }
                        });

                        if (monthHours > 0) {
                            const monthCost = monthHours * rate;

                            rows.push([
                                periodLabel,
                                p.exportName || p.name,
                                m.internalMemberType || m.name || '',
                                '0,00', // No agreement for internal
                                '0,00', // Percentage 0 for internal
                                monthHours.toFixed(2).replace('.', ','),
                                monthCost.toFixed(2).replace('.', ','),
                                `${month}-01`, // Generic date for internal
                                p.code || '',
                                p.name || '',
                                `Coste Interno - ${m.name}`,
                                'Asignado',
                                '', // No pending logic for internal
                                '', // No monthly totals logic for internal
                                ''
                            ]);
                        }
                    });
                }
            });
        });

        const csvContent = "\uFEFF" + rows.map(e => e.join(";")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Resumen_Mensual_${exportMonth}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Error exporting CSV:", error);
        alert("Hubo un error al generar el Excel. Por favor, revisa los datos de los proyectos.");
    }
  };

  // --- MODAL CONTENT RENDERERS ---

  const renderTopClientModal = () => {
    const clientProjects = projects.filter(p => p.client === stats.topClient.name);
    return (
        <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-800">
                <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Proyecto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acuerdo</th>
                    <th className="px-4 py-3 text-right">Extras</th>
                </tr>
            </thead>
            <tbody>
                {clientProjects.map(p => {
                    const agreementAmount = p.clientInfo?.agreement.amount || 0;
                    const extrasAmount = p.clientInfo?.additionals.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
                    return (
                        <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-4 py-3 font-mono text-sky-400">{p.code}</td>
                            <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                            <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                    p.status === ProjectStatus.InProgress ? 'bg-sky-500/20 text-sky-300' :
                                    p.status === ProjectStatus.Completed ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'
                                }`}>{p.status}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                                {formatEuro(agreementAmount)}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {formatEuro(extrasAmount)}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
  };

  const renderPendingPaymentModal = () => {
      // Find all collaborators with pending payments
      const pendingItems: Array<{ collaborator: string, project: string, code: string, pending: number }> = [];
      
      projects.forEach(p => {
          p.team.forEach(m => {
              if (m.collaboratorInfo) {
                  const agreed = m.collaboratorInfo.agreement.amount;
                  const extras = m.collaboratorInfo.additionals.reduce((sum, add) => sum + add.amount, 0);
                  const billed = m.collaboratorInfo.invoices.reduce((sum, inv) => sum + inv.amount, 0);
                  const pending = (agreed + extras) - billed;
                  
                  if (pending > 1) { // Filter out negligible amounts
                      pendingItems.push({
                          collaborator: m.name,
                          project: p.name,
                          code: p.code,
                          pending
                      });
                  }
              }
          });
      });

      // Sort by pending amount desc
      pendingItems.sort((a, b) => b.pending - a.pending);

      return (
        <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-800">
                <tr>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Proyecto</th>
                    <th className="px-4 py-3 text-right">Pendiente de Pago</th>
                </tr>
            </thead>
            <tbody>
                {pendingItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-bold text-white">{item.collaborator}</td>
                        <td className="px-4 py-3">
                            <div className="flex flex-col">
                                <span>{item.project}</span>
                                <span className="text-xs font-mono text-gray-600">{item.code}</span>
                            </div>
                        </td>
                        <td className="px-4 py-3 text-right text-red-400 font-bold">
                            {formatEuro(item.pending)}
                        </td>
                    </tr>
                ))}
                {pendingItems.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4">No hay pagos pendientes registrados.</td></tr>
                )}
            </tbody>
        </table>
      );
  };

  const renderTopCollaboratorModal = () => {
      const projectsWithCollaborator = projects.filter(p => 
        p.status === ProjectStatus.InProgress && 
        p.team.some(m => m.name === stats.topCollaborator.name)
      );

      return (
        <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-800">
                <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Proyecto Activo</th>
                    <th className="px-4 py-3">Rol Desempeñado</th>
                </tr>
            </thead>
            <tbody>
                {projectsWithCollaborator.map(p => {
                    const member = p.team.find(m => m.name === stats.topCollaborator.name);
                    return (
                        <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-4 py-3 font-mono text-pink-400">{p.code}</td>
                            <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                            <td className="px-4 py-3">{member?.role || '-'}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
      );
  };

  const renderPendingBillingModal = () => {
      // 1. Gather all Planned Invoices (Facturas Por Emitir)
      const forecast: Record<string, { agreement: number, extras: number }> = {};
      let totalPlannedAgreement = 0;
      let totalPlannedExtras = 0;

      projects.forEach(p => {
          if (p.clientInfo && p.clientInfo.plannedInvoices) {
              p.clientInfo.plannedInvoices.forEach(inv => {
                   const isExtra = inv.source && inv.source !== InvoiceSource.Agreement;
                   // Group by YYYY-MM
                   const key = inv.date ? inv.date.substring(0, 7) : 'Sin Fecha';
                   
                   if (!forecast[key]) forecast[key] = { agreement: 0, extras: 0 };
                   
                   if (isExtra) {
                       forecast[key].extras += inv.amount;
                       totalPlannedExtras += inv.amount;
                   } else {
                       forecast[key].agreement += inv.amount;
                       totalPlannedAgreement += inv.amount;
                   }
              });
          }
      });

      const totalPlannedAmount = totalPlannedAgreement + totalPlannedExtras;
      const unplannedAmount = stats.pendingBilling - totalPlannedAmount;

      const sortedKeys = Object.keys(forecast).sort();

      return (
          <div className="space-y-4">
               <div className="grid grid-cols-3 gap-4 mb-4">
                   <div className="bg-gray-800 p-3 rounded">
                       <p className="text-[10px] text-gray-500 uppercase">Total Pendiente</p>
                       <p className="text-lg font-bold text-white">{formatEuro(stats.pendingBilling)}</p>
                   </div>
                   <div className="bg-gray-800 p-3 rounded">
                       <p className="text-[10px] text-gray-500 uppercase">Acuerdo Planificado</p>
                       <p className="text-lg font-bold text-sky-400">{formatEuro(totalPlannedAgreement)}</p>
                   </div>
                   <div className="bg-gray-800 p-3 rounded">
                       <p className="text-[10px] text-gray-500 uppercase">Extras Planificados</p>
                       <p className="text-lg font-bold text-purple-400">{formatEuro(totalPlannedExtras)}</p>
                   </div>
               </div>

               <table className="w-full text-sm text-left text-gray-400">
                <thead className="text-xs text-gray-500 uppercase bg-gray-800">
                    <tr>
                        <th className="px-4 py-3">Mes / Periodo</th>
                        <th className="px-4 py-3 text-right">Acuerdo</th>
                        <th className="px-4 py-3 text-right">Extras</th>
                        <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedKeys.map(key => {
                        // Format Key
                        let displayKey = key;
                        if (key !== 'Sin Fecha') {
                            const [y, m] = key.split('-');
                            const date = new Date(parseInt(y), parseInt(m) - 1);
                            displayKey = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                            displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
                        }

                        const monthTotal = forecast[key].agreement + forecast[key].extras;

                        return (
                            <tr key={key} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="px-4 py-3 font-medium text-white">{displayKey}</td>
                                <td className="px-4 py-3 text-right text-sky-400">{formatEuro(forecast[key].agreement)}</td>
                                <td className="px-4 py-3 text-right text-purple-400">{formatEuro(forecast[key].extras)}</td>
                                <td className="px-4 py-3 text-right text-green-400 font-bold">{formatEuro(monthTotal)}</td>
                            </tr>
                        )
                    })}
                    
                    {/* Unplanned Row */}
                    {Math.abs(unplannedAmount) > 1 && (
                        <tr className="bg-orange-900/10 border-t-2 border-orange-900/30">
                            <td className="px-4 py-3 text-orange-300 font-bold italic">Pendiente de Planificar (Sin Hitos)</td>
                            <td className="px-4 py-3 text-right text-orange-300 font-bold" colSpan={3}>{formatEuro(unplannedAmount)}</td>
                        </tr>
                    )}
                </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2 text-center">Datos basados en "Facturas por Emitir" definidas en la ficha de cada cliente.</p>
          </div>
      );
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-4">
        <h1 className="text-3xl font-bold text-white">Resumen de Gestión</h1>
        
        {/* Export Control */}
        <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
            <div className="flex flex-col">
                <label className="text-[10px] text-gray-500 font-semibold uppercase ml-1">Exportar Mes</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="month" 
                        value={exportMonth} 
                        onChange={(e) => setExportMonth(e.target.value)} 
                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-sky-500"
                    />
                    <button 
                        onClick={handleExportMonthlySummary}
                        className="bg-green-600 hover:bg-green-500 text-white p-1.5 rounded transition-colors"
                        title="Descargar Resumen Mensual (Facturas Clientes y Colaboradores)"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      {/* Top Row: Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Top Client */}
        <Card 
            className="border-l-4 border-sky-500 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setActiveModal('TOP_CLIENT')}
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Empresa Top</h2>
                    <ProjectsIcon className="h-5 w-5 text-sky-500" />
                </div>
                <p className="text-xl font-bold text-white truncate" title={stats.topClient.name}>{stats.topClient.name}</p>
                <p className="text-sm text-sky-400 font-medium mt-1">{stats.topClient.count} proyectos activos/totales</p>
                <p className="text-[10px] text-gray-500 mt-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles &rarr;</p>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-sky-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-sky-500/20 transition-all"></div>
        </Card>

        {/* Metric 2: Pending Payment to Collaborators (Outgoing) */}
        <Card 
            className="border-l-4 border-red-500 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setActiveModal('PENDING_PAYMENT')}
        >
             <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Pendiente Pago</h2>
                    <MoneyIcon className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-white flex items-center">
                    {formatEuro(stats.pendingPaymentCollaborators)}
                </div>
                <p className="text-sm text-red-400 font-medium mt-1">A colaboradores externos</p>
                <p className="text-[10px] text-gray-500 mt-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">Ver desglose &rarr;</p>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-red-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-red-500/20 transition-all"></div>
        </Card>

        {/* Metric 3: Top Collaborator */}
        <Card 
            className="border-l-4 border-pink-500 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setActiveModal('TOP_COLLABORATOR')}
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colaborador + Activo</h2>
                    <TeamIcon className="h-5 w-5 text-pink-500" />
                </div>
                <p className="text-lg font-bold text-white truncate" title={stats.topCollaborator.name}>{stats.topCollaborator.name}</p>
                <p className="text-sm text-pink-400 font-medium mt-1">En {stats.topCollaborator.count} proyectos activos</p>
                <p className="text-[10px] text-gray-500 mt-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">Ver proyectos &rarr;</p>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-pink-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-pink-500/20 transition-all"></div>
        </Card>

        {/* Metric 4: Financial Insight (Pending to Bill - Incoming) */}
        <Card 
            className="border-l-4 border-green-500 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setActiveModal('PENDING_BILLING')}
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Pendiente Facturar</h2>
                    <TrendingUpIcon className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-white flex items-center">
                    {formatEuro(stats.pendingBilling)}
                </div>
                
                {/* Composition of Pending Billing */}
                <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Distribución</span>
                        <span className="text-[10px] text-gray-400">Total: 100%</span>
                    </div>
                    
                    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden flex">
                        <div 
                            className="bg-sky-500 h-full transition-all" 
                            style={{ width: `${stats.agreementPendingPercent}%` }}
                            title={`Acuerdo: ${stats.agreementPendingPercent.toFixed(1)}%`}
                        ></div>
                        <div 
                            className="bg-purple-500 h-full transition-all" 
                            style={{ width: `${stats.extrasPendingPercent}%` }}
                            title={`Extras: ${stats.extrasPendingPercent.toFixed(1)}%`}
                        ></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-sky-400 uppercase font-bold">Acuerdo</span>
                            <span className="text-xs text-white font-mono">{stats.agreementPendingPercent.toFixed(1)}%</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-purple-400 uppercase font-bold">Extras</span>
                            <span className="text-xs text-white font-mono">{stats.extrasPendingPercent.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <p className="text-[10px] text-gray-500 mt-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">Ver previsión &rarr;</p>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-green-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-green-500/20 transition-all"></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top 5 Contracts */}
        <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <MoneyIcon className="text-yellow-500 w-5 h-5" />
                    Top 5 Contratos (Importe)
                </h2>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">Últimos meses</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-3 rounded-l-lg">Código</th>
                            <th className="px-4 py-3">Proyecto</th>
                            <th className="px-4 py-3">Cliente</th>
                            <th className="px-4 py-3">Inicio</th>
                            <th className="px-4 py-3 text-right rounded-r-lg">Importe Acuerdo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.topContracts.map((p, idx) => (
                            <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-sky-400">{p.code}</td>
                                <td className="px-4 py-3 font-medium text-white">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${idx === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400'}`}>
                                            {idx + 1}
                                        </span>
                                        <div className="truncate max-w-[180px]" title={p.name}>{p.name}</div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">{p.client}</td>
                                <td className="px-4 py-3 text-xs font-mono">{p.startDate || '-'}</td>
                                <td className="px-4 py-3 text-right font-bold text-sky-400">
                                    <div className="flex justify-end">
                                        {formatEuro((p as any).totalBudget)}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {stats.topContracts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                                    No hay datos económicos suficientes para mostrar el ranking.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>

        {/* Collaborators Chart */}
        <Card>
            <div className="flex items-center justify-between mb-6">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrophyIcon className="text-pink-500" />
                    Equipo + Activo
                </h2>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.collaboratorChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis 
                            type="category" 
                            dataKey="name" 
                            stroke="#9ca3af" 
                            fontSize={12} 
                            tickLine={false}
                            axisLine={false}
                            width={50}
                        />
                        <Tooltip 
                            cursor={{fill: '#374151', opacity: 0.4}}
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                            formatter={(value: number) => [`${value} Proyectos`, 'Participación']}
                            labelStyle={{ color: '#fff', marginBottom: '0.5rem' }}
                        />
                        <Bar dataKey="projects" radius={[0, 4, 4, 0]}>
                            {stats.collaboratorChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ec4899' : '#3b82f6'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
             <p className="text-center text-xs text-gray-500 mt-2">Nº de proyectos en curso asignados</p>
             <p className="text-center text-[10px] text-gray-600">(Excluye Gestores y Coordinadores internos)</p>
        </Card>
      </div>

      {/* MODALS RENDER */}
      {activeModal === 'TOP_CLIENT' && (
          <DashboardModal title={`Proyectos: ${stats.topClient.name}`} onClose={() => setActiveModal(null)}>
              {renderTopClientModal()}
          </DashboardModal>
      )}

      {activeModal === 'PENDING_PAYMENT' && (
          <DashboardModal title="Desglose Pagos Pendientes (Colaboradores)" onClose={() => setActiveModal(null)}>
              {renderPendingPaymentModal()}
          </DashboardModal>
      )}

      {activeModal === 'TOP_COLLABORATOR' && (
          <DashboardModal title={`Actividad: ${stats.topCollaborator.name}`} onClose={() => setActiveModal(null)}>
              {renderTopCollaboratorModal()}
          </DashboardModal>
      )}

      {activeModal === 'PENDING_BILLING' && (
          <DashboardModal title="Previsión de Facturación (Income)" onClose={() => setActiveModal(null)}>
              {renderPendingBillingModal()}
          </DashboardModal>
      )}

    </div>
  );
};

export default Dashboard;
