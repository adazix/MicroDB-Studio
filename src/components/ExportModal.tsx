// ============================================================================
// MICRODB STUDIO - MODAL DE EXPORTACIÓN MULTIFORMATO
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileCode,
  FileText,
  Database
} from 'lucide-react';
import { exportData } from '../utils/api.js';
import { TableSummary } from '../types/microdb.js';
import { useToast } from './Toast.js';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: TableSummary[];
  selectedTable: string | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  tables,
  selectedTable
}) => {
  const { showSuccess, showError } = useToast();
  const [targetTable, setTargetTable] = useState<string>(selectedTable || (tables[0]?.name || ''));
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'json' | 'sql'>('xlsx');
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!targetTable) return;
    setExporting(true);
    try {
      const blob = await exportData({
        format,
        tableName: targetTable
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${targetTable}_export_${Date.now()}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Descarga Iniciada', `Tabla '${targetTable}' exportada en formato ${format.toUpperCase()}`);
      onClose();
    } catch (err: any) {
      showError('Error al exportar', err.message);
    } finally {
      setExporting(false);
    }
  };

  const formats = [
    {
      id: 'xlsx',
      name: 'Microsoft Excel (.xlsx)',
      desc: 'Formato nativo para hojas de cálculo con columnas tipadas',
      icon: FileSpreadsheet,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30'
    },
    {
      id: 'csv',
      name: 'Texto Delimitado CSV (.csv)',
      desc: 'Formato universal compatible con cualquier software de datos',
      icon: FileText,
      color: 'text-sky-400',
      border: 'border-sky-500/30'
    },
    {
      id: 'json',
      name: 'Estructura JSON (.json)',
      desc: 'Ideal para integración con APIs, Node.js y Python',
      icon: FileCode,
      color: 'text-amber-400',
      border: 'border-amber-500/30'
    },
    {
      id: 'sql',
      name: 'Script SQL Dump (.sql)',
      desc: 'Sentencias CREATE TABLE e INSERT preparadas para MySQL/PostgreSQL',
      icon: Database,
      color: 'text-violet-400',
      border: 'border-violet-500/30'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Exportar Datos de MicroDB</h3>
              <p className="text-xs text-slate-400">Descarga tus datos en formatos estándar listos para análisis</p>
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
        <div className="p-6 space-y-5">
          {/* Table Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Tabla a Exportar
            </label>
            <select
              value={targetTable}
              onChange={(e) => setTargetTable(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none"
            >
              {tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.header.activeRecords} registros activos)
                </option>
              ))}
            </select>
          </div>

          {/* Format Selector Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Formato de Archivo
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {formats.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = format === fmt.id;

                return (
                  <div
                    key={fmt.id}
                    onClick={() => setFormat(fmt.id as any)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `bg-sky-950/40 border-sky-500 shadow-md shadow-sky-500/10`
                        : `bg-[#0d1117] border-[#30363d] hover:border-slate-600 hover:bg-[#1c2128]`
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-[#161b22] border border-[#30363d] ${fmt.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-white block">{fmt.name}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{fmt.desc}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !targetTable}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Generando archivo...' : 'Descargar Archivo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
