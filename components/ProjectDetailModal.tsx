import React, { useMemo } from 'react';
import type { Project } from '../types';
import { MemberType, ProjectStatus } from '../types';
import Card from './ui/Card';
import { CalendarIcon, MailIcon } from './ui/Icons';
import { calculateRangeHours, computeProjectFinancials } from '../lib/economics';

interface ProjectDetailModalProps {
  project: Project;
  internalRates: Record<string, number>;
  managerName?: string;
  onClose: () => void;
}

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const formatEuro = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const statusBadgeStyles: Record<ProjectStatus, string> = {
  [ProjectStatus.InProgress]: 'bg-sky-500/20 text-sky-300 border-sky-700',
  [ProjectStatus.Completed]: 'bg-green-500/20 text-green-300 border-green-700',
  [ProjectStatus.Proposal]: 'bg-orange-500/20 text-orange-300 border-orange-700',
};

const ContactBlock: React.FC<{ label: string; contact: { name: string; email: string; phone: string; description?: string } }> = ({ label, contact }) => {
  if (!contact.name && !contact.email && !contact.phone) return null;
  return (
    <div className="bg-gray-900/40 p-3 rounded border border-gray-700/40">
      <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-white font-medium">{contact.name || '—'}</p>
      <div className="flex flex-wrap gap-x-3 text-xs text-gray-400">
        {contact.email && <span>{contact.email}</span>}
        {contact.phone && <span>{contact.phone}</span>}
      </div>
      {contact.description && <p className="text-xs text-gray-500 italic mt-1">{contact.description}</p>}
    </div>
  );
};

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ project, internalRates, managerName, onClose }) => {
  const financials = useMemo(() => computeProjectFinancials(project, internalRates), [project, internalRates]);

  const memberBreakdown = useMemo(() => {
    return project.team.map((member) => {
      if (member.type === MemberType.Internal) {
        const info = member.internalCostInfo;
        const rate = info && info.hourlyRate > 0 ? info.hourlyRate : internalRates[member.contact] || 0;
        const hours = (info?.workRanges || []).reduce((acc, r) => acc + calculateRangeHours(r), 0);
        return { member, kind: 'internal' as const, rate, hours, cost: hours * rate };
      }
      const info = member.collaboratorInfo;
      const agreed = (info?.agreement.amount || 0) + (info?.additionals.reduce((s, a) => s + (a.amount || 0), 0) || 0);
      const invoiced = info?.invoices.reduce((s, i) => s + (i.amount || 0), 0) || 0;
      return { member, kind: 'external' as const, agreed, invoiced, pending: agreed - invoiced };
    });
  }, [project.team, internalRates]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in">
      <style>{`.animate-fade-in { animation: fade-in 0.2s ease-out; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <Card className="w-full max-w-4xl max-h-[92vh] flex flex-col p-0" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-start flex-shrink-0 bg-gray-800 border-b border-gray-700">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">{project.code}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">
                {project.client}
              </span>
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusBadgeStyles[project.status]}`}>
                {project.status}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white">{project.name}</h2>
            {managerName && <p className="text-xs text-gray-400 mt-1">Gestor: <span className="text-sky-400 font-medium">{managerName}</span></p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-6 pt-4 flex-grow bg-gray-900 space-y-6">
          {/* Info general */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-800/40 p-4 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <CalendarIcon className="w-4 h-4 text-gray-500" />
              <span>{project.startDate || '?'} <span className="text-gray-600 mx-1">➜</span> {project.endDate || '?'}</span>
            </div>
            <div className="md:col-span-2 text-sm text-gray-400">
              {project.statusDetail || <span className="italic text-gray-600">Sin detalle de estado.</span>}
            </div>
            {project.status === ProjectStatus.Completed && (
              <div className="md:col-span-3 flex items-center gap-2 text-xs pt-2 border-t border-gray-700/40">
                <MailIcon className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400 font-medium">Correo Cierre:</span>
                {project.closingEmailSent ? (
                  <span className="text-green-400 font-bold">Enviado ✓</span>
                ) : (
                  <span className="text-red-400 font-bold">Pendiente ✕</span>
                )}
              </div>
            )}
          </div>

          {/* Resumen económico */}
          <div>
            <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wide mb-2">Resumen Económico</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700/40">
                <p className="text-[10px] text-gray-500 uppercase">Presupuesto</p>
                <p className="text-white font-semibold">{formatEuro(financials.totalBudget)}</p>
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700/40">
                <p className="text-[10px] text-gray-500 uppercase">Coste Interno (Proy.)</p>
                <p className="text-purple-300 font-semibold">{formatEuro(financials.projectedInternalCosts)}</p>
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700/40">
                <p className="text-[10px] text-gray-500 uppercase">Coste Externo</p>
                <p className="text-pink-300 font-semibold">{formatEuro(financials.externalCosts)}</p>
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700/40">
                <p className="text-[10px] text-gray-500 uppercase">Beneficio (Proy.)</p>
                <p className={`font-semibold ${financials.projectedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatEuro(financials.projectedProfit)} <span className="text-[10px] text-gray-500">({financials.projectedProfitPercentage.toFixed(0)}%)</span>
                </p>
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700/40">
                <p className="text-[10px] text-gray-500 uppercase">Facturado</p>
                <p className="text-sky-300 font-semibold">{formatEuro(financials.totalInvoiced)}</p>
              </div>
            </div>
          </div>

          {/* Contactos */}
          {(project.generalContact?.name || project.technicalContacts?.length || project.economicContacts?.length) ? (
            <div>
              <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wide mb-2">Contactos del Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {project.generalContact?.name && <ContactBlock label="Responsable General" contact={project.generalContact} />}
                {(project.technicalContacts || []).map((c, idx) => (
                  <ContactBlock key={`tech-${idx}`} label={`Resp. Técnico ${(project.technicalContacts?.length || 0) > 1 ? idx + 1 : ''}`} contact={c} />
                ))}
                {(project.economicContacts || []).map((c, idx) => (
                  <ContactBlock key={`eco-${idx}`} label={`Resp. Económico ${(project.economicContacts?.length || 0) > 1 ? idx + 1 : ''}`} contact={c} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Equipo */}
          <div>
            <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wide mb-2">Equipo del Proyecto</h3>
            <div className="space-y-2">
              {memberBreakdown.map(({ member, kind, ...data }) => (
                <div key={member.contact} className="flex flex-wrap justify-between items-center gap-2 bg-gray-800/50 p-3 rounded border border-gray-700/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{member.name}</p>
                      {member.active === false && <span className="text-[10px] uppercase bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Finalizado</span>}
                    </div>
                    <p className="text-xs text-gray-400">{member.role} <span className="text-gray-600">|</span> {member.type}{member.internalMemberType ? ` · ${member.internalMemberType}` : ''}</p>
                  </div>
                  {kind === 'internal' ? (
                    <div className="text-xs text-gray-300 flex gap-4">
                      <span>{(data as any).hours.toFixed(0)} h × {formatEuro((data as any).rate)}/h</span>
                      <span className="font-semibold text-purple-300">{formatEuro((data as any).cost)}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300 flex gap-4">
                      <span>Acordado: <span className="text-white font-medium">{formatEuro((data as any).agreed)}</span></span>
                      <span>Facturado: <span className="text-green-400 font-medium">{formatEuro((data as any).invoiced)}</span></span>
                      <span>Pendiente: <span className="text-red-400 font-medium">{formatEuro((data as any).pending)}</span></span>
                    </div>
                  )}
                </div>
              ))}
              {project.team.length === 0 && <p className="text-sm text-gray-500 italic text-center py-4">No hay miembros asignados.</p>}
            </div>
          </div>

          {/* Entregas parciales */}
          {(project.partialDeliveries || []).length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wide mb-2">Entregas Parciales</h3>
              <div className="space-y-1">
                {(project.partialDeliveries || []).map((pd, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-gray-800/40 px-3 py-2 rounded border border-gray-700/30">
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

        {/* Footer */}
        <div className="p-4 flex justify-end border-t border-gray-700 flex-shrink-0 bg-gray-800">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors">
            Cerrar
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ProjectDetailModal;
