// ============================================================================
// MICRODB STUDIO - MODAL DE GESTIÓN DE ADVERTENCIAS Y DEPENDENCIAS DE BORRADO
// ============================================================================

import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  Link2Off,
  X,
  Layers,
  ShieldAlert,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { CheckDependenciesResult } from '../types/microdb.js';

interface DeleteDependencyModalProps {
  isOpen: boolean;
  dependencyInfo: CheckDependenciesResult | null;
  onClose: () => void;
  onConfirmDelete: (action: 'cascade' | 'set_null') => Promise<void>;
}

export const DeleteDependencyModal: React.FC<DeleteDependencyModalProps> = ({
  isOpen,
  dependencyInfo,
  onClose,
  onConfirmDelete
}) => {
  const [selectedAction, setSelectedAction] = useState<'cascade' | 'set_null'>('cascade');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !dependencyInfo) return null;

  const handleExecute = async () => {
    try {
      setLoading(true);
      await onConfirmDelete(selectedAction);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#30363d] bg-[#0d1117]/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <span>Advertencia de Integridad Referencial</span>
              </h3>
              <p className="text-xs text-slate-400">
                El registro que intentas eliminar está relacionado con otros datos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#21262d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Main Alert Card */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
            <div className="flex items-center space-x-2 font-bold text-sm text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Registro #{dependencyInfo.targetRecordId} en '{dependencyInfo.tableName}'
              </span>
            </div>
            <p className="leading-relaxed text-amber-200/90">
              Este registro tiene{' '}
              <strong className="text-amber-300 underline">
                {dependencyInfo.totalDependentRecords} referencia(s) vinculada(s)
              </strong>{' '}
              en otras tablas. Eliminarlo directamente rompería la integridad de la base de datos si no defines una acción.
            </p>
          </div>

          {/* Breakdown of Affected Tables */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Tablas y Registros Afiliados Afectados:</span>
            </div>
            <div className="space-y-2">
              {dependencyInfo.dependencies.map((dep) => (
                <div
                  key={dep.tableName}
                  className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-sky-400 font-mono">/{dep.tableName}</span>
                    <span className="text-[11px] text-slate-400">
                      campo: <code className="text-slate-300 bg-[#161b22] px-1 py-0.5 rounded font-mono">{dep.fkField}</code>
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono font-bold text-[11px]">
                    {dep.matchingCount} registro(s) dependiente(s)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Select Action Strategy */}
          <div>
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-3">
              ¿Qué acción deseas aplicar para resolver esta relación?
            </div>

            <div className="space-y-3">
              {/* Option 1: CASCADE DELETE */}
              <div
                onClick={() => setSelectedAction('cascade')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start space-x-3.5 ${
                  selectedAction === 'cascade'
                    ? 'bg-rose-950/30 border-rose-500/70 shadow-lg shadow-rose-500/10'
                    : 'bg-[#0d1117] border-[#30363d] hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="relational_action"
                  checked={selectedAction === 'cascade'}
                  onChange={() => setSelectedAction('cascade')}
                  className="mt-1 accent-rose-500"
                />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-sm text-rose-200 flex items-center space-x-2">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>Borrado en Cascada (CASCADE DELETE)</span>
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Elimina el registro principal <strong className="text-slate-200">#{dependencyInfo.targetRecordId}</strong> y{' '}
                    <strong className="text-rose-300">borra automáticamente los {dependencyInfo.totalDependentRecords} registros dependientes</strong> asociados en las tablas vinculadas.
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    ⚠️ Operación destructiva en múltiples tablas
                  </span>
                </div>
              </div>

              {/* Option 2: SET NULL */}
              <div
                onClick={() => setSelectedAction('set_null')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start space-x-3.5 ${
                  selectedAction === 'set_null'
                    ? 'bg-sky-950/30 border-sky-500/70 shadow-lg shadow-sky-500/10'
                    : 'bg-[#0d1117] border-[#30363d] hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="relational_action"
                  checked={selectedAction === 'set_null'}
                  onChange={() => setSelectedAction('set_null')}
                  className="mt-1 accent-sky-500"
                />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-sm text-sky-200 flex items-center space-x-2">
                    <Link2Off className="w-4 h-4 text-sky-400" />
                    <span>Anular Referencias / Poner en 0 (SET NULL)</span>
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Elimina el registro principal <strong className="text-slate-200">#{dependencyInfo.targetRecordId}</strong> y{' '}
                    <strong className="text-sky-300">actualiza las claves foráneas a 0 (Sin Referencia)</strong> en los {dependencyInfo.totalDependentRecords} registros dependientes.
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ✓ Preserva los registros dependientes intactos en disco
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] rounded-xl transition-all"
          >
            Cancelar
          </button>

          <button
            onClick={handleExecute}
            disabled={loading}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 text-white shadow-lg ${
              selectedAction === 'cascade'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20'
            }`}
          >
            {loading ? (
              <span>Procesando...</span>
            ) : (
              <>
                <span>
                  {selectedAction === 'cascade' ? 'Ejecutar Borrado en Cascada' : 'Anular Referencias y Eliminar'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
