import React, { useState, useEffect } from 'react';
import {
  X,
  PlusCircle,
  Code2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Plus,
  Trash2,
  Link,
  ShieldCheck
} from 'lucide-react';
import { createTable, parseCppStruct, fetchTables } from '../utils/api.js';
import { TableSchema, FieldSchema, SupportedFieldType } from '../types/microdb.js';

interface NewTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTableCreated: (tableName: string) => void;
}

const AVAILABLE_TYPES: { type: SupportedFieldType; label: string; bytes: number }[] = [
  { type: 'bool', label: 'bool (Booleano)', bytes: 1 },
  { type: 'int8', label: 'int8_t / signed char', bytes: 1 },
  { type: 'uint8', label: 'uint8_t / byte', bytes: 1 },
  { type: 'int16', label: 'int16_t / short', bytes: 2 },
  { type: 'uint16', label: 'uint16_t / unsigned short', bytes: 2 },
  { type: 'int32', label: 'int32_t / int / long', bytes: 4 },
  { type: 'uint32', label: 'uint32_t / unsigned long', bytes: 4 },
  { type: 'int64', label: 'int64_t / long long', bytes: 8 },
  { type: 'uint64', label: 'uint64_t / unsigned long long', bytes: 8 },
  { type: 'float', label: 'float (Decimal 32 bits)', bytes: 4 },
  { type: 'double', label: 'double (Decimal 64 bits / GPS)', bytes: 8 },
  { type: 'string', label: 'char[N] (Texto C-String)', bytes: 1 },
  { type: 'blob', label: 'uint8_t[N] (BLOB / Hex)', bytes: 1 },
  { type: 'json', label: 'JSON (char[N] formateado)', bytes: 1 },
  { type: 'media_path', label: 'Puntero Archivo SD (char[N])', bytes: 1 }
];

