import React, { useState, useEffect, useMemo } from 'react';
import { Project, ClientInfo, InvoiceSource } from '../types';
import Card from './ui/Card';
import { PlusIcon, TrashIcon, UploadIcon } from './ui/Icons';

interface ClientFinancialsModalProps {
  project: Project;
  onClose: () => void;
  onSave: (clientInfo: ClientInfo) => void;
}

const emptyInfo: ClientInfo = {
    agreement: { amount: 0, offerUrl: '', contractUrl: '' },
    additionals: [],
    plannedInvoices: [],
    invoices: [],
};

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed" />;

const ClientFinancialsModal: React.FC<ClientFinancialsModalProps> = ({ project, onClose, onSave }) => {
  // Initialize state carefully to handle legacy data where 'plannedInvoices' might be missing
  const [financials, setFinancials] = useState<ClientInfo>(() => {
      const initial = project.clientInfo || emptyInfo;
      return {
          ...emptyInfo,
          ...initial,
          additionals: initial.additionals || [],
          plannedInvoices: initial.plannedInvoices || [],
          invoices: initial.invoices || [],
          agreement: initial.agreement || { amount: 0, offerUrl: '', contractUrl: '' }
      };
  });

  useEffect(() => {
    const initialInfo = project.clientInfo || emptyInfo;
    setFinancials({
        ...emptyInfo,
        ...initialInfo,
        additionals: initialInfo.additionals || [],
        plannedInvoices: initialInfo.plannedInvoices || [],
        invoices: initialInfo.invoices || [],
        agreement: initialInfo.agreement || { amount: 0, offerUrl: '', contractUrl: '' },
    });
  }, [project]);

  // Calculate Total Budget dynamically
  const agreementAmount = useMemo(() => financials.agreement?.amount || 0, [financials.agreement]);
  const extrasAmount = useMemo(() => (financials.additionals || []).reduce((sum, item) => sum + (item.amount || 0), 0), [financials.additionals]);
  const totalBudget = agreementAmount + extrasAmount;

  const handleAgreementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFinancials(prev => ({
        ...prev,
        agreement: { 
            ...prev.agreement, 
            [name]: name === 'amount' ? parseFloat(value) || 0 : value 
        } 
    }));
  };

  const handleDynamicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, index: number, type: 'additionals' | 'invoices' | 'plannedInvoices') => {
    const { name, value } = e.target;
    setFinancials(prev => {
        const list = [...(prev[type] || [])] as any[];
        
        let newValue: any = value;
        if (name === 'amount' || name === 'percentage') {
            newValue = parseFloat(value) || 0;
        }

        const getBaseAmountForSource = (src: string | undefined): number => {
            if (!src || src === 'Acuerdo' || src === InvoiceSource.Agreement) {
                return prev.agreement?.amount || 0;
            }
            if (src.startsWith('Adicional ')) {
                const parts = src.split(' ');
                const idx = parseInt(parts[1], 10) - 1;
                if (idx >= 0 && prev.additionals && prev.additionals[idx]) {
                    return prev.additionals[idx].amount || 0;
                }
            }
            if (src === InvoiceSource.Additionals) {
                return (prev.additionals || []).reduce((sum, item) => sum + (item.amount || 0), 0);
            }
            return 0;
        };

        // Specific logic for Invoices and Planned Invoices (Percentage <-> Amount sync)
        if (type === 'plannedInvoices' || type === 'invoices') {
            const item = { ...list[index], [name]: newValue };
            const source = item.source || InvoiceSource.Agreement;
            const baseAmount = getBaseAmountForSource(source);
            
            if (name === 'percentage') {
                // If % changed, update amount
                item.amount = Math.round((newValue / 100) * baseAmount * 100) / 100;
            } else if (name === 'amount' && baseAmount > 0) {
                // If amount changed, update % (display purpose)
                item.percentage = parseFloat(((newValue / baseAmount) * 100).toFixed(2));
            } else if (name === 'source') {
                // If source changed, update % based on current amount and new base
                const newBase = getBaseAmountForSource(newValue);
                if (newBase > 0) {
                    item.percentage = parseFloat(((item.amount / newBase) * 100).toFixed(2));
                }
            }

            list[index] = item;
        } else {
            // Standard update for other lists
            list[index] = { ...list[index], [name]: newValue };
        }

        return { ...prev, [type]: list };
    });
  };

  const handleAdd = (type: 'additionals' | 'invoices' | 'plannedInvoices') => {
    let newItem;
    if (type === 'additionals') newItem = { description: '', amount: 0, url: '' };
    else if (type === 'plannedInvoices') newItem = { id: `plan-${Date.now()}`, description: '', date: '', amount: 0, percentage: 0, source: InvoiceSource.Agreement };
    else newItem = { id: '', amount: 0, date: '', pdfUrl: '', source: InvoiceSource.Agreement };

    // @ts-ignore
    setFinancials(prev => ({ ...prev, [type]: [...(prev[type] || []), newItem] }));
  };

  const handleRemove = (index: number, type: 'additionals' | 'invoices' | 'plannedInvoices') => {
    setFinancials(prev => ({ ...prev, [type]: (prev[type] || []).filter((_, i) => i !== index) }));
  };

  // Move from Planned -> Issued
  const handlePromoteToInvoice = (index: number) => {
    const plannedItem = financials.plannedInvoices[index];
    if (!plannedItem) return;
    
    // Create new Invoice based on planned item, keeping the planned date
    const newInvoice = {
        id: '', // User must fill this
        amount: plannedItem.amount,
        percentage: plannedItem.percentage,
        source: plannedItem.source || InvoiceSource.Agreement,
        date: plannedItem.date || new Date().toISOString().split('T')[0], // Preserve planned date
        pdfUrl: ''
    };

    setFinancials(prev => ({
        ...prev,
        plannedInvoices: prev.plannedInvoices.filter((_, i) => i !== index),
        invoices: [...prev.invoices, newInvoice]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(financials);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in">
      <style>{`.animate-fade-in { animation: fade-in 0.2s ease-out; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <Card className="w-full max-w-5xl max-h-[95vh] flex flex-col p-0" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-start flex-shrink-0 bg-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-white">Datos Económicos del Cliente</h2>
            <div className="flex items-center gap-3 mt-1">
                <p className="text-gray-400">{project.name} <span className="text-gray-600">|</span> <span className="font-mono text-sky-400">{project.code}</span></p>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-green-900/30 border border-green-800 rounded text-xs text-green-400">
                        <span className="font-semibold">Acuerdo:</span>
                        <span>{financials.invoices.filter(i => (i.source || InvoiceSource.Agreement) === InvoiceSource.Agreement).reduce((sum, inv) => sum + inv.amount, 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                        <span className="opacity-50">/</span>
                        <span>{agreementAmount > 0 ? ((financials.invoices.filter(i => (i.source || InvoiceSource.Agreement) === InvoiceSource.Agreement).reduce((sum, inv) => sum + inv.amount, 0) / agreementAmount) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-purple-900/30 border border-purple-800 rounded text-xs text-purple-400">
                        <span className="font-semibold">Extras:</span>
                        <span>{financials.invoices.filter(i => i.source && i.source !== InvoiceSource.Agreement).reduce((sum, inv) => sum + inv.amount, 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                        <span className="opacity-50">/</span>
                        <span>{extrasAmount > 0 ? ((financials.invoices.filter(i => i.source && i.source !== InvoiceSource.Agreement).reduce((sum, inv) => sum + inv.amount, 0) / extrasAmount) * 100).toFixed(1) : 0}%</span>
                    </div>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 pt-2 flex-grow bg-gray-900">
            <div className="space-y-6">
              {/* Top Section: Agreement & Extras */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Agreement */}
                  <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/50">
                    <legend className="px-2 text-lg font-semibold text-sky-400">Acuerdo Principal</legend>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Importe Acordado (€)</label>
                        <Input type="number" name="amount" value={financials.agreement?.amount || 0} onChange={handleAgreementChange} placeholder="0.00" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Link a Oferta (PDF)</label>
                          <Input type="text" name="offerUrl" value={financials.agreement?.offerUrl || ''} onChange={handleAgreementChange} placeholder="https://onedrive..." />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Link a Contrato (PDF)</label>
                          <Input type="text" name="contractUrl" value={financials.agreement?.contractUrl || ''} onChange={handleAgreementChange} placeholder="https://onedrive..." />
                        </div>
                      </div>
                    </div>
                  </fieldset>

                  {/* Additionals */}
                  <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/50">
                     <legend className="px-2 text-lg font-semibold text-purple-400">Adicionales / Extras</legend>
                     <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {(financials.additionals || []).map((item, index) => (
                            <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center pb-2 border-b border-gray-700/50 last:border-0">
                                <div className="space-y-1">
                                    <Input type="text" name="description" placeholder="Descripción" value={item.description} onChange={(e) => handleDynamicChange(e, index, 'additionals')} className="text-sm" />
                                    <Input type="text" name="url" placeholder="Link (Opcional)" value={item.url || ''} onChange={(e) => handleDynamicChange(e, index, 'additionals')} className="text-xs" />
                                </div>
                                <Input type="number" name="amount" placeholder="€" value={item.amount} onChange={(e) => handleDynamicChange(e, index, 'additionals')} />
                                <button type="button" onClick={() => handleRemove(index, 'additionals')} className="p-2 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                     </div>
                     <button type="button" onClick={() => handleAdd('additionals')} className="mt-3 flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"><PlusIcon className="w-4 h-4" /> Añadir Extra</button>
                  </fieldset>
              </div>

              {/* Middle Section: Planning */}
              <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/30">
                 <legend className="px-2 text-lg font-semibold text-orange-400 flex items-center gap-2">
                    Facturas por Emitir (Planificación)
                    <span className="text-xs font-normal text-gray-400 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">Total Presupuesto: {totalBudget.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                 </legend>
                 <div className="mb-2 grid grid-cols-[1.5fr,1.2fr,1fr,0.6fr,1.2fr,auto] gap-4 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:grid">
                    <span>Concepto / Hito</span>
                    <span>Origen</span>
                    <span>Fecha Prevista</span>
                    <span>%</span>
                    <span>Importe (€)</span>
                    <span className="text-center">Acciones</span>
                 </div>
                 <div className="space-y-2">
                    {(financials.plannedInvoices || []).map((item, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[1.5fr,1.2fr,1fr,0.6fr,1.2fr,auto] gap-2 items-center bg-gray-900/50 p-2 rounded border border-gray-800">
                             <Input type="text" name="description" placeholder="Ej: Pago Inicial 30%" value={item.description} onChange={(e) => handleDynamicChange(e, index, 'plannedInvoices')} />
                             <select 
                                name="source" 
                                value={item.source || InvoiceSource.Agreement} 
                                onChange={(e) => handleDynamicChange(e, index, 'plannedInvoices')}
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
                             <Input type="date" name="date" value={item.date} onChange={(e) => handleDynamicChange(e, index, 'plannedInvoices')} />
                             <div className="relative">
                                <Input type="number" name="percentage" placeholder="%" value={item.percentage || ''} onChange={(e) => handleDynamicChange(e, index, 'plannedInvoices')} step="0.1" />
                                <span className="absolute right-6 top-2 text-gray-500 text-xs">%</span>
                             </div>
                             <Input type="number" name="amount" placeholder="€" value={item.amount} onChange={(e) => handleDynamicChange(e, index, 'plannedInvoices')} />
                             
                             <div className="flex items-center gap-1 justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => handlePromoteToInvoice(index)} 
                                    className="p-2 bg-green-900/30 text-green-400 hover:text-green-300 hover:bg-green-900/50 rounded border border-green-900/50 transition-colors"
                                    title="Emitir Factura (Mover a Emitidas)"
                                >
                                    <UploadIcon className="w-5 h-5" />
                                </button>
                                <button type="button" onClick={() => handleRemove(index, 'plannedInvoices')} className="p-2 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                             </div>
                        </div>
                    ))}
                 </div>
                 <button type="button" onClick={() => handleAdd('plannedInvoices')} className="mt-3 flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300"><PlusIcon className="w-4 h-4" /> Añadir Hito de Facturación</button>
              </fieldset>

               {/* Bottom Section: Issued Invoices */}
              <fieldset className="border border-gray-700 p-4 rounded-lg bg-gray-800/50">
                 <legend className="px-2 text-lg font-semibold text-green-400">Facturas Emitidas (Histórico)</legend>
                 <div className="mb-2 grid grid-cols-[1fr,1.2fr,1fr,0.6fr,1fr,1fr,auto] gap-4 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:grid">
                    <span>Nº Factura</span>
                    <span>Origen</span>
                    <span>Fecha Emisión</span>
                    <span>%</span>
                    <span>Importe (€)</span>
                    <span>PDF Factura</span>
                    <span></span>
                 </div>
                 <div className="space-y-2">
                    {(financials.invoices || []).map((item, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr,1.2fr,1fr,0.6fr,1fr,1fr,auto] gap-2 items-center pb-2 border-b border-gray-700/50 last:border-0">
                            <Input type="text" name="id" placeholder="Nº Factura" value={item.id} onChange={(e) => handleDynamicChange(e, index, 'invoices')} className={!item.id ? "border-red-500/50" : ""} />
                            <select 
                                name="source" 
                                value={item.source || InvoiceSource.Agreement} 
                                onChange={(e) => handleDynamicChange(e, index, 'invoices')}
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
                            <Input type="date" name="date" value={item.date} onChange={(e) => handleDynamicChange(e, index, 'invoices')} />
                            <div className="relative">
                                <Input type="number" name="percentage" placeholder="%" value={item.percentage || ''} onChange={(e) => handleDynamicChange(e, index, 'invoices')} step="0.1" />
                                <span className="absolute right-6 top-2 text-gray-500 text-xs">%</span>
                            </div>
                            <Input type="number" name="amount" placeholder="€" value={item.amount} onChange={(e) => handleDynamicChange(e, index, 'invoices')} />
                            <Input type="text" name="pdfUrl" placeholder="URL PDF Factura" value={item.pdfUrl} onChange={(e) => handleDynamicChange(e, index, 'invoices')} className={!item.pdfUrl ? "border-yellow-500/50" : ""} />
                            <button type="button" onClick={() => handleRemove(index, 'invoices')} className="p-2 text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                 </div>
                 <button type="button" onClick={() => handleAdd('invoices')} className="mt-3 flex items-center gap-1 text-sm text-green-400 hover:text-green-300"><PlusIcon className="w-4 h-4" /> Registrar Factura Manualmente</button>
              </fieldset>
            </div>
        </form>

        {/* Footer */}
        <div className="p-6 pt-4 flex justify-end gap-3 border-t border-gray-700 flex-shrink-0 bg-gray-800">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors">Cancelar</button>
            <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-lg shadow-sky-900/50">Guardar Información</button>
        </div>
      </Card>
    </div>
  );
};

export default ClientFinancialsModal;