// ============================================================================
// MICRODB STUDIO - MODAL DE DESFRAGMENTACIÓN Y VACUUM
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { vacuumTable } from '../utils/api.js';

interface DefragModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  onDefragComplete: () => void;
}

export const DefragModal: React.FC<DefragModalProps> = ({
  isOpen,
  onClose,
  tableName,
  onDefragComplete
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ reclaimedBytes: number; initialSlots: number; finalSlots: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVacuum = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await vacuumTable(tableName);
      setResult(res);
      onDefragComplete();
    } catch (err: any) {
      setError(err.message || 'Error en proceso de desfragmentación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Desfragmentar & Vacuum</h3>
              <p className="text-xs text-slate-400">
                Tabla: <strong className="text-sky-300 font-mono">{tableName}</strong>
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>¡Desfragmentación completada exitosamente!</span>
              </div>
              <p className="text-xs text-slate-300">
                Se recuperaron <strong>{result.reclaimedBytes} Bytes</strong> de espacio libre en la tarjeta SD.
              </p>
              <div className="text-[11px] font-mono text-slate-400 pt-1">
                Slots iniciales: {result.initialSlots} ➔ Slots finales: {result.finalSlots}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">
              El proceso de <strong>Vacuum</strong> eliminará permanentemente todos los slots marcados como borrados
              (Tombstones), reorganizará físicamente los registros activos de forma contigua y regenerará los índices
              secundarios, optimizando el rendimiento de la tarjeta SD en Arduino.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              onClick={handleVacuum}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>{loading ? 'Compactando...' : 'Iniciar Vacuum'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
