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
  ChevronRight,
  Trash2
} from 'lucide-react';
import { DetectedDrive, DetectedDatabase } from '../types/microdb.js';
import { fetchDrives, openDirectory, browseDirectory, deleteDatabase } from '../utils/api.js';
import { useToast } from './Toast.js';

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
  const { showConfirm, showSuccess, showError } = useToast();
  const [drives, setDrives] = useState<DetectedDrive[]>([]);
  const [customPath, setCustomPath] = useState(currentDirectory || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDrives = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDrives();
      setDrives(data.drives || []);
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

  const handleDeleteDbClick = (db: DetectedDatabase) => {
    const tableInfo = db.tableCount > 0
      ? `(${db.tableCount} tabla(s): ${db.tables.join(', ')})`
      : '(sin tablas)';

    showConfirm({
      title: '¿Eliminar Base de Datos?',
      message: `¿Estás seguro de eliminar permanentemente la base de datos '${db.name}' ${tableInfo} en '${db.path}'? Esta acción borrará todas sus tablas de la tarjeta SD / disco y no se puede deshacer.`,
      confirmText: 'Sí, Eliminar Base de Datos',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDatabase(db.name, db.path);
          showSuccess('Base de datos eliminada', `La base de datos '${db.name}' fue eliminada correctamente.`);
          await loadDrives();
        } catch (err: any) {
          showError('Error al eliminar base de datos', err.message || 'No se pudo eliminar la base de datos');
        }
      }
    });
  };

  const handleBrowseFolder = async () => {
    try {
      const sdFallback = drives.find((d) => d.isSdCard || d.type === 'removable')?.letter;
      const initial = (customPath || currentDirectory || sdFallback || '').trim() || undefined;
      const res = await browseDirectory('Seleccionar tarjeta SD o carpeta de base de datos', initial);
      if (!res.canceled && res.selectedPath) {
        setCustomPath(res.selectedPath);
        await handleOpenPath(res.selectedPath);
      }
    } catch (err: any) {
      setError(err.message || 'Error abriendo diálogo de selección');
    }
  };

  // Separar Tarjetas SD de Discos Locales
  const sdDrives = drives.filter((d) => d.isSdCard || d.type === 'removable');
  const localDrives = drives.filter((d) => !d.isSdCard && d.type !== 'removable');

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
                Selecciona una tarjeta SD, una unidad de disco o examina cualquier carpeta de tu computador
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

          {/* ===================================================================== */}
          {/* SECCIÓN 1: TARJETAS SD DETECTADAS */}
          {/* ===================================================================== */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tarjetas SD Detectadas</span>
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

            {sdDrives.length > 0 ? (
              <div className="space-y-3">
                {sdDrives.map((drive) => {
                  const rootDrivePath = drive.letter.endsWith('\\') ? drive.letter : `${drive.letter}\\`;
                  const hasDbs = drive.databases && drive.databases.length > 0;
                  const isDriveActive = currentDirectory?.toLowerCase().startsWith(drive.letter.toLowerCase());

                  return (
                    <div
                      key={drive.letter}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isDriveActive
                          ? 'bg-[#0d1117] border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                          : 'bg-[#0d1117] border-[#30363d]'
                      }`}
                    >
                      {/* Drive Header Bar */}
                      <div className="p-4 flex items-center justify-between border-b border-[#30363d]/60 bg-[#161b22]/70">
                        <div className="flex items-center space-x-3.5">
                          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <HardDrive className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-white font-mono">{drive.letter}</span>
                              <span className="text-xs font-semibold text-slate-300">{drive.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                TARJETA SD
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
                          className="bg-[#21262d] hover:bg-emerald-600 hover:text-white border border-[#30363d] text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 group"
                          title={`Abrir la raíz de la tarjeta SD ${drive.letter}`}
                        >
                          <span>Abrir Unidad Completa</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>

                      {/* Detected Databases list inside this SD */}
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
                                      ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                                      : 'bg-[#161b22] border-[#30363d] hover:border-emerald-500/40 hover:bg-[#1c2128]'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5 truncate">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                                      <Database className="w-4 h-4" />
                                    </div>
                                    <div className="truncate">
                                      <div className="font-bold text-xs text-white group-hover:text-emerald-300 transition-colors truncate">
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

                                  <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                                    {isDbSelected ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-1" />
                                    ) : (
                                      <span className="text-xs text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center space-x-0.5 mr-1">
                                        <span>Abrir</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      </span>
                                    )}

                                    {!db.name.includes('Raíz') && db.name !== '/' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteDbClick(db);
                                        }}
                                        disabled={loading}
                                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer"
                                        title={`Eliminar base de datos '${db.name}'`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
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
            ) : (
              <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-xl text-xs text-slate-400 flex items-center justify-between">
                <span>No se detectaron tarjetas SD extraíbles conectadas. Conecta una tarjeta SD o abre una unidad de disco local abajo.</span>
                <button
                  onClick={loadDrives}
                  disabled={loading}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center space-x-1 shrink-0 ml-2"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* SECCIÓN 2: UNIDADES DE DISCO LOCALES */}
          {/* ===================================================================== */}
          {localDrives.length > 0 && (
            <div>
              <div className="mb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                  <span>Unidades de Disco Locales</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {localDrives.map((drive) => {
                  const rootDrivePath = drive.letter.endsWith('\\') ? drive.letter : `${drive.letter}\\`;
                  const hasDbs = drive.databases && drive.databases.length > 0;
                  const isDriveActive = currentDirectory?.toLowerCase().startsWith(drive.letter.toLowerCase());

                  return (
                    <div
                      key={drive.letter}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                        isDriveActive
                          ? 'bg-[#0d1117] border-sky-500/50 shadow-md shadow-sky-500/10'
                          : 'bg-[#0d1117] border-[#30363d]'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-sm text-white font-mono">{drive.letter}</span>
                            <span className="text-xs font-semibold text-slate-300 truncate">{drive.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {hasDbs
                              ? `${drive.databases.length} base(s) de datos detectada(s)`
                              : 'Sin bases de datos detectadas'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenPath(rootDrivePath)}
                        disabled={loading}
                        className="w-full bg-[#161b22] hover:bg-sky-600 hover:text-white border border-[#30363d] text-slate-200 text-xs font-bold py-2 px-3 rounded-lg transition-all flex items-center justify-center space-x-1.5 group"
                        title={`Abrir la unidad completa ${drive.letter}`}
                      >
                        <span>Abrir Unidad {drive.letter}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* SECCIÓN 3: RUTA PERSONALIZADA O EXAMINAR EN COMPUTADOR */}
          {/* ===================================================================== */}
          <div className="pt-2 border-t border-[#30363d]/60">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              O Escribir / Seleccionar Carpeta en tu Computador
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Folder className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleOpenPath(customPath);
                  }}
                  placeholder="Ej: E:\  o  E:\BIGDATA  o  D:\MisDatos\MicroDB"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={handleBrowseFolder}
                disabled={loading}
                className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-200 hover:text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 active:scale-95"
                title="Examinar y seleccionar carpeta en tu equipo mediante el explorador del sistema"
              >
                <FolderOpen className="w-4 h-4 text-sky-400" />
                <span>Examinar...</span>
              </button>
              <button
                onClick={() => handleOpenPath(customPath)}
                disabled={loading || !customPath.trim()}
                className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center space-x-2 shrink-0 active:scale-95"
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
