
import React, { useState, useEffect, useMemo } from 'react';
import type { Project, TeamMember, CollaboratorInfo, CollaboratorPartialDelivery, ReceivedInvoice, PlannedInvoice } from '../types';
import { InvoiceSource } from '../types';
import Card from './ui/Card';
import { PlusIcon, TrashIcon } from './ui/Icons';

interface CollaboratorFinancialsModalProps {
  project: Project;
  collaborator: TeamMember;
  onClose: () => void;
  onSave: (financialInfo: CollaboratorInfo) => void;
  onRemoveFromProject?: () => void;
}

const emptyInfo: CollaboratorInfo = {
    agreement: { amount: 0, contractUrl: '' },
    additionals: [],
    plannedInvoices: [],
    invoices: [],
    partialDeliveries: [],
    startDate: '',
    endDate: '',
    workReceived: false,
};

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />;

const CollaboratorFinancialsModal: React.FC<CollaboratorFinancialsModalProps> = ({ project, collaborator, onClose, onSave, onRemoveFromProject }) => {
  const [financials, setFinancials] = useState<CollaboratorInfo>(() => {
    const initialInfo = collaborator.collaboratorInfo || emptyInfo;
    return {
        ...emptyInfo,
        ...initialInfo,
        additionals: initialInfo.additionals || [],
        plannedInvoices: initialInfo.plannedInvoices || [],
        invoices: initialInfo.invoices || [],
        partialDeliveries: initialInfo.partialDeliveries || [],
        agreement: initialInfo.agreement || { amount: 0, contractUrl: '' },
    };
  });

  useEffect(() => {
    const initialInfo = collaborator.collaboratorInfo || emptyInfo;
    setFinancials({
        ...emptyInfo,
        ...initialInfo,
        additionals: initialInfo.additionals || [],
        plannedInvoices: initialInfo.plannedInvoices || [],
        invoices: initialInfo.invoices || [],
        partialDeliveries: initialInfo.partialDeliveries || [],
        agreement: initialInfo.agreement || { amount: 0, contractUrl: '' },
    });
  }, [collaborator]);

  const agreementAmount = useMemo(() => financials.agreement?.amount || 0, [financials.agreement]);
  const extrasAmount = useMemo(() => (financials.additionals || []).reduce((acc, curr) => acc + (curr.amount || 0), 0), [financials.additionals]);
  const totalAgreement = agreementAmount + extrasAmount;

  const getBaseAmountForSource = (src: string | undefined, currentFinancials = financials): number => {
    if (!src || src === 'Acuerdo' || src === InvoiceSource.Agreement) {
        return currentFinancials.agreement?.amount || 0;
    }
    if (src.startsWith('Adicional ')) {
        const parts = src.split(' ');
        const idx = parseInt(parts[1], 10) - 1;
        if (idx >= 0 && currentFinancials.additionals && currentFinancials.additionals[idx]) {
            return currentFinancials.additionals[idx].amount || 0;
        }
    }
    if (src === InvoiceSource.Additionals) {
        return (currentFinancials.additionals || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    return 0;
  };

  const handleAgreementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFinancials(prev => {
        const newAgreement = { 
            ...prev.agreement, 
            [name]: name === 'amount' ? parseFloat(value) || 0 : value 
        };
        const updated = { ...prev, agreement: newAgreement };

        // Recalculate percentages for agreement-sourced invoices if agreement amount changed
        if (name === 'amount') {
            const newBase = parseFloat(value) || 0;
            const updatedPlanned = (prev.plannedInvoices || []).map(item => {
                if (!item.source || item.source === InvoiceSource.Agreement || item.source === 'Acuerdo') {
                    return {
                        ...item,
                        percentage: newBase > 0 ? parseFloat(((item.amount / newBase) * 100).toFixed(2)) : 0
                    };
                }
                return item;
            });
            const updatedInvoices = (prev.invoices || []).map(item => {
                if (!item.source || item.source === InvoiceSource.Agreement || item.source === 'Acuerdo') {
                    return {
                        ...item,
                        percentage: newBase > 0 ? parseFloat(((item.amount / newBase) * 100).toFixed(2)) : 0
                    };
                }
                return item;
            });
            return {
                ...updated,
                plannedInvoices: updatedPlanned,
                invoices: updatedInvoices
            };
        }
        return updated;
    });
  };

  const handleInvoiceChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, 
    index: number, 
    type: 'plannedInvoices' | 'invoices'
  ) => {
    const { name, value } = e.target;
    setFinancials(prev => {
        const list = [...(prev[type] || [])] as any[];
        const item = { ...list[index] };
        
        let newValue: any = value;
        if (name === 'amount' || name === 'percentage') {
            newValue = parseFloat(value) || 0;
        }

        const currentSource = name === 'source' ? value : (item.source || InvoiceSource.Agreement);
        const baseAmount = getBaseAmountForSource(currentSource, prev);

        if (name === 'percentage') {
            item.percentage = newValue;
            item.amount = Math.round(((newValue * baseAmount) / 100) * 100) / 100;
        } else if (name === 'amount') {
            item.amount = newValue;
            item.percentage = baseAmount > 0 ? parseFloat(((newValue / baseAmount) * 100).toFixed(2)) : 0;
        } else if (name === 'source') {
            item.source = value;
            const newBase = getBaseAmountForSource(value, prev);
            if (newBase > 0) {
                item.percentage = parseFloat(((item.amount / newBase) * 100).toFixed(2));
            }
        } else {
            item[name] = newValue;
        }

        list[index] = item;
        return { ...prev, [type]: list };
    });
  };

  const handleAdditionalsChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { name, value } = e.target;
    setFinancials(prev => {
        const list = [...(prev.additionals || [])];
        const newAmount = name === 'amount' ? parseFloat(value) || 0 : list[index].amount;
        list[index] = {
            ...list[index],
            [name]: name === 'amount' ? newAmount : value
        };
        
        const updated = { ...prev, additionals: list };

        // If additional amount changed, recalculate percentages for invoices linked to this additional
        if (name === 'amount') {
            const targetSource = `Adicional ${index + 1}`;
            const updatedPlanned = (prev.plannedInvoices || []).map(item => {
                if (item.source === targetSource) {
                    return {
                        ...item,
                        percentage: newAmount > 0 ? parseFloat(((item.amount / newAmount) * 100).toFixed(2)) : 0
                    };
                }
                return item;
            });
            const updatedInvoices = (prev.invoices || []).map(item => {
                if (item.source === targetSource) {
                    return {
                        ...item,
                        percentage: newAmount > 0 ? parseFloat(((item.amount / newAmount) * 100).toFixed(2)) : 0
                    };
                }
                return item;
            });
            return {
                ...updated,
                plannedInvoices: updatedPlanned,
                invoices: updatedInvoices
            };
        }

        return updated;
    });
  };

  const handleMainInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFinancials(prev => ({...prev, [e.target.name]: e.target.value}));
  };

  const handleAdd = (type: 'additionals' | 'invoices' | 'plannedInvoices') => {
    if (type === 'additionals') {
        setFinancials(prev => ({ ...prev, additionals: [...(prev.additionals || []), { description: '', amount: 0, url: '' }] }));
    } else if (type === 'plannedInvoices') {
        const newItem: PlannedInvoice = { 
            id: `pi-${Date.now()}`, 
            description: '', 
            date: '', 
            amount: 0, 
            percentage: 0, 
            source: InvoiceSource.Agreement 
        };
        setFinancials(prev => ({ ...prev, plannedInvoices: [...(prev.plannedInvoices || []), newItem] }));
    } else {
        const newItem: ReceivedInvoice = { 
            id: '', 
            amount: 0, 
            date: '', 
            pdfUrl: '', 
            percentage: 0, 
            source: InvoiceSource.Agreement 
        };
        setFinancials(prev => ({ ...prev, invoices: [...(prev.invoices || []), newItem] }));
    }
  };

  const handleRemove = (index: number, type: 'additionals' | 'invoices' | 'plannedInvoices') => {
    setFinancials(prev => ({ ...prev, [type]: (prev[type] || []).filter((_, i) => i !== index) }));
  };

  const handlePromoteToInvoice = (index: number) => {
    const plannedItem = (financials.plannedInvoices || [])[index];
    if (!plannedItem) return;

    const newInvoice: ReceivedInvoice = {
        id: '',
        amount: plannedItem.amount,
        percentage: plannedItem.percentage,
        source: plannedItem.source || InvoiceSource.Agreement,
        date: new Date().toISOString().split('T')[0],
        pdfUrl: ''
    };

    setFinancials(prev => ({
        ...prev,
        plannedInvoices: (prev.plannedInvoices || []).filter((_, i) => i !== index),
        invoices: [...(prev.invoices || []), newInvoice]
    }));
  };

  // Partial Deliveries Logic
  const handleAddDelivery = () => {
    const newDelivery: CollaboratorPartialDelivery = { id: `cpd-${Date.now()}`, description: '', date: '', completed: false };
    setFinancials(prev => ({
        ...prev,
        partialDeliveries: [...(prev.partialDeliveries || []), newDelivery]
    }));
  };
  
  const handleUpdateDelivery = (index: number, field: keyof CollaboratorPartialDelivery, value: any) => {
    const updated = [...(financials.partialDeliveries || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFinancials(prev => ({ ...prev, partialDeliveries: updated }));
  };

  const handleRemoveDelivery = (index: number) => {
    setFinancials(prev => ({
        ...prev,
        partialDeliveries: (prev.partialDeliveries || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    onSave(financials);
  };

  const totalAgreementInvoiced = financials.invoices
    .filter(i => (i.source || InvoiceSource.Agreement) === InvoiceSource.Agreement)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalExtrasInvoiced = financials.invoices
    .filter(i => i.source && i.source !== InvoiceSource.Agreement)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalInvoiced = financials.invoices.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in">
      <style>{`.animate-fade-in { animation: fade-in 0.2s ease-out; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <Card className="w-full max-w-5xl max-h-[92vh] flex flex-col p-0" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-start flex-shrink-0 bg-gray-800 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Detalles Financieros & Plazos</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <p className="text-gray-400">{collaborator.name} en <span className="text-sky-400 font-semibold">{project.name}</span></p>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-green-900/30 border border-green-800 rounded text-xs text-green-400">
                        <span className="font-semibold">Acuerdo:</span>
                        <span>{totalAgreementInvoiced.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                        <span className="opacity-50">/</span>
                        <span>{agreementAmount > 0 ? ((totalAgreementInvoiced / agreementAmount) * 100).toFixed(1) : 0}%</span>
                    </div>
                    {extrasAmount > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-900/30 border border-purple-800 rounded text-xs text-purple-400">
                            <span className="font-semibold">Extras:</span>
                            <span>{totalExtrasInvoiced.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                            <span className="opacity-50">/</span>
                            <span>{extrasAmount > 0 ? ((totalExtrasInvoiced / extrasAmount) * 100).toFixed(1) : 0}%</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-sky-900/30 border border-sky-800 rounded text-xs text-sky-400">
                        <span className="font-semibold">Total:</span>
                        <span>{totalInvoiced.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                        <span className="opacity-50">/</span>
                        <span>{totalAgreement > 0 ? ((totalInvoiced / totalAgreement) * 100).toFixed(1) : 0}%</span>
                    </div>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 pt-4 flex-grow bg-gray-900">
            <div className="space-y-6">
              {/* Top Section: Agreement & Extras */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Agreement */}
                <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/40">
                  <legend className="px-2 text-lg font-semibold text-sky-400">Acuerdo Económico</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Importe Base (€)</label>
                      <Input type="number" name="amount" value={financials.agreement.amount} onChange={handleAgreementChange} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">URL Contrato</label>
                      <Input type="text" name="contractUrl" value={financials.agreement.contractUrl} onChange={handleAgreementChange} placeholder="https://..." />
                    </div>
                  </div>
                </fieldset>

                {/* Additionals */}
                <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/40">
                   <legend className="px-2 text-lg font-semibold text-purple-400">Adicionales / Extras</legend>
                   <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {financials.additionals.map((item, index) => (
                          <div key={index} className="grid grid-cols-[1.5fr,1.5fr,1fr,auto] gap-2 items-center pb-2 border-b border-gray-700/40 last:border-0">
                              <Input type="text" name="description" placeholder={`Adicional ${index + 1} - Descripción`} value={item.description} onChange={(e) => handleAdditionalsChange(e, index)} className="text-sm" />
                              <Input type="text" name="url" placeholder="URL Acuerdo Extra" value={item.url || ''} onChange={(e) => handleAdditionalsChange(e, index)} className="text-xs" />
                              <Input type="number" name="amount" placeholder="€" value={item.amount} onChange={(e) => handleAdditionalsChange(e, index)} className="w-full text-sm" />
                              <button type="button" onClick={() => handleRemove(index, 'additionals')} className="p-2 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                          </div>
                      ))}
                      {financials.additionals.length === 0 && (
                          <p className="text-xs text-gray-500 italic py-2">No hay adicionales registrados.</p>
                      )}
                   </div>
                   <button type="button" onClick={() => handleAdd('additionals')} className="mt-3 flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"><PlusIcon className="w-4 h-4" />Añadir Adicional</button>
                </fieldset>
              </div>

              {/* Work Details & Milestones */}
              <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/30">
                <legend className="px-2 text-lg font-semibold text-sky-400">Plazos y Hitos</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Fecha de Inicio</label>
                    <Input type="date" name="startDate" value={financials.startDate || ''} onChange={handleMainInfoChange} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Final (Entrega)</label>
                    <Input type="date" name="endDate" value={financials.endDate || ''} onChange={handleMainInfoChange} />
                  </div>
                </div>

                {/* Partial Deliveries List */}
                <div className="mt-2 border-t border-gray-700/50 pt-2">
                    <div className="flex justify-between items-center mb-2">
                         <label className="block text-sm font-medium text-gray-300">Entregas Parciales / Hitos Acordados</label>
                         <button type="button" onClick={handleAddDelivery} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"><PlusIcon className="w-3 h-3"/> Añadir Hito</button>
                    </div>
                    <div className="space-y-2">
                        {(financials.partialDeliveries || []).map((pd, idx) => (
                            <div key={idx} className="flex gap-2 items-center bg-gray-900/50 p-2 rounded border border-gray-800">
                                <input type="checkbox" checked={pd.completed} onChange={(e) => handleUpdateDelivery(idx, 'completed', e.target.checked)} className="rounded bg-gray-700 border-gray-600 text-sky-600 focus:ring-sky-500" />
                                <input type="date" value={pd.date} onChange={(e) => handleUpdateDelivery(idx, 'date', e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs w-32 text-white" />
                                <input type="text" value={pd.description} onChange={(e) => handleUpdateDelivery(idx, 'description', e.target.value)} placeholder="Descripción entrega..." className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs flex-1 text-white" />
                                <button type="button" onClick={() => handleRemoveDelivery(idx)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        ))}
                         {(financials.partialDeliveries || []).length === 0 && <p className="text-xs text-gray-500 italic">No hay hitos definidos.</p>}
                    </div>
                </div>
                
                <div className="mt-4 pt-2 border-t border-gray-700/50 flex justify-center">
                      <button type="button" onClick={() => setFinancials(prev => ({ ...prev, workReceived: !prev.workReceived }))}
                        className={`w-full max-w-xs px-4 py-2 rounded-md text-white font-semibold transition-colors text-sm ${
                            financials.workReceived ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'
                        }`}>
                        {financials.workReceived ? '✓ Trabajo Total Entregado' : 'Marcar Trabajo Final como Entregado'}
                      </button>
                  </div>
              </fieldset>

              {/* Planned Invoices */}
              <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/30">
                 <legend className="px-2 text-lg font-semibold text-sky-400 flex items-center gap-2">
                    Facturas Previstas (Estimación Mensual / Facturas por Emitir)
                    <span className="text-xs font-normal text-gray-400 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
                        Total Acordado: {totalAgreement.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                 </legend>
                  <div className="mb-2 grid grid-cols-[1.5fr,1.3fr,1.1fr,70px,110px,auto] gap-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:grid">
                    <span>Concepto</span>
                    <span>Origen</span>
                    <span>Fecha Prevista</span>
                    <span>%</span>
                    <span>Importe (€)</span>
                    <span className="text-right pr-4">Acciones</span>
                  </div>
                 <div className="space-y-2">
                    {(financials.plannedInvoices || []).map((item, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[1.5fr,1.3fr,1.1fr,70px,110px,auto] gap-2 items-center bg-gray-900/50 p-2 rounded border border-gray-800">
                            <Input type="text" name="description" placeholder="Concepto (ej: Pago Mes 1)" value={item.description} onChange={(e) => handleInvoiceChange(e, index, 'plannedInvoices')} />
                            <select 
                                name="source" 
                                value={item.source || InvoiceSource.Agreement} 
                                onChange={(e) => handleInvoiceChange(e, index, 'plannedInvoices')}
                                className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-xs text-white focus:ring-2 focus:ring-sky-500 w-full"
                            >
                                <option value={InvoiceSource.Agreement}>Acuerdo Principal</option>
                                {(financials.additionals || []).map((add, idx) => (
                                    <option key={idx} value={`Adicional ${idx + 1}`}>
                                        Adicional {idx + 1} {add.description ? `- ${add.description}` : ''}
                                    </option>
                                ))}
                                {item.source === InvoiceSource.Additionals && (
                                    <option value={InvoiceSource.Additionals}>Adicionales/Extras (Legacy)</option>
                                )}
                            </select>
                            <Input type="date" name="date" value={item.date} onChange={(e) => handleInvoiceChange(e, index, 'plannedInvoices')} />
                            <div className="relative">
                                <Input type="number" name="percentage" placeholder="%" value={item.percentage || ''} onChange={(e) => handleInvoiceChange(e, index, 'plannedInvoices')} step="0.1" className="pr-5" />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                            </div>
                            <Input type="number" name="amount" placeholder="€" value={item.amount} onChange={(e) => handleInvoiceChange(e, index, 'plannedInvoices')} />
                            <div className="flex items-center gap-1 justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => handlePromoteToInvoice(index)} 
                                    className="p-2 bg-green-900/30 text-green-400 hover:text-green-300 hover:bg-green-900/50 rounded border border-green-900/50 transition-colors"
                                    title="Recibir Factura (Mover a Recibidas)"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                </button>
                                <button type="button" onClick={() => handleRemove(index, 'plannedInvoices')} className="p-2 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                    ))}
                    {(financials.plannedInvoices || []).length === 0 && (
                        <p className="text-xs text-gray-500 italic py-2">No hay facturas previstas registradas.</p>
                    )}
                 </div>
                 <button type="button" onClick={() => handleAdd('plannedInvoices')} className="mt-3 flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300"><PlusIcon className="w-4 h-4" />Añadir Factura Prevista</button>
              </fieldset>

              {/* Invoices */}
              <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/30">
                 <legend className="px-2 text-lg font-semibold text-green-400">Facturas Recibidas (Cobros / Facturas Emitidas)</legend>
                 <div className="mb-2 grid grid-cols-[1fr,1.3fr,1.1fr,70px,110px,1.2fr,auto] gap-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:grid">
                    <span>Nº Factura</span>
                    <span>Origen</span>
                    <span>Fecha</span>
                    <span>%</span>
                    <span>Importe (€)</span>
                    <span>URL PDF</span>
                    <span></span>
                 </div>
                 <div className="space-y-2">
                    {financials.invoices.map((item, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr,1.3fr,1.1fr,70px,110px,1.2fr,auto] gap-2 items-center bg-gray-900/50 p-2 rounded border border-gray-800">
                            <Input type="text" name="id" placeholder="Nº Factura" value={item.id} onChange={(e) => handleInvoiceChange(e, index, 'invoices')} />
                            <select 
                                name="source" 
                                value={item.source || InvoiceSource.Agreement} 
                                onChange={(e) => handleInvoiceChange(e, index, 'invoices')}
                                className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-xs text-white focus:ring-2 focus:ring-sky-500 w-full"
                            >
                                <option value={InvoiceSource.Agreement}>Acuerdo Principal</option>
                                {(financials.additionals || []).map((add, idx) => (
                                    <option key={idx} value={`Adicional ${idx + 1}`}>
                                        Adicional {idx + 1} {add.description ? `- ${add.description}` : ''}
                                    </option>
                                ))}
                                {item.source === InvoiceSource.Additionals && (
                                    <option value={InvoiceSource.Additionals}>Adicionales/Extras (Legacy)</option>
                                )}
                            </select>
                            <Input type="date" name="date" value={item.date} onChange={(e) => handleInvoiceChange(e, index, 'invoices')} />
                            <div className="relative">
                                <Input type="number" name="percentage" placeholder="%" value={item.percentage || ''} onChange={(e) => handleInvoiceChange(e, index, 'invoices')} step="0.1" className="pr-5" />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                            </div>
                            <Input type="number" name="amount" placeholder="€" value={item.amount} onChange={(e) => handleInvoiceChange(e, index, 'invoices')} />
                            <Input type="text" name="pdfUrl" placeholder="URL PDF" value={item.pdfUrl} onChange={(e) => handleInvoiceChange(e, index, 'invoices')} />
                            <button type="button" onClick={() => handleRemove(index, 'invoices')} className="p-2 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                    {financials.invoices.length === 0 && (
                        <p className="text-xs text-gray-500 italic py-2">No hay facturas recibidas registradas.</p>
                    )}
                 </div>
                 <button type="button" onClick={() => handleAdd('invoices')} className="mt-3 flex items-center gap-1 text-sm text-green-400 hover:text-green-300"><PlusIcon className="w-4 h-4" />Añadir Factura</button>
              </fieldset>
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 flex justify-between items-center border-t border-gray-700 flex-shrink-0 bg-gray-800">
            <div>
                {onRemoveFromProject && (
                    <button 
                        type="button" 
                        onClick={onRemoveFromProject} 
                        className="px-4 py-2 rounded-md bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all font-medium flex items-center gap-2 border border-red-900/50"
                    >
                        <TrashIcon className="w-4 h-4" />
                        Eliminar de este proyecto
                    </button>
                )}
            </div>
            <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors">Cancelar</button>
                <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-lg shadow-sky-900/40 font-semibold">Guardar Cambios</button>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default CollaboratorFinancialsModal;

