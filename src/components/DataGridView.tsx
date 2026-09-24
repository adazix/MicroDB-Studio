// ============================================================================
// MICRODB STUDIO - GRILLA INTERACTIVA CRUD Y VISOR DE REGISTROS
// ============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  ArrowUpDown,
  Layers,
  Link as LinkIcon,
  ShieldCheck,
  Key,
  ArrowLeft,
  ExternalLink,
  Zap
} from 'lucide-react';
import { TableSchema, TableHeaderData, DecodedRecord, FieldSchema } from '../types/microdb.js';

export interface RelationNavigationContext {
  fromTable: string;
  targetRecordId?: number;
  fieldName: string;
}

interface DataGridViewProps {
  tableName: string;
  header: TableHeaderData;
  schema: TableSchema;
  records: DecodedRecord[];
  allTableNames?: string[];
  navigationContext?: RelationNavigationContext | null;
  onNavigateToRelation?: (targetTable: string, targetRecordId?: number) => void;
  onReturnFromRelation?: () => void;
  onInsertClick: () => void;
  onEditClick: (record: DecodedRecord) => void;
  onDeleteClick: (slotIndex: number) => void;
  onInspectHexClick: (record: DecodedRecord) => void;
  onDropTableClick?: () => void;
  onVacuumClick?: () => void;
}

// Criterio estricto: Sólo es Clave Foránea si está explícitamente definida en el esquema (isForeignKey + referencesTable)
function isFieldForeignKey(field: FieldSchema, allTableNames: string[] = []): { isFk: boolean; targetTable?: string } {
  if (field.isForeignKey && field.referencesTable) {
    const match = allTableNames.find((t) => t.toLowerCase() === field.referencesTable!.toLowerCase());
    return { isFk: true, targetTable: match || field.referencesTable };
  }
  return { isFk: false };
}

