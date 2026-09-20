// ============================================================================
// MICRODB STUDIO - VISOR HEXADECIMAL DE SLOTS Y BYTES CRUDOS
// ============================================================================

import React from 'react';
import { X, Eye } from 'lucide-react';
import { DecodedRecord } from '../types/microdb.js';

interface HexInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DecodedRecord | null;
  tableName: string;
}

export const HexInspectorModal: React.FC<HexInspectorModalProps> = ({
  isOpen,
  onClose,
  record,
  tableName
}) => {
  if (!isOpen || !record) return null;

  const hexString = record._rawHex || '';
  // Format hex in blocks of 16 bytes (32 hex characters)
  const rows: { offset: number; hexParts: string[]; ascii: string }[] = [];

  for (let i = 0; i < hexString.length; i += 32) {
    const chunk = hexString.substring(i, i + 32);
    const hexParts: string[] = [];
    let ascii = '';

    for (let j = 0; j < chunk.length; j += 2) {
      const byteHex = chunk.substring(j, j + 2);
      hexParts.push(byteHex);
      const byteVal = parseInt(byteHex, 16);
      if (byteVal >= 32 && byteVal <= 126) {
        ascii += String.fromCharCode(byteVal);
      } else {
        ascii += '•';
      }
    }

    rows.push({
      offset: i / 2,
      hexParts,
      ascii
    });
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Inspección de Bytes Crudos (HEX) • Slot #{record._slotIndex}
              </h3>
              <p className="text-xs text-slate-400">
                Tabla: <strong className="text-sky-300 font-mono">{tableName}</strong> • ID: #{record._recordId}
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
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Total Payload: {hexString.length / 2} Bytes</span>
            <span>Little-Endian Encoding</span>
          </div>

          <div className="p-4 bg-[#0d1117] rounded-xl border border-[#30363d] font-mono text-xs overflow-x-auto select-text">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500 border-b border-[#21262d] text-left">
                  <th className="pb-2 w-20">Offset</th>
                  <th className="pb-2">Bytes (Hexadecimal)</th>
                  <th className="pb-2 w-32">ASCII</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]/50">
                {rows.map((r) => (
                  <tr key={r.offset} className="hover:bg-[#161b22]">
                    <td className="py-1.5 text-sky-400">
                      0x{r.offset.toString(16).padStart(4, '0').toUpperCase()}
                    </td>
                    <td className="py-1.5 text-amber-300 tracking-wider">
                      {r.hexParts.join(' ')}
                    </td>
                    <td className="py-1.5 text-emerald-400">{r.ascii}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#21262d] text-white hover:bg-[#30363d] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