export const NewTableModal: React.FC<NewTableModalProps> = ({
  isOpen,
  onClose,
  onTableCreated
}) => {
  const [mode, setMode] = useState<'visual' | 'cpp'>('visual');
  const [tableName, setTableName] = useState('');
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [fields, setFields] = useState<FieldSchema[]>([
    { name: 'timestamp', type: 'uint32', byteSize: 4, offset: 0 },
    { name: 'temperatura', type: 'float', byteSize: 4, offset: 4 },
    { name: 'dispositivo', type: 'string', byteSize: 16, arrayLength: 16, offset: 8 }
  ]);
  const [cppCode, setCppCode] = useState(
    `struct SensorLog {\n  uint32_t timestamp;\n  float    temperature;\n  float    humidity;\n  uint8_t  battery;\n  char     nodeName[16];\n};`
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTables()
        .then((data) => {
          setAvailableTables(data.tables.map((t) => t.name));
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Recalcular layout visual
  const recalculateFields = (fList: FieldSchema[]): { fields: FieldSchema[]; totalSize: number } => {
    let offset = 0;
    const computed = fList.map((f) => {
      const typeInfo = AVAILABLE_TYPES.find((t) => t.type === f.type);
      const base = typeInfo ? typeInfo.bytes : 1;
      const totalByteSize = f.arrayLength && f.arrayLength > 0 ? base * f.arrayLength : base;
      const res = { ...f, offset, byteSize: totalByteSize };
      offset += totalByteSize;
      return res;
    });
    return { fields: computed, totalSize: offset };
  };

  const handleAddField = () => {
    const newField: FieldSchema = {
      name: `col_${fields.length + 1}`,
      type: 'uint32',
      byteSize: 4,
      offset: 0
    };
    const { fields: updated } = recalculateFields([...fields, newField]);
    setFields(updated);
  };

  const handleRemoveField = (index: number) => {
    const updated = fields.filter((_, idx) => idx !== index);
    const { fields: res } = recalculateFields(updated);
    setFields(res);
  };

  const handleFieldChange = (index: number, key: keyof FieldSchema, val: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: val };
    const { fields: res } = recalculateFields(updated);
    setFields(res);
  };

  const { totalSize: currentRecordSize } = recalculateFields(fields);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      setError('Debes ingresar un nombre para la tabla');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let schema: TableSchema;
      if (mode === 'cpp' && cppCode.trim()) {
        schema = await parseCppStruct(cppCode, tableName.trim());
      } else {
        const { fields: finalFields, totalSize } = recalculateFields(fields);
        schema = {
          tableName: tableName.trim(),
          recordSize: totalSize || 32,
          fields: finalFields
        };
      }

      await createTable(tableName.trim(), schema);
      onTableCreated(tableName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear la tabla');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Crear Nueva Tabla MicroDB</h3>
              <p className="text-xs text-slate-400">100% Compatible con Arduino, SD y DBeaver (MTB1)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#21262d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#30363d] bg-[#161b22] px-6 select-none">
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-all flex items-center space-x-2 ${
              mode === 'visual'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Diseñador Visual (Recomendado)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('cpp')}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-all flex items-center space-x-2 ${
              mode === 'cpp'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Pegar Struct C++</span>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto flex flex-col justify-between">
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Nombre de la Tabla (FAT 8.3, ej: sensores, log_data)
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="Nombre de la tabla (ej. sensores)"
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-emerald-500 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none"
                required
              />
            </div>

            {mode === 'visual' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Definición de Columnas ({currentRecordSize} Bytes/registro)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Columna</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {fields.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-[#0d1117] border border-[#30363d] rounded-xl space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono text-slate-500 w-4">{idx + 1}</span>
                        <input
                          type="text"
                          value={f.name}
                          onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                          placeholder="Nombre columna"
                          className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none"
                        />
                        <select
                          value={f.type}
                          onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                          className="w-36 bg-[#161b22] border border-[#30363d] rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                        >
                          {AVAILABLE_TYPES.map((t) => (
                            <option key={t.type} value={t.type}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        {['string', 'blob', 'json', 'media_path', 'char'].includes(f.type) && (
                          <input
                            type="number"
                            value={f.arrayLength || f.byteSize || 16}
                            onChange={(e) => handleFieldChange(idx, 'arrayLength', parseInt(e.target.value, 10) || 1)}
                            placeholder="Len"
                            className="w-16 bg-[#161b22] border border-[#30363d] rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none"
                            title="Longitud en bytes (ej. char name[16])"
                          />
                        )}
                        <span className="text-[10px] font-mono text-emerald-400 w-12 text-right">
                          {f.byteSize}B
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* FK & Unique Controls */}
                      <div className="flex items-center space-x-3 pl-6 pt-1 text-[11px] border-t border-[#21262d]/60">
                        <label className="flex items-center space-x-1 cursor-pointer text-slate-400 hover:text-slate-200">
                          <input
                            type="checkbox"
                            checked={!!f.isUnique}
                            onChange={(e) => handleFieldChange(idx, 'isUnique', e.target.checked)}
                            className="rounded bg-[#161b22] border-[#30363d] text-emerald-500 focus:ring-0"
                          />
                          <span className="flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Único (insertUnique)</span>
                          </span>
                        </label>

                        <label className="flex items-center space-x-1 cursor-pointer text-slate-400 hover:text-slate-200">
                          <input
                            type="checkbox"
                            checked={!!f.isForeignKey}
                            onChange={(e) => {
                              const chk = e.target.checked;
                              handleFieldChange(idx, 'isForeignKey', chk);
                              if (chk && availableTables.length > 0 && !f.referencesTable) {
                                handleFieldChange(idx, 'referencesTable', availableTables[0]);
                              }
                            }}
                            className="rounded bg-[#161b22] border-[#30363d] text-violet-500 focus:ring-0"
                          />
                          <span className="flex items-center space-x-1">
                            <Link className="w-3 h-3 text-violet-400" />
                            <span>Clave Foránea</span>
                          </span>
                        </label>

                        {f.isForeignKey && (
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] text-violet-300 font-mono">&rarr; Tabla:</span>
                            <select
                              value={f.referencesTable || ''}
                              onChange={(e) => handleFieldChange(idx, 'referencesTable', e.target.value)}
                              className="bg-[#161b22] border border-violet-500/40 rounded px-1.5 py-0.5 text-[10px] text-white font-mono focus:outline-none"
                            >
                              <option value="">-- Seleccionar --</option>
                              {availableTables.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Definición C++ Struct
                  </label>
                  <span className="text-[10px] text-emerald-400 font-semibold">Auto-cálculo de bytes y offsets</span>
                </div>
                <textarea
                  value={cppCode}
                  onChange={(e) => setCppCode(e.target.value)}
                  rows={8}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-emerald-500 rounded-xl p-3 text-xs text-emerald-300 font-mono focus:outline-none leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !tableName.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? 'Creando...' : 'Crear Tabla en SD'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