export const DataGridView: React.FC<DataGridViewProps> = ({
  tableName,
  header,
  schema,
  records,
  allTableNames = [],
  navigationContext,
  onNavigateToRelation,
  onReturnFromRelation,
  onInsertClick,
  onEditClick,
  onDeleteClick,
  onInspectHexClick,
  onDropTableClick,
  onVacuumClick
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [sortField, setSortField] = useState<string>('_recordId');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState(1);
  const [onlyShowRelatedId, setOnlyShowRelatedId] = useState<boolean>(true);
  const pageSize = 25;

  // Resetear filtros y búsqueda al cambiar de tabla
  useEffect(() => {
    setSearch('');
    setPage(1);
    setStatusFilter('all');
    setOnlyShowRelatedId(true);
  }, [tableName]);

  // Filter & Sort
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        // Filtro específico de navegación de relación (si está activo y no se ha cancelado)
        if (navigationContext?.targetRecordId !== undefined && onlyShowRelatedId) {
          if (r._recordId !== navigationContext.targetRecordId) return false;
        }

        // Status filter
        if (statusFilter === 'active' && r._status !== 1) return false;
        if (statusFilter === 'deleted' && r._status !== 0) return false;

        // Search text
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return Object.values(r).some((val) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [records, statusFilter, search, sortField, sortAsc, navigationContext, onlyShowRelatedId]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Relation Back Navigation Banner */}
      {navigationContext && onReturnFromRelation && (
        <div className="bg-sky-950/40 border-b border-sky-500/30 px-5 py-2.5 flex items-center justify-between text-xs select-none animate-in fade-in duration-200">
          <div className="flex items-center space-x-3">
            <button
              onClick={onReturnFromRelation}
              className="flex items-center space-x-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a {navigationContext.fromTable}</span>
            </button>
            <span className="text-slate-300">
              Consultando relación foránea desde <strong className="text-white font-mono">{navigationContext.fromTable}.{navigationContext.fieldName}</strong> (ID #{navigationContext.targetRecordId})
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onlyShowRelatedId ? (
              <button
                onClick={() => setOnlyShowRelatedId(false)}
                className="text-sky-400 hover:text-sky-300 underline text-[11px] font-semibold"
              >
                Ver todas las filas de {tableName}
              </button>
            ) : (
              <button
                onClick={() => setOnlyShowRelatedId(true)}
                className="text-sky-400 hover:text-sky-300 underline text-[11px] font-semibold"
              >
                Filtrar solo ID #{navigationContext.targetRecordId}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table Toolbar */}
      <div className="p-4 border-b border-[#30363d] bg-[#161b22] flex flex-wrap items-center justify-between gap-4 select-none">
        {/* Left info & Table title */}
        <div className="flex items-center space-x-4">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-extrabold text-lg text-white font-mono">{tableName}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#21262d] text-slate-300 border border-[#30363d] font-mono">
                {header.recordSize} bytes/payload
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {header.activeRecords} registros activos • {header.deletedRecords} reciclables en Free-List (Total {header.totalSlots} slots)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {onVacuumClick && (
              <button
                onClick={onVacuumClick}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  header.deletedRecords > 0
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/10'
                    : 'bg-[#21262d] hover:bg-[#30363d] border-[#30363d] text-slate-400 hover:text-slate-200'
                }`}
                title={
                  header.deletedRecords > 0
                    ? `Compactar tabla y eliminar definitivamente ${header.deletedRecords} registro(s) borrado(s) (Vacuum)`
                    : 'Ejecutar mantenimiento Vacuum (la tabla ya está compactada)'
                }
              >
                <Zap className={`w-3.5 h-3.5 ${header.deletedRecords > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Vacuum</span>
                {header.deletedRecords > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/30 text-amber-200">
                    {header.deletedRecords}
                  </span>
                )}
              </button>
            )}

            {onDropTableClick && (
              <button
                onClick={onDropTableClick}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-400 transition-colors"
                title="Eliminar tabla y archivos de la SD"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Tabla</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Search, Filter & Actions */}
        <div className="flex items-center space-x-3">
          {/* Status Filter */}
          <div className="flex items-center bg-[#0d1117] rounded-lg p-1 border border-[#30363d] text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${statusFilter === 'all' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
            >
              Todos ({records.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${statusFilter === 'active' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
            >
              Activos ({header.activeRecords})
            </button>
            <button
              onClick={() => setStatusFilter('deleted')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${statusFilter === 'deleted' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
            >
              Borrados ({header.deletedRecords})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar registros..."
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none transition-colors"
            />
          </div>

          {/* Insert Record Button */}
          <button
            onClick={onInsertClick}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-all shadow-md shadow-sky-500/20 flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Insertar Registro</span>
          </button>
        </div>
      </div>

      {/* Banner for Deleted Records / Vacuum Action */}
      {statusFilter === 'deleted' && header.deletedRecords > 0 && onVacuumClick && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Hay <strong className="text-white font-mono">{header.deletedRecords}</strong> registro(s) borrado(s) temporalmente (Tombstones en Free-List). Ocupan espacio físico en la SD hasta que se ejecute Vacuum.
            </span>
          </div>
          <button
            onClick={onVacuumClick}
            className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md shadow-amber-500/20 flex items-center space-x-1.5 shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Purgar con Vacuum</span>
          </button>
        </div>
      )}

      {/* Main Table Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-[#161b22] sticky top-0 z-10 border-b border-[#30363d] shadow-sm select-none">
            <tr>
              {/* Slot Indicator Header */}
              <th className="p-3 w-16 text-slate-400 font-mono text-center" title="Índice de Slot físico en disco (0 a N) y estado binario (0x01 Activo, 0x00 Borrado)">
                #Slot
              </th>

              {/* Primary Key ID */}
              <th
                onClick={() => handleSort('_recordId')}
                className="p-3 font-mono font-bold text-sky-400 cursor-pointer hover:bg-[#21262d] transition-colors"
                title="Clave Primaria autoincremental"
              >
                <div className="flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-sky-400" />
                  <span>ID</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                    PK
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* Dynamic Columns from Schema */}
              {schema.fields.map((field) => {
                const { isFk, targetTable } = isFieldForeignKey(field, allTableNames);

                return (
                  <th
                    key={field.name}
                    onClick={() => handleSort(field.name)}
                    className="p-3 font-semibold text-slate-200 cursor-pointer hover:bg-[#21262d] transition-colors"
                  >
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      {isFk && <LinkIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                      <span className="font-mono text-slate-100">{field.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal font-mono">({field.type})</span>

                      {field.isPrimaryKey && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          PK
                        </span>
                      )}

                      {field.isUnique && (
                        <span
                          className="flex items-center space-x-0.5 text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                          title="Restricción de Valor Único (UNIQUE constraint)"
                        >
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>UQ</span>
                        </span>
                      )}

                      {isFk && (
                        <span
                          className="text-[9px] px-1.5 py-0.2 rounded bg-[#21262d] text-sky-300 font-bold border border-[#30363d] font-mono"
                          title={`Clave Foránea hacia tabla '${targetTable}' (Haz clic en un registro para abrir la relación)`}
                        >
                          FK → {targetTable}
                        </span>
                      )}

                      <ArrowUpDown className="w-3 h-3 text-slate-500 ml-auto" />
                    </div>
                  </th>
                );
              })}

              <th className="p-3 text-right text-slate-400 pr-5">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#21262d]">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={schema.fields.length + 3} className="text-center py-16 text-slate-500">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-40" />
                  <p className="font-semibold">No hay registros para mostrar</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Inserta un nuevo registro o cambia los filtros de búsqueda</p>
                </td>
              </tr>
            ) : (
              paginatedRecords.map((rec) => {
                const isActive = rec._status === 1;
                const isTargetHighlighted = navigationContext?.targetRecordId === rec._recordId;

                return (
                  <tr
                    key={rec._slotIndex}
                    className={`group transition-colors ${isTargetHighlighted
                        ? 'bg-sky-500/15 border border-sky-500/40 text-white font-medium shadow-sm'
                        : rec._isNew
                          ? 'animate-new-record'
                          : isActive
                            ? 'hover:bg-[#161b22]/80 bg-[#0d1117]'
                            : 'bg-rose-950/15 hover:bg-rose-950/25 text-slate-400 opacity-75'
                      }`}
                  >
                    {/* Slot Index + Status Dot Indicator */}
                    <td className="p-3 font-mono text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${isActive
                              ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                              : 'bg-rose-400 shadow-sm shadow-rose-400/50'
                            }`}
                          title={isActive ? 'Slot Físico Activo (0x01)' : 'Slot Físico Marcado como Borrado (Tombstone 0x00) en Free-List'}
                        />
                        <span className="text-slate-400">{rec._slotIndex}</span>
                      </div>
                    </td>

                    {/* Record ID & Tombstone Pill if deleted */}
                    <td className="p-3 font-mono font-bold">
                      {isActive ? (
                        <span className="text-sky-400">#{rec._recordId}</span>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <span className="line-through text-slate-500">#{rec._recordId}</span>
                          <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            BORRADO
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Dynamic Fields */}
                    {schema.fields.map((field) => {
                      const val = rec[field.name];
                      const { isFk, targetTable } = isFieldForeignKey(field, allTableNames);

                      return (
                        <td key={field.name} className="p-3 font-mono text-slate-300">
                          {isFk && val !== undefined && val !== null ? (
                            /* Botón Interactivo de Clave Foránea / Relación (Navegar a tabla padre) */
                            <button
                              type="button"
                              onClick={() => {
                                if (onNavigateToRelation && targetTable) {
                                  onNavigateToRelation(targetTable, Number(val));
                                }
                              }}
                              className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-[#161b22] hover:bg-sky-500/20 text-slate-200 hover:text-sky-300 border border-[#30363d] hover:border-sky-500/40 font-semibold transition-all group/fk cursor-pointer"
                              title={`Abrir registro #${val} en tabla '${targetTable}'`}
                            >
                              <LinkIcon className="w-3 h-3 text-sky-400 group-hover/fk:scale-110 transition-transform" />
                              <span>#{val}</span>
                              {targetTable && (
                                <span className="text-[9px] font-sans font-bold text-slate-400 group-hover/fk:text-sky-300 uppercase pl-1 border-l border-[#30363d]">
                                  {targetTable}
                                </span>
                              )}
                              <ExternalLink className="w-2.5 h-2.5 text-slate-500 group-hover/fk:text-sky-400 ml-0.5 opacity-60 group-hover/fk:opacity-100" />
                            </button>
                          ) : field.type === 'bool' ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${val
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                              <span>{val ? 'TRUE' : 'FALSE'}</span>
                            </span>
                          ) : field.type === 'blob' ? (
                            <span className="bg-[#161b22] px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px] border border-[#30363d]">
                              0x{val || ''}
                            </span>
                          ) : field.type === 'json' ? (
                            <span className="text-violet-300 font-mono text-[11px] truncate max-w-xs block" title={String(val)}>
                              {String(val || '')}
                            </span>
                          ) : field.type === 'media_path' ? (
                            <span className="text-sky-300 font-mono text-[11px] underline cursor-pointer" title="Ruta en SD">
                              {String(val || '')}
                            </span>
                          ) : field.isUnique ? (
                            <span className="text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              {val !== undefined && val !== null ? String(val) : '—'}
                            </span>
                          ) : (
                            <span className="text-slate-300">
                              {val !== undefined && val !== null ? String(val) : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions */}
                    <td className="p-3 text-right pr-5">
                      <div className="flex items-center justify-end space-x-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onInspectHexClick(rec)}
                          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-[#21262d] rounded transition-colors"
                          title="Inspeccionar Bytes Crudos (HEX)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {isActive && (
                          <>
                            <button
                              onClick={() => onEditClick(rec)}
                              className="p-1 text-slate-400 hover:text-sky-400 hover:bg-[#21262d] rounded transition-colors"
                              title="Editar registro in-place"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteClick(rec._slotIndex)}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-[#21262d] rounded transition-colors"
                              title="Borrar (Tombstone O(1))"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-[#30363d] bg-[#161b22] flex items-center justify-between text-xs text-slate-400 select-none">
        <div>
          Mostrando {filteredRecords.length > 0 ? (page - 1) * pageSize + 1 : 0} a{' '}
          {Math.min(page * pageSize, filteredRecords.length)} de {filteredRecords.length} registros
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-[#0d1117] hover:bg-[#21262d] disabled:opacity-40 rounded-lg border border-[#30363d] text-white transition-colors"
          >
            Anterior
          </button>
          <span className="font-mono text-slate-300 font-semibold px-2">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-[#0d1117] hover:bg-[#21262d] disabled:opacity-40 rounded-lg border border-[#30363d] text-white transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
};
