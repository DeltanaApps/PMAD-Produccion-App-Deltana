import React, { useState } from 'react';
import Card from './ui/Card';

interface ConfirmDeleteMemberModalProps {
  memberName: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

// Deleting someone from the shared Recursos catalog cascades (at the DB
// level) to every project they're on — including projects belonging to
// other gestores that whoever clicks "eliminar" can't even see — wiping
// their financial history (acuerdos, facturas, pagos) in every one of
// those projects, permanently. A plain window.confirm doesn't convey that
// scope, so this requires typing the exact name and ticking an explicit
// acknowledgement before the delete button even becomes clickable —
// the same spirit as GitHub's "type the repo name to delete it".
const ConfirmDeleteMemberModal: React.FC<ConfirmDeleteMemberModalProps> = ({ memberName, onConfirm, onCancel }) => {
  const [typedName, setTypedName] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = typedName.trim() === memberName.trim() && acknowledged && !deleting;

  const handleConfirm = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onCancel}
    >
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
      <Card className="w-full max-w-lg border border-red-900/50" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-3">Eliminar a "{memberName}" de Recursos</h2>

        <div className="space-y-3 text-sm">
          <p className="text-red-400 font-semibold">
            Esta acción no se puede deshacer.
          </p>
          <p className="text-gray-300">
            Se eliminará a <span className="font-semibold text-white">{memberName}</span> de{' '}
            <span className="font-semibold">todos</span> los proyectos en los que participe — incluidos proyectos de
            otros gestores que tú no puedes ver — junto con todo su historial financiero (acuerdos, facturas,
            adicionales, pagos) en cada uno de ellos.
          </p>
          <p className="text-gray-300">
            No hay forma de recuperar esos datos después de confirmar.
          </p>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Escribe <span className="font-mono text-white">{memberName}</span> para confirmar
          </label>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
            autoFocus
          />
        </div>

        <label className="flex items-start gap-2 mt-4 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            He leído y entiendo que esto borrará permanentemente todos los datos financieros de esta persona en
            todos los proyectos donde participe.
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canDelete}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ConfirmDeleteMemberModal;
