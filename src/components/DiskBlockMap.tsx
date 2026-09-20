// ============================================================================
// MICRODB STUDIO - MAPA DE SECTORES Y SALUD DE ALMACENAMIENTO EN DISCO
// Visualización gráfica estilo defragmentador de slots activos, tombstones y free-list
// ============================================================================

import React, { useState } from 'react';
import {
  Radio,
  CheckCircle2,
  Trash2,
  HardDrive,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { TableSummary, DecodedRecord, TableHeaderData } from '../types/microdb.js';

interface DiskBlockMapProps {
  table: TableSummary;
  records: DecodedRecord[];
  onOpenVacuum: () => void;
}

export const DiskBlockMap: React.FC<DiskBlockMapProps> = ({ table, records, onOpenVacuum }) => {
  const [hoveredRecord, setHoveredRecord] = useState<DecodedRecord | null>(null);
  const header = table.header;
  const frag = table.fragmentationPercent;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-y-auto p-6 space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Slots */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-1 shadow-lg">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Slots Reservados</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-white font-mono">{header.totalSlots}</span>
            <span className="text-xs text-slate-500 font-mono">slots</span>
          </div>
          <p className="text-[11px] text-slate-400">Tamaño archivo: {(table.fileSizeBytes / 1024).toFixed(2)} KB</p>
        </div>

        {/* Active Records */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-1 shadow-lg">
          <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Registros Activos</span>
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">{header.activeRecords}</span>
            <span className="text-xs text-slate-500 font-mono">slots O(1)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {header.totalSlots > 0 ? ((header.activeRecords / header.totalSlots) * 100).toFixed(1) : 0}% ocupación útil
          </p>
        </div>

        {/* Deleted Records / Free-List */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-1 shadow-lg">
          <span className="text-xs text-rose-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Slots en Free-List (Tombstone)</span>
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-rose-400 font-mono">{header.deletedRecords}</span>
            <span className="text-xs text-slate-500 font-mono">reciclables</span>
          </div>
          <p className="text-[11px] text-slate-400">Cabeza Free-List: #{header.firstFreeSlot === 0xFFFFFFFF ? 'Ninguna' : header.firstFreeSlot}</p>
        </div>

        {/* Fragmentation & Vacuum Action */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div>
            <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Fragmentación</span>
            <div className="text-2xl font-extrabold font-mono text-white mt-1">{frag}%</div>
          </div>
          {frag > 0 && (
            <button
              onClick={onOpenVacuum}
              className="mt-2 w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs py-1.5 rounded-xl transition-all"
            >
              Compactar (Vacuum)
            </button>
          )}
        </div>
      </div>

      {/* Main Sector Grid View */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-sm text-white">Mapa Físico de Slots en la Tarjeta SD</h3>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-500 shadow-sm shadow-emerald-500/30"></span>
              <span className="text-slate-300 font-medium">Activo (RECORD_ACTIVE)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-500 shadow-sm shadow-rose-500/30"></span>
              <span className="text-slate-300 font-medium">Borrado (Free-List Tombstone)</span>
            </div>
          </div>
        </div>

        {/* Sector Blocks Grid */}
        <div className="p-4 bg-[#0d1117] rounded-xl border border-[#30363d] min-h-[220px]">
          {records.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-600" />
              <p className="font-semibold text-xs">La tabla no contiene slots reservados aún</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {records.map((rec) => {
                const isActive = rec._status === 1;
                const isHovered = hoveredRecord?._slotIndex === rec._slotIndex;

                return (
                  <div
                    key={rec._slotIndex}
                    onMouseEnter={() => setHoveredRecord(rec)}
                    className={`w-7 h-7 rounded-lg font-mono text-[10px] font-bold flex items-center justify-center cursor-pointer transition-all ${
                      isActive
                        ? 'bg-emerald-500/80 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-rose-500/80 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20'
                    } ${isHovered ? 'scale-125 z-10 ring-2 ring-white' : ''}`}
                    title={`Slot #${rec._slotIndex} • ${isActive ? `ID #${rec._recordId} (Activo)` : `Borrado (Next: ${rec._nextFreeSlot})`}`}
                  >
                    {rec._slotIndex}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Slot Inspector Details */}
        {hoveredRecord && (
          <div className="p-4 bg-[#0d1117] border border-sky-500/30 rounded-xl space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-sky-400 text-sm">
                  Detalles del Slot Físico #{hoveredRecord._slotIndex}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    hoveredRecord._status === 1
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {hoveredRecord._status === 1 ? `Activo (ID #${hoveredRecord._recordId})` : `Borrado / Tombstone`}
                </span>
              </div>
              <span className="font-mono text-xs text-slate-400">
                Offset en Disco: {64 + hoveredRecord._slotIndex * (9 + header.recordSize)} Bytes
              </span>
            </div>

            <div className="text-xs text-slate-300 font-mono bg-[#161b22] p-2.5 rounded-lg overflow-x-auto border border-[#30363d]">
              {JSON.stringify(
                Object.fromEntries(Object.entries(hoveredRecord).filter(([k]) => !k.startsWith('_'))),
                null,
                2
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
