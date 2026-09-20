// ============================================================================
// MICRODB STUDIO - EXPLORADOR LATERAL DE BASES DE DATOS, TABLAS E ÍNDICES
// ============================================================================

import React, { useState } from 'react';
import {
  Table as TableIcon,
  Search,
  Zap,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  Database,
  ChevronDown,
  Plus,
  FolderPlus
} from 'lucide-react';
import { TableSummary, DatabaseInfo } from '../types/microdb.js';

interface TableExplorerProps {
  databases: DatabaseInfo[];
  activeDatabase: string;
  onSelectDatabase: (dbName: string) => void;
  onOpenNewDatabaseModal: () => void;
  onDeleteDatabase: (dbName: string) => void;
  tables: TableSummary[];
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
  onOpenVacuumModal: (tableName: string) => void;
  onDropTable: (tableName: string) => void;
}

export const TableExplorer: React.FC<TableExplorerProps> = ({
  databases,
  activeDatabase,
  onSelectDatabase,
  onOpenNewDatabaseModal,
  onDeleteDatabase,
  tables,
  selectedTable,
  onSelectTable,
  onOpenVacuumModal,
  onDropTable
}) => {
  const [search, setSearch] = useState('');
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false);

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const isRootDb = activeDatabase === '/' || activeDatabase === 'Raíz';

  return (
    <aside className="w-80 bg-[#161b22] border-r border-[#30363d] flex flex-col h-full select-none">
      {/* Database Selector Section */}
      <div className="p-3 border-b border-[#30363d] bg-[#0d1117]/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <span>Base de Datos Activa</span>
          </span>
          <button
            onClick={onOpenNewDatabaseModal}
            className="flex items-center space-x-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 px-2 py-0.5 rounded transition-all"
            title="Crear nueva base de datos en la tarjeta SD"
          >
            <Plus className="w-3 h-3" />
            <span>Nueva BD</span>
          </button>
        </div>

        {/* Database Switcher Button */}
        <div className="relative">
          <div
            onClick={() => setDbDropdownOpen(!dbDropdownOpen)}
            className="w-full bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/50 rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer transition-all group"
          >
            <div className="flex items-center space-x-2.5 truncate">
              <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Database className="w-3.5 h-3.5" />
              </div>
              <div className="truncate text-left">
                <div className="font-bold text-xs text-white truncate">
                  {isRootDb ? 'Raíz de la SD (/)' : `/${activeDatabase}`}
                </div>
                <div className="text-[10px] text-slate-400">
                  {tables.length} tabla{tables.length !== 1 ? 's' : ''} disponible{tables.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                dbDropdownOpen ? 'rotate-180 text-sky-400' : ''
              }`}
            />
          </div>

          {/* Dropdown Menu */}
          {dbDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDbDropdownOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-1.5 space-y-1 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Bases de Datos en la SD ({databases.length})
                </div>

                {databases.map((db) => {
                  const isSelected = db.name === activeDatabase;
                  const isRoot = db.name === '/' || db.name === 'Raíz';

                  return (
                    <div
                      key={db.name}
                      onClick={() => {
                        onSelectDatabase(db.name);
                        setDbDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-xs ${
                        isSelected
                          ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                          : 'hover:bg-[#21262d] text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Database className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                        <span className="truncate">
                          {isRoot ? 'Raíz (/)' : `/${db.name}`}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[10px] bg-[#0d1117] px-1.5 py-0.5 rounded text-slate-400 font-mono">
                          {db.tableCount} {db.tableCount === 1 ? 'tbl' : 'tbls'}
                        </span>
                        {!isRoot && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDbDropdownOpen(false);
                              onDeleteDatabase(db.name);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            title={`Eliminar carpeta de base de datos '${db.name}'`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add new DB button inside dropdown */}
                <button
                  onClick={() => {
                    setDbDropdownOpen(false);
                    onOpenNewDatabaseModal();
                  }}
                  className="w-full flex items-center justify-center space-x-1.5 p-2 rounded-lg text-xs font-semibold text-sky-400 hover:bg-sky-500/10 transition-colors border-t border-[#30363d]/50 mt-1"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Crear Nueva Base de Datos</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search Header */}
      <div className="p-3 border-b border-[#30363d] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TableIcon className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-bold text-xs text-white uppercase tracking-wider">Tablas</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#0d1117] text-slate-400 border border-[#30363d]">
            {tables.length}
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar tablas..."
            className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredTables.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold">No se encontraron tablas</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Crea una nueva tabla con el botón superior o escribe desde Arduino
            </p>
          </div>
        ) : (
          filteredTables.map((table) => {
            const isSelected = selectedTable === table.name;
            const frag = table.fragmentationPercent;

            return (
              <div
                key={table.name}
                onClick={() => onSelectTable(table.name)}
                className={`p-3 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
                  isSelected
                    ? 'bg-sky-950/40 border-sky-500/60 shadow-md shadow-sky-500/10'
                    : 'bg-[#0d1117] border-[#30363d] hover:border-slate-600 hover:bg-[#1c2128]'
                }`}
              >
                {/* Table Title & Badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white group-hover:text-sky-300 transition-colors">
                      {table.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-[#21262d] px-1.5 py-0.5 rounded">
                      .tbl
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-1.5">
                    {table.hasIndex && (
                      <span
                        className="flex items-center space-x-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        title="Índice secundario O(log N) activo (.idx)"
                      >
                        <Zap className="w-3 h-3" />
                        <span>IDX</span>
                      </span>
                    )}

                    {/* Drop Table Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDropTable(table.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                      title={`Eliminar tabla '${table.name}' de la base de datos`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>
                      <strong className="text-white font-mono">{table.header.activeRecords}</strong> activos
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>
                      <strong className="text-white font-mono">{table.header.deletedRecords}</strong> borrados
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-[#30363d]/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Slot: <strong className="text-slate-300 font-mono">{table.header.recordSize}B</strong></span>
                  <div className="flex items-center space-x-1.5">
                    <span>Frag: <strong className={frag > 20 ? 'text-amber-400' : 'text-slate-300'}>{frag}%</strong></span>
                    {frag > 20 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenVacuumModal(table.name);
                        }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline"
                      >
                        VACUUM
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
