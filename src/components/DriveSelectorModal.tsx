// ============================================================================
// MICRODB STUDIO - SELECTOR DE UNIDADES SD Y BASES DE DATOS DETECTADAS
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder,
  ArrowRight,
  Database,
  Layers,
  ChevronRight
} from 'lucide-react';
import { DetectedDrive } from '../types/microdb.js';
import { fetchDrives, openDirectory } from '../utils/api.js';

interface DriveSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDirectoryOpened: (dirPath: string) => void;
  currentDirectory: string | null;
}

export const DriveSelectorModal: React.FC<DriveSelectorModalProps> = ({
  isOpen,
  onClose,
  onDirectoryOpened,
  currentDirectory
}) => {
  const [drives, setDrives] = useState<DetectedDrive[]>([]);
  const [customPath, setCustomPath] = useState(currentDirectory || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDrives = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDrives();
      setDrives(data.drives);
    } catch (err: any) {
      setError(err.message || 'Error cargando unidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDrives();
      setCustomPath(currentDirectory || '');
    }
  }, [isOpen, currentDirectory]);

  if (!isOpen) return null;

  const handleOpenPath = async (path: string) => {
    if (!path.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await openDirectory(path);
      onDirectoryOpened(path);
      onClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo abrir el directorio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Seleccionar Origen de Base de Datos</h3>
              <p className="text-xs text-slate-400">
                Selecciona una tarjeta SD o explora y abre directamente una de sus bases de datos
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
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center space-x-2.5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Tarjetas SD y Unidades Detectadas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                <span>Unidades y Tarjetas SD Detectadas</span>
              </span>
              <button
                onClick={loadDrives}
                disabled={loading}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1 bg-[#0d1117] hover:bg-[#21262d] px-2.5 py-1 rounded-lg border border-[#30363d] transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Actualizar Unidades</span>
              </button>
            </div>

            <div className="space-y-4">
              {drives.map((drive) => {
                const rootDrivePath = drive.letter.endsWith('\\') ? drive.letter : `${drive.letter}\\`;
                const hasDbs = drive.databases && drive.databases.length > 0;
                const isDriveActive = currentDirectory?.toLowerCase().startsWith(drive.letter.toLowerCase());

                return (
                  <div
                    key={drive.letter}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isDriveActive
                        ? 'bg-[#0d1117] border-sky-500/50 shadow-lg shadow-sky-500/10'
                        : 'bg-[#0d1117] border-[#30363d]'
                    }`}
                  >
                    {/* Drive Header Bar */}
                    <div className="p-4 flex items-center justify-between border-b border-[#30363d]/60 bg-[#161b22]/70">
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`p-2.5 rounded-xl ${
                            drive.isSdCard
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          <HardDrive className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-white font-mono">{drive.letter}</span>
                            <span className="text-xs font-semibold text-slate-300">{drive.name}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                drive.isSdCard
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-700/50 text-slate-300'
                              }`}
                            >
                              {drive.isSdCard ? 'TARJETA SD' : 'DISCO'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {hasDbs
                              ? `${drive.databases.length} base(s) de datos detectada(s)`
                              : 'Sin bases de datos detectadas'}
                          </p>
                        </div>
                      </div>

                      {/* Open full drive button */}
                      <button
                        onClick={() => handleOpenPath(rootDrivePath)}
                        disabled={loading}
                        className="bg-[#21262d] hover:bg-sky-600 hover:text-white border border-[#30363d] text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 group"
                        title={`Abrir la raíz de la unidad ${drive.letter}`}
                      >
                        <span>Abrir Unidad Completa</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>

                    {/* Detected Databases list inside this drive */}
                    {hasDbs ? (
                      <div className="p-3 bg-[#0d1117] space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
                          Bases de Datos Disponibles en {drive.letter}:
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {drive.databases.map((db) => {
                            const isDbSelected = currentDirectory === db.path;

                            return (
                              <div
                                key={db.path}
                                onClick={() => handleOpenPath(db.path)}
                                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                                  isDbSelected
                                    ? 'bg-sky-950/40 border-sky-500/60 text-sky-200'
                                    : 'bg-[#161b22] border-[#30363d] hover:border-sky-500/40 hover:bg-[#1c2128]'
                                }`}
                              >
                                <div className="flex items-center space-x-2.5 truncate">
                                  <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                                    <Database className="w-4 h-4" />
                                  </div>
                                  <div className="truncate">
                                    <div className="font-bold text-xs text-white group-hover:text-sky-300 transition-colors truncate">
                                      {db.name.startsWith('/') || db.name.includes('Raíz')
                                        ? db.name
                                        : `/${db.name}`}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {db.tableCount > 0 ? (
                                        <span className="text-emerald-400 font-semibold">
                                          {db.tableCount} tabla(s) {db.tables.length > 0 ? `(${db.tables.join(', ')})` : ''}
                                        </span>
                                      ) : (
                                        <span className="text-slate-500">0 tablas</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-1 shrink-0 pl-2">
                                  {isDbSelected ? (
                                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                                  ) : (
                                    <span className="text-xs text-sky-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center space-x-0.5">
                                      <span>Abrir</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-[#0d1117] text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                        <span>No se encontraron carpetas con tablas en {drive.letter}. Puedes abrir la unidad para crear una.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Ruta Personalizada */}
          <div className="pt-2 border-t border-[#30363d]/60">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              O Escribir Ruta Manual de Carpeta en tu Computador
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Folder className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="Ej: E:\  o  E:\DB_MULTI  o  D:\Datos\MicroDB"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>
              <button
                onClick={() => handleOpenPath(customPath)}
                disabled={loading || !customPath.trim()}
                className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center space-x-2 shrink-0"
              >
                <span>Cargar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
