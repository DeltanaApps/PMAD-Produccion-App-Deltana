
import React, { useState } from 'react';
import type { TeamMember } from '../types';
import Card from './ui/Card';

interface AddCollaboratorModalProps {
  onClose: () => void;
  onSave: (collaboratorData: Omit<TeamMember, 'type' | 'task' | 'collaboratorInfo'>) => void;
}

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

interface InputProps extends React.ComponentPropsWithoutRef<'input'> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, className, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input 
            {...props} 
            className={`w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${className || ''}`}
        />
    </div>
);

const AddCollaboratorModal: React.FC<AddCollaboratorModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [contact, setContact] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !role.trim()) {
        alert("Nombre, contacto y rol son obligatorios.");
        return;
    }
    onSave({ name, company, role, contact });
  };

  return (
    <div
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in"
    >
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
      <Card 
        className="w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Añadir Nuevo Colaborador</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors">
                <CloseIcon className="h-6 w-6" />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nombre Completo" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nombre Apellido" />
            <Input label="Email de Contacto" type="email" value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="email@ejemplo.com" />
            <Input label="Rol Principal" value={role} onChange={(e) => setRole(e.target.value)} required placeholder="Técnico, Modelador..." />
            <Input label="Empresa (Opcional)" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de la Empresa" />
        
            <div className="pt-6 mt-4 border-t border-gray-700 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors">
                    Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors">
                    Guardar Colaborador
                </button>
            </div>
        </form>
      </Card>
    </div>
  );
};

export default AddCollaboratorModal;
