// ============================================================================
// MICRODB STUDIO - MODAL DE INTEGRACIÓN Y GUÍA DE CONEXIÓN CON DBEAVER
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  CheckCircle2
} from 'lucide-react';

interface DBeaverBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string | null;
}

export const DBeaverBridgeModal: React.FC<DBeaverBridgeModalProps> = ({
  isOpen,
  onClose,
  currentDirectory
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqliteFilePath = currentDirectory ? `${currentDirectory}\\microdb_live.sqlite` : '';

  const handleCopyPath = () => {
    if (!sqliteFilePath) return;
    navigator.clipboard.writeText(sqliteFilePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-lg shadow-amber-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Puente Directo con DBeaver</h3>
              <p className="text-xs text-slate-400">
                Sincronización bidireccional en tiempo real con DBeaver mediante SQLite Bridge
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
        <div className="p-6 space-y-6">
          {/* Status Alert */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs text-emerald-400 uppercase tracking-wide">
                Puente SQLite Activo & Sincronizado
              </p>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                MicroDB Studio mantiene automáticamente sincronizado un archivo SQLite estructurado con todas tus
                tablas binarias, tipos nativos y claves primarias.
              </p>
            </div>
          </div>

          {/* SQLite Path Copy Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Ruta del Archivo SQLite para DBeaver:
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={sqliteFilePath || 'No hay directorio abierto'}
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-xs text-amber-300 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopyPath}
                disabled={!sqliteFilePath}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 shadow-md shadow-amber-500/20"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado' : 'Copiar Ruta'}</span>
              </button>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider">
              Cómo Conectar DBeaver en 3 Pasos:
            </h4>
            <div className="space-y-2.5">
              <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-xs text-slate-300">
                  Abre <strong>DBeaver</strong> y haz clic en <strong>"Nueva Conexión"</strong> (o ícono de enchufe).
                </p>
              </div>

              <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-xs text-slate-300">
                  Selecciona <strong>SQLite</strong> de la lista de bases de datos y haz clic en <strong>Siguiente</strong>.
                </p>
              </div>

              <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-xs text-slate-300">
                  Pega la ruta copiada en el campo <strong>"Path"</strong> y presiona <strong>Finalizar</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#21262d] text-white hover:bg-[#30363d] transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
