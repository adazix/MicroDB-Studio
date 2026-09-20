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
  FolderOpen
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'tables' | 'sql' | 'sectors';
  setActiveTab: (tab: 'tables' | 'sql' | 'sectors') => void;
  currentDirectory: string | null;
  activeDatabase?: string;
  onOpenDriveModal: () => void;
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
  onOpenDBeaverModal,
  onOpenExportModal,
  onOpenNewTableModal,
  onRefresh,
  isWatching
}) => {
  return (
    <header className="h-16 bg-[#161b22] border-b border-[#30363d] px-5 flex items-center justify-between z-30 select-none">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('tables')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg text-white tracking-tight">MicroDB</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                STUDIO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">SD & Embedded DB Manager</p>
          </div>
        </div>

        {/* Directory & SD Status Badge */}
        <button
          onClick={onOpenDriveModal}
          className="flex items-center space-x-2 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/50 rounded-lg px-3 py-1.5 transition-all text-xs max-w-sm group"
          title="Cambiar carpeta o Tarjeta SD"
        >
          <FolderOpen className="w-4 h-4 text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="font-mono text-slate-300 truncate max-w-[220px]">
            {currentDirectory || 'Seleccionar SD o Carpeta...'}
          </span>
          {activeDatabase && activeDatabase !== '/' && (
            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold border border-sky-500/30">
              /{activeDatabase}
            </span>
          )}
          {isWatching && (
            <span className="flex items-center space-x-1 pl-1 text-emerald-400 font-semibold text-[10px] shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LIVE SD</span>
            </span>
          )}
        </button>
      </div>

      {/* Center Navigation Tabs */}
      <div className="flex items-center bg-[#0d1117] p-1 rounded-xl border border-[#30363d]">
        <button
          onClick={() => setActiveTab('tables')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'tables'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2128]'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Explorador de Tablas</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'sql'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2128]'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Consola SQL</span>
        </button>

        <button
          onClick={() => setActiveTab('sectors')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'sectors'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2128]'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Mapa de Sectores & Salud</span>
        </button>
      </div>

      {/* Right Global Action Buttons */}
      <div className="flex items-center space-x-3">
        {/* DBeaver Bridge Button */}
        <button
          onClick={onOpenDBeaverModal}
          className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
          title="Conectar con DBeaver mediante SQLite Bridge"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Puente DBeaver</span>
        </button>

        {/* Export Modal Button */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center space-x-1.5 bg-[#21262d] hover:bg-[#30363d] text-slate-200 border border-[#30363d] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
          title="Exportar a CSV, Excel, JSON o SQL"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>

        {/* New Table Button */}
        <button
          onClick={onOpenNewTableModal}
          className="flex items-center space-x-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Nueva Tabla</span>
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="p-2 bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white rounded-lg border border-[#30363d] transition-all hover:rotate-180 duration-300"
          title="Recargar archivos de la SD"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
