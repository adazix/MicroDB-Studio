// ============================================================================
// MICRODB STUDIO - SELECTOR DE UNIDADES SD, BASES DE DATOS Y EXPLORADOR DE DIRECTORIOS
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
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
  FolderUp,
  FolderPlus,
  Compass,
  Check,
  Search,
  Plus
} from 'lucide-react';
import { DetectedDrive, ExploreResult } from '../types/microdb.js';
import {
  fetchDrives,
  openDirectory,
  browseDirectory,
  exploreDirectory,
  createFolder
} from '../utils/api.js';

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

  // Estado del explorador interactivo
  const [exploreData, setExploreData] = useState<ExploreResult | null>(null);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');

  // Creación de nueva carpeta / base de datos
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Cargar explorador para una ruta determinada
  const loadExplorePath = useCallback(async (targetPath?: string) => {
    setLoadingExplore(true);
    setError(null);
    try {
      const data = await exploreDirectory(targetPath);
      setExploreData(data);
      setCustomPath(data.currentPath);
      setFolderSearch('');
    } catch (err: any) {
      setError(err.message || 'Error explorando directorio');
    } finally {
      setLoadingExplore(false);
    }
  }, []);

  // Cargar lista de unidades del sistema
  const loadDrives = useCallback(async () => {
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
  }, []);

  // Inicialización al abrir el modal
  useEffect(() => {
    if (isOpen) {
      loadDrives();
      const initialPath = currentDirectory || undefined;
      loadExplorePath(initialPath);
      setShowCreateFolder(false);
      setNewFolderName('');
    }
  }, [isOpen, currentDirectory, loadDrives, loadExplorePath]);

  if (!isOpen) return null;

  // Abrir directorio seleccionado y cargar en MicroDB Studio
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

  // Abrir diálogo nativo del sistema operativo (Windows / Electron)
  const handleBrowseFolder = async () => {
    try {
      const res = await browseDirectory('Seleccionar carpeta de base de datos o tarjeta SD');
      if (!res.canceled && res.selectedPath) {
        setCustomPath(res.selectedPath);
        await loadExplorePath(res.selectedPath);
      }
    } catch (err: any) {
      setError(err.message || 'Error abriendo diálogo de selección');
    }
  };

  // Cambiar de disco en el explorador
  const handleSelectDrive = async (driveLetter: string) => {
    const rootPath = driveLetter.endsWith('\\') ? driveLetter : `${driveLetter}\\`;
    await loadExplorePath(rootPath);
  };

  // Crear carpeta / base de datos en el directorio actual
  const handleCreateNewFolder = async (loadImmediately: boolean = false) => {
    if (!exploreData || !newFolderName.trim()) return;

    setCreatingFolder(true);
    setError(null);
    try {
      const res = await createFolder(exploreData.currentPath, newFolderName.trim(), true);
      setNewFolderName('');
      setShowCreateFolder(false);

      if (loadImmediately) {
        await handleOpenPath(res.folderPath);
      } else {
        await loadExplorePath(res.folderPath);
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear la carpeta');
    } finally {
      setCreatingFolder(false);
    }
  };

  // Filtrar tarjetas SD (removibles)
  const sdDrives = drives.filter((d) => d.isSdCard || d.type === 'removable');

  // Subcarpetas filtradas por búsqueda
  const filteredDirectories = exploreData?.directories.filter((dir) =>
    dir.name.toLowerCase().includes(folderSearch.toLowerCase())
  ) || [];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Seleccionar Origen de Base de Datos</h3>
              <p className="text-xs text-slate-400">
                Selecciona una tarjeta SD o explora discos locales y carga un directorio específico
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center space-x-2.5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* =================================================================== */}
          {/* SECCIÓN 1: TARJETAS SD DETECTADAS (Formato original destacado) */}
          {/* =================================================================== */}
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

                                  <div className="flex items-center space-x-1 shrink-0 pl-2">
                                    {isDbSelected ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <span className="text-xs text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center space-x-0.5">
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
            ) : (
              <div className="p-3.5 bg-[#0d1117] border border-[#30363d] rounded-xl text-xs text-slate-400 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  <span>No se detectaron tarjetas SD extraíbles conectadas. Conecta tu SD o explora tus discos abajo.</span>
                </div>
                <button
                  onClick={loadDrives}
                  disabled={loading}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Reintentar</span>
                </button>
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* SECCIÓN 2: EXPLORADOR DE DIRECTORIOS Y DISCOS LOCALES */}
          {/* =================================================================== */}
          <div className="pt-2 border-t border-[#30363d]/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>Explorador de Carpetas y Discos Locales</span>
              </span>

              {/* Selector de discos en formato de chips */}
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Cambiar Disco:</span>
                {drives.map((d) => {
                  const isCurrent = exploreData?.driveLetter?.toUpperCase() === d.letter.toUpperCase().replace(/\\$/, '');
                  return (
                    <button
                      key={d.letter}
                      type="button"
                      onClick={() => handleSelectDrive(d.letter)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 border transition-all ${
                        isCurrent
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-sm shadow-sky-500/20'
                          : 'bg-[#0d1117] text-slate-400 border-[#30363d] hover:bg-[#21262d] hover:text-white'
                      }`}
                      title={`Explorar unidad ${d.letter} (${d.name})`}
                    >
                      <HardDrive className="w-3 h-3" />
                      <span>{d.letter}</span>
                      {d.isSdCard && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-sans">
                          SD
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel Principal del Explorador */}
            <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl overflow-hidden flex flex-col">
              {/* Barra de Navegación y Breadcrumbs */}
              <div className="p-3 border-b border-[#30363d] bg-[#161b22]/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 flex-1 min-w-[200px] overflow-x-auto py-0.5">
                  {/* Botón Subir Nivel */}
                  <button
                    type="button"
                    onClick={() => exploreData?.parentPath && loadExplorePath(exploreData.parentPath)}
                    disabled={!exploreData?.parentPath || loadingExplore}
                    className="p-1.5 bg-[#0d1117] hover:bg-[#21262d] disabled:opacity-30 disabled:cursor-not-allowed border border-[#30363d] rounded-lg text-slate-300 hover:text-white transition-all shrink-0"
                    title="Subir un nivel (Carpeta padre)"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Breadcrumbs interactivos */}
                  <div className="flex items-center space-x-1 text-xs font-mono text-slate-400 overflow-x-auto">
                    {exploreData?.breadcrumbs.map((crumb, idx) => {
                      const isLast = idx === exploreData.breadcrumbs.length - 1;
                      return (
                        <React.Fragment key={crumb.path}>
                          <button
                            type="button"
                            onClick={() => loadExplorePath(crumb.path)}
                            className={`px-1.5 py-0.5 rounded hover:bg-[#21262d] transition-colors truncate max-w-[150px] ${
                              isLast ? 'text-sky-300 font-bold bg-sky-500/10' : 'text-slate-300'
                            }`}
                            title={crumb.path}
                          >
                            {crumb.name}
                          </button>
                          {!isLast && <span className="text-slate-600">/</span>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Acciones de la barra */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 active:scale-95"
                    title="Examinar con el selector de carpetas de Windows"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Examinar...</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCreateFolder(!showCreateFolder)}
                    className="bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 active:scale-95"
                    title="Crear una nueva carpeta o base de datos en este directorio"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-sky-400" />
                    <span>+ Nueva Carpeta / BD</span>
                  </button>

                  {exploreData?.currentPath && (
                    <button
                      type="button"
                      onClick={() => handleOpenPath(exploreData.currentPath)}
                      disabled={loading}
                      className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 shadow-md shadow-sky-500/20 active:scale-95"
                      title="Cargar esta carpeta actual como espacio de trabajo en MicroDB Studio"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Cargar Este Directorio</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Formulario Inline para Crear Carpeta / BD en este directorio */}
              {showCreateFolder && (
                <div className="p-3 bg-[#1c2128] border-b border-sky-500/30 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-sky-300 shrink-0">
                    <FolderPlus className="w-4 h-4 text-sky-400" />
                    <span>Crear en este directorio:</span>
                  </div>
                  <div className="relative flex-1 w-full">
                    <input
                      type="text"
                      autoFocus
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateNewFolder(false);
                        if (e.key === 'Escape') setShowCreateFolder(false);
                      }}
                      placeholder="Nombre de la nueva base de datos (ej: SENSORS o STORE)"
                      className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCreateFolder(false)}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!newFolderName.trim() || creatingFolder}
                      onClick={() => handleCreateNewFolder(false)}
                      className="bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#30363d] transition-all"
                    >
                      Crear
                    </button>
                    <button
                      type="button"
                      disabled={!newFolderName.trim() || creatingFolder}
                      onClick={() => handleCreateNewFolder(true)}
                      className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm"
                    >
                      Crear y Cargar
                    </button>
                  </div>
                </div>
              )}

              {/* Banner si el directorio actual contiene tablas directamente */}
              {exploreData && exploreData.currentFolderTables.length > 0 && (
                <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2 text-emerald-300">
                    <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Esta carpeta contiene <strong>{exploreData.currentFolderTables.length}</strong> tabla(s) MicroDB:{' '}
                      <span className="font-mono font-bold text-white">
                        {exploreData.currentFolderTables.join(', ')}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenPath(exploreData.currentPath)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-lg transition-all flex items-center space-x-1 shrink-0"
                  >
                    <span>Cargar Tablas Ahora</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Barra de Búsqueda de Carpetas (si hay varias) */}
              {exploreData && exploreData.directories.length > 4 && (
                <div className="p-2 border-b border-[#30363d] bg-[#0d1117] flex items-center px-3">
                  <Search className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={folderSearch}
                    onChange={(e) => setFolderSearch(e.target.value)}
                    placeholder={`Filtrar entre ${exploreData.directories.length} carpetas...`}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                  />
                  {folderSearch && (
                    <button
                      type="button"
                      onClick={() => setFolderSearch('')}
                      className="text-slate-500 hover:text-white text-xs p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Lista de Subcarpetas */}
              <div className="p-3 max-h-60 overflow-y-auto">
                {loadingExplore ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                    <span>Explorando carpetas...</span>
                  </div>
                ) : filteredDirectories.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredDirectories.map((dir) => (
                      <div
                        key={dir.path}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                          dir.isDatabase
                            ? 'bg-[#161b22] border-sky-500/40 hover:border-sky-500/80 hover:bg-[#1c2128]'
                            : 'bg-[#161b22] border-[#30363d] hover:border-slate-500 hover:bg-[#1c2128]'
                        }`}
                      >
                        {/* Clic en el nombre para entrar al directorio */}
                        <div
                          onClick={() => loadExplorePath(dir.path)}
                          className="flex items-center space-x-2.5 truncate flex-1 cursor-pointer pr-2"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              dir.isDatabase
                                ? 'bg-sky-500/20 text-sky-400'
                                : 'bg-slate-700/30 text-slate-400 group-hover:text-slate-200'
                            }`}
                          >
                            {dir.isDatabase ? <Database className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-xs text-white group-hover:text-sky-300 transition-colors truncate">
                              {dir.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {dir.isDatabase ? (
                                dir.tableCount > 0 ? (
                                  <span className="text-emerald-400 font-semibold">
                                    {dir.tableCount} tabla(s) {dir.tables.length > 0 ? `(${dir.tables.join(', ')})` : ''}
                                  </span>
                                ) : (
                                  <span className="text-sky-400">Base de Datos MicroDB</span>
                                )
                              ) : (
                                <span className="text-slate-500">Carpeta</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botones de acción rápida en la carpeta */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => loadExplorePath(dir.path)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-lg transition-colors"
                            title={`Entrar a la carpeta ${dir.name}`}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPath(dir.path)}
                            className="bg-[#21262d] hover:bg-sky-600 hover:text-white border border-[#30363d] text-slate-300 text-[11px] font-semibold px-2 py-1 rounded-lg transition-all flex items-center space-x-1"
                            title={`Cargar carpeta '${dir.name}' en MicroDB Studio`}
                          >
                            <span>Cargar</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                    <Folder className="w-7 h-7 text-slate-600 mx-auto opacity-60" />
                    <p className="font-semibold text-slate-300">
                      {folderSearch
                        ? 'No se encontraron carpetas con ese nombre'
                        : 'Esta carpeta no contiene subdirectorios'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Puedes crear una base de datos aquí con el botón "+ Nueva Carpeta / BD" o cargar este directorio directamente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* SECCIÓN 3: RUTA MANUAL DIRECTA */}
          {/* =================================================================== */}
          <div className="pt-2 border-t border-[#30363d]/60">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              O Escribir / Pegar Ruta Manual de Carpeta
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
                  placeholder="Ej: E:\  o  E:\BIGDATA  o  D:\MisProyectos\MicroDB"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => loadExplorePath(customPath)}
                disabled={loading || !customPath.trim()}
                className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-200 hover:text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 active:scale-95"
                title="Explorar esta ruta"
              >
                <Compass className="w-4 h-4 text-sky-400" />
                <span>Explorar</span>
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
        <div className="px-6 py-3.5 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px] hidden sm:inline">
            💡 Puedes cambiar de disco en los chips superiores o crear bases de datos en cualquier carpeta.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors ml-auto"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
