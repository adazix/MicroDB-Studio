// ============================================================================
// MICRODB STUDIO - MODAL PARA CREAR NUEVA BASE DE DATOS EN LA SD
// ============================================================================

import React, { useState } from 'react';
import { X, FolderPlus, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from './Toast.js';

interface NewDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatabaseCreated: (databaseName: string) => void;
  existingDatabases: string[];
}

export const NewDatabaseModal: React.FC<NewDatabaseModalProps> = ({
  isOpen,
  onClose,
  onDatabaseCreated,
  existingDatabases
}) => {
  const { showError } = useToast();
  const [dbName, setDbName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const sanitizedName = dbName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const isDuplicate = existingDatabases.some(
    (d) => d.toLowerCase() === sanitizedName.toLowerCase()
  );
  const isValid = sanitizedName.length > 0 && !isDuplicate;

  const suggestions = ['STORE', 'SENSORS', 'TELEMETRY', 'CONFIG', 'LOGS', 'SECURITY'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    try {
      onDatabaseCreated(sanitizedName);
      setDbName('');
      onClose();
    } catch (err: any) {
      showError('Error al crear Base de Datos', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-[#161b22] border border-[#30363d] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Nueva Base de Datos en SD</h2>
              <p className="text-[11px] text-slate-400">Crear un directorio de base de datos aislado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre de la Base de Datos / Directorio SD
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                /
              </div>
              <input
                type="text"
                autoFocus
                value={dbName}
                onChange={(e) => setDbName(e.target.value.toUpperCase())}
                placeholder="EJ: SENSORS"
                maxLength={16}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-xl pl-7 pr-3 py-2.5 text-xs font-mono font-bold text-white focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Nombre de la carpeta en la raíz de la SD (formato FAT 8.3 recomendado, ej: <code className="text-sky-400">STORE</code>).
            </p>

            {isDuplicate && (
              <div className="flex items-center space-x-1.5 text-rose-400 text-[11px] mt-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Ya existe una base de datos con este nombre en la SD.</span>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Sugerencias Rápidas:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((sug) => (
                <button
                  type="button"
                  key={sug}
                  onClick={() => setDbName(sug)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-[#0d1117] hover:bg-sky-500/10 hover:text-sky-300 hover:border-sky-500/40 border border-[#30363d] text-slate-300 transition-all"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Arduino Code Hint */}
          <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl text-[11px] text-slate-400 space-y-1">
            <span className="text-sky-400 font-semibold font-mono text-[10px] flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>Compatibilidad con Arduino C++:</span>
            </span>
            <pre className="font-mono text-[10px] text-slate-300 overflow-x-auto p-1 bg-[#161b22] rounded border border-[#30363d]">
              {`// En Arduino MicroDB:
MicroDB db("/${sanitizedName || 'MI_BD'}");
db.begin();`}
            </pre>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#21262d] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || loading}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                isValid && !loading
                  ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/25 active:scale-95'
                  : 'bg-[#21262d] text-slate-500 cursor-not-allowed border border-[#30363d]'
              }`}
            >
              <FolderPlus className="w-4 h-4" />
              <span>{loading ? 'Creando...' : 'Crear Base de Datos'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
