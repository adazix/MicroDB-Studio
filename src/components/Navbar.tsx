// ============================================================================
// MICRODB STUDIO - BARRA DE NAVEGACIÓN Y ACCIONES GLOBALES
// ============================================================================

import React from 'react';
import {
  Database,
  Terminal,
  HardDrive,
  RefreshCw,
  Share2,
  Download,
  PlusCircle,
  Radio,
  FolderOpen,
  FolderX
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'tables' | 'sql' | 'sectors';
  setActiveTab: (tab: 'tables' | 'sql' | 'sectors') => void;
  currentDirectory: string | null;
  activeDatabase?: string;
  onOpenDriveModal: () => void;
  onCloseDirectory?: () => void;
  onOpenDBeaverModal: () => void;
  onOpenExportModal: () => void;
  onOpenNewTableModal: () => void;
  onRefresh: () => void;
  isWatching: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentDirectory,
  activeDatabase,
  onOpenDriveModal,
  onCloseDirectory,
  onOpenDBeaverModal,
  onOpenExportModal,
  onOpenNewTableModal,
  onRefresh,
  isWatching
}) => {
  const isConnected = Boolean(currentDirectory);

  return (
    <header className="h-16 bg-[#161b22] border-b border-[#30363d] px-4 sm:px-5 flex items-center justify-between z-30 select-none gap-2">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
        <div 
          className="flex items-center space-x-2.5 cursor-pointer group"
          onClick={() => setActiveTab('tables')}
        >
          <img 
            src="/favicon.png" 
            alt="Logo" 
            className="h-8 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(56,189,248,0.7)] group-hover:scale-105 transition-transform shrink-0" 
          />
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">MicroDB</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                STUDIO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">SD & Embedded DB Manager</p>
          </div>
        </div>

        {/* Directory & SD Status Badge */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={onOpenDriveModal}
            className={`flex items-center space-x-2 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/50 rounded-lg px-2.5 sm:px-3 py-1.5 transition-all text-xs max-w-[140px] sm:max-w-[200px] md:max-w-[280px] group ${
              !isConnected ? 'animate-pulse border-sky-500/40 text-sky-300' : ''
            }`}
            title="Cambiar carpeta o Tarjeta SD"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-mono text-slate-300 truncate text-[11px] sm:text-xs">
              {currentDirectory || 'Seleccionar SD...'}
            </span>
            {isConnected && activeDatabase && activeDatabase !== '/' && (
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono text-[9px] sm:text-[10px] font-bold border border-sky-500/30 hidden md:inline">
                /{activeDatabase}
              </span>
            )}
            {isWatching && (
              <span className="hidden lg:flex items-center space-x-1 pl-1 text-emerald-400 font-semibold text-[10px] shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>LIVE</span>
              </span>
            )}
          </button>

          {isConnected && onCloseDirectory && (
            <button
              onClick={onCloseDirectory}
              className="p-1.5 bg-[#0d1117] hover:bg-rose-500/20 border border-[#30363d] hover:border-rose-500/50 text-slate-400 hover:text-rose-400 rounded-lg transition-all shrink-0"
              title="Cerrar ubicación actual y volver a la pantalla de bienvenida"
            >
              <FolderX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center Navigation Tabs - Only when connected */}
      {isConnected ? (
        <div className="flex items-center bg-[#0d1117] p-1 rounded-xl border border-[#30363d] shrink-0">
          <button
            onClick={() => setActiveTab('tables')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'tables'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2128]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Explorador de Tablas</span>
            <span className="md:hidden">Tablas</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'sql'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2128]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Consola SQL</span>
            <span className="md:hidden">SQL</span>
          </button>

          <button
            onClick={() => setActiveTab('sectors')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'sectors'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2128]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Mapa de Sectores</span>
            <span className="lg:hidden">Sectores</span>
          </button>
        </div>
      ) : (
        <div className="hidden md:flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-slate-600"></span>
          <span>Sin tarjeta SD o directorio conectado</span>
        </div>
      )}

      {/* Right Global Action Buttons */}
      <div className="flex items-center space-x-2 shrink-0">
        {isConnected ? (
          <>
            {/* DBeaver Bridge Button */}
            <button
              onClick={onOpenDBeaverModal}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 border border-amber-500/40 text-amber-300 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              title="Conectar con DBeaver mediante SQLite Bridge"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DBeaver</span>
            </button>

            {/* Export Modal Button */}
            <button
              onClick={onOpenExportModal}
              className="flex items-center space-x-1.5 bg-[#21262d] hover:bg-[#30363d] text-slate-200 border border-[#30363d] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              title="Exportar a CSV, Excel, JSON o SQL"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {/* New Table Button */}
            <button
              onClick={onOpenNewTableModal}
              className="flex items-center space-x-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nueva Tabla</span>
              <span className="sm:hidden">+ Tabla</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="p-2 bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white rounded-lg border border-[#30363d] transition-all hover:rotate-180 duration-300"
              title="Recargar archivos de la SD"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={onOpenDriveModal}
            className="flex items-center space-x-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Conectar SD</span>
          </button>
        )}
      </div>
    </header>
  );
};
