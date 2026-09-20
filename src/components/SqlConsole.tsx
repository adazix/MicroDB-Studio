// ============================================================================
// MICRODB STUDIO - CONSOLA DE CONSULTAS SQL Y RELACIONALES
// Permite escribir y ejecutar cualquier consulta SQL estándar sobre las tablas MicroDB
// ============================================================================

import React, { useState } from 'react';
import {
  Play,
  Copy,
  Check,
  Download,
  Terminal,
  Clock,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { executeSqlQuery, exportData } from '../utils/api.js';
import { SqlQueryResult, TableSummary } from '../types/microdb.js';
import { useToast } from './Toast.js';

interface SqlConsoleProps {
  tables: TableSummary[];
  selectedTable: string | null;
}

export const SqlConsole: React.FC<SqlConsoleProps> = ({ tables, selectedTable }) => {
  const defaultTable = selectedTable || (tables.length > 0 ? tables[0].name : 'tabla');
  const [sql, setSql] = useState<string>(`SELECT * FROM "${defaultTable}" LIMIT 50;`);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await executeSqlQuery(sql);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Error ejecutando consulta SQL');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { showSuccess, showError } = useToast();

  const handleExportResult = async (format: 'csv' | 'xlsx' | 'json') => {
    if (!result || result.rows.length === 0) return;
    try {
      const blob = await exportData({
        format,
        customRecords: result.rows
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query_result_${Date.now()}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Exportación Exitosa', `Archivo ${format.toUpperCase()} descargado correctamente.`);
    } catch (err: any) {
      showError('Error al exportar', err.message);
    }
  };

  // SQL Quick Snippets
  const snippets = [
    { label: 'Select Todo', query: `SELECT * FROM "${defaultTable}" LIMIT 50;` },
    { label: 'Conteo y Métricas', query: `SELECT COUNT(*) as total_filas FROM "${defaultTable}";` },
    { label: 'Filtro WHERE', query: `SELECT * FROM "${defaultTable}" WHERE id > 0 ORDER BY id DESC;` }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Top SQL Editor Bar */}
      <div className="p-4 border-b border-[#30363d] bg-[#161b22] space-y-3 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-sky-400" />
            <h2 className="font-bold text-xs text-white uppercase tracking-wider">
              Consola SQL Interactiva (Compatible con DBeaver & SQLite)
            </h2>
          </div>

          {/* Quick Snippets */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400">Plantillas:</span>
            {snippets.map((snip) => (
              <button
                key={snip.label}
                onClick={() => setSql(snip.query)}
                className="text-[11px] px-2.5 py-1 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded-lg text-slate-300 hover:text-sky-300 font-semibold transition-colors"
              >
                {snip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Code Input Box */}
        <div className="relative">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={4}
            placeholder="Escribe tu consulta SQL aquí... Ej: SELECT * FROM alldata WHERE sensorVoltage > 3.0"
            className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-xl p-3.5 text-xs text-emerald-400 font-mono focus:outline-none transition-colors leading-relaxed resize-none selection:bg-emerald-500/30 selection:text-white"
          />
          <div className="absolute right-3 bottom-3 flex items-center space-x-2">
            <button
              onClick={handleExecute}
              disabled={loading || !sql.trim()}
              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-md shadow-sky-500/20 flex items-center space-x-2 active:scale-95"
            >
              <Play className={`w-3.5 h-3.5 fill-white ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Ejecutando...' : 'Ejecutar (F5 / Run)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Header / Stats */}
      <div className="px-4 py-2.5 bg-[#161b22]/70 border-b border-[#30363d] flex items-center justify-between text-xs select-none">
        <div className="flex items-center space-x-4">
          <span className="font-semibold text-slate-300">
            {result ? `${result.rows.length} filas retornadas` : 'Resultados de consulta'}
          </span>
          {result && (
            <span className="flex items-center space-x-1 text-slate-400 font-mono text-[11px]">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>{result.executionTimeMs} ms</span>
            </span>
          )}
        </div>

        {result && result.rows.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyClipboard}
              className="flex items-center space-x-1 px-2.5 py-1 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded-lg text-slate-300 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
            </button>

            <button
              onClick={() => handleExportResult('csv')}
              className="flex items-center space-x-1 px-2.5 py-1 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded-lg text-slate-300 hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={() => handleExportResult('xlsx')}
              className="flex items-center space-x-1 px-2.5 py-1 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded-lg text-slate-300 hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar Excel</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Results Table */}
      <div className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Error en la ejecución de SQL</p>
              <p className="font-mono mt-1 text-slate-300">{error}</p>
            </div>
          </div>
        ) : !result ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
            <Terminal className="w-12 h-12 text-slate-600 opacity-40 mb-3" />
            <p className="font-semibold text-sm">Listo para ejecutar consultas SQL</p>
            <p className="text-xs text-slate-600 mt-1">Escribe tu consulta y haz clic en "Ejecutar"</p>
          </div>
        ) : result.rows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
            <FileSpreadsheet className="w-12 h-12 text-slate-600 opacity-40 mb-3" />
            <p className="font-semibold text-sm">La consulta se ejecutó con éxito pero no retornó filas</p>
          </div>
        ) : (
          <div className="border border-[#30363d] rounded-xl overflow-hidden shadow-lg bg-[#161b22]">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead className="bg-[#0d1117] border-b border-[#30363d]">
                <tr>
                  {result.columns.map((col) => (
                    <th key={col} className="p-3 text-sky-400 font-bold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]">
                {result.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#1c2128] transition-colors">
                    {result.columns.map((col) => {
                      const val = row[col];
                      return (
                        <td key={col} className="p-3 text-slate-300">
                          {val !== null && val !== undefined ? String(val) : <span className="text-slate-600">NULL</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
