// ============================================================================
// MICRODB STUDIO - MODAL DE EDICIÓN E INSERCIÓN DE REGISTROS
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Plus,
  Edit2,
  AlertCircle,
  Link,
  ShieldCheck,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { TableSchema, DecodedRecord } from '../types/microdb.js';
import { insertRecord, updateRecord, fetchTableDetail } from '../utils/api.js';

interface RecordEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  schema: TableSchema;
  recordToEdit: DecodedRecord | null;
  onRecordSaved: () => void;
}

export const RecordEditModal: React.FC<RecordEditModalProps> = ({
  isOpen,
  onClose,
  tableName,
  schema,
  recordToEdit,
  onRecordSaved
}) => {
  const isEditing = recordToEdit !== null;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [foreignOptions, setForeignOptions] = useState<Record<string, DecodedRecord[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (recordToEdit) {
        const initial: Record<string, any> = {};
        schema.fields.forEach((f) => {
          initial[f.name] = recordToEdit[f.name] !== undefined && recordToEdit[f.name] !== null
            ? String(recordToEdit[f.name])
            : '';
          if (f.type === 'bool') {
            initial[f.name] = Boolean(recordToEdit[f.name]);
          }
        });
        setFormData(initial);
      } else {
        // Initial defaults sin forzar ceros que bloqueen el borrado
        const defaults: Record<string, any> = {};
        schema.fields.forEach((f) => {
          if (f.type === 'bool') defaults[f.name] = false;
          else defaults[f.name] = '';
        });
        setFormData(defaults);
      }
      setError(null);

      // Cargar registros de tablas foráneas para los campos FK
      schema.fields.forEach((f) => {
        if (f.isForeignKey && f.referencesTable) {
          fetchTableDetail(f.referencesTable)
            .then((data) => {
              const activeOnly = data.records.filter((r) => r._status === 1);
              setForeignOptions((prev) => ({
                ...prev,
                [f.name]: activeOnly
              }));
            })
            .catch((e) => {
              console.warn(`No se pudo precargar registros para FK ${f.name}:`, e);
            });
        }
      });
    }
  }, [isOpen, recordToEdit, schema]);

  if (!isOpen) return null;

  const handleChange = (fieldName: string, val: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: val }));
  };

  const handleStepNumber = (fieldName: string, step: number, isFloat: boolean) => {
    const raw = formData[fieldName];
    const current = raw === '' || raw === undefined || raw === null ? 0 : parseFloat(raw);
    const next = isFloat ? Math.round((current + step) * 100) / 100 : Math.round(current + step);
    handleChange(fieldName, String(next));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Formatear tipos exactos antes de enviar al backend
    const payload: Record<string, any> = {};
    for (const f of schema.fields) {
      const raw = formData[f.name];
      if (f.type === 'bool') {
        payload[f.name] = Boolean(raw);
      } else if (['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float', 'double'].includes(f.type)) {
        if (raw === '' || raw === undefined || raw === null) {
          payload[f.name] = 0;
        } else if (['float', 'double'].includes(f.type)) {
          const parsed = parseFloat(raw);
          payload[f.name] = isNaN(parsed) ? 0 : parsed;
        } else {
          const parsed = parseInt(raw, 10);
          payload[f.name] = isNaN(parsed) ? 0 : parsed;
        }
      } else {
        payload[f.name] = raw !== undefined && raw !== null ? String(raw) : '';
      }
    }

    try {
      if (isEditing && recordToEdit) {
        await updateRecord(tableName, recordToEdit._slotIndex, payload);
      } else {
        await insertRecord(tableName, payload);
      }
      onRecordSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error guardando registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {isEditing ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isEditing ? `Editar Registro #${recordToEdit?._recordId}` : 'Insertar Nuevo Registro'}
              </h3>
              <p className="text-xs text-slate-400">
                Tabla: <strong className="text-sky-300 font-mono">{tableName}</strong>
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Error de Validación:</strong>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-3.5">
              {schema.fields.map((field) => {
                const isNumeric = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float', 'double'].includes(field.type);
                const isFloat = ['float', 'double'].includes(field.type);
                const isFk = field.isForeignKey && field.referencesTable;

                return (
                  <div key={field.name} className="space-y-1.5 p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d]">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-slate-200 font-mono">{field.name}</label>
                        {field.isUnique && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Único</span>
                          </span>
                        )}
                        {isFk && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 flex items-center space-x-1 font-mono">
                            <Link className="w-3 h-3" />
                            <span>FK &rarr; {field.referencesTable}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Tipo: {field.type} ({field.byteSize}B)
                      </span>
                    </div>

                    {/* Campo selector de Clave Foránea */}
                    {isFk ? (
                      <div className="space-y-1.5">
                        <select
                          value={formData[field.name] !== undefined ? formData[field.name] : ''}
                          onChange={(e) => handleChange(field.name, e.target.value)}
                          className="w-full bg-[#161b22] border border-[#30363d] focus:border-sky-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                        >
                          <option value="">-- Seleccionar registro de '{field.referencesTable}' --</option>
                          {foreignOptions[field.name]?.map((parentRec) => {
                            const textCol = Object.entries(parentRec).find(
                              ([k, v]) => !k.startsWith('_') && typeof v === 'string' && v.trim().length > 0
                            );
                            const desc = textCol ? ` (${textCol[1]})` : '';
                            return (
                              <option key={parentRec._slotIndex} value={parentRec._recordId}>
                                ID #{parentRec._recordId} {desc}
                              </option>
                            );
                          })}
                        </select>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Validado automáticamente contra la tabla padre '{field.referencesTable}'
                        </p>
                      </div>
                    ) : field.type === 'bool' ? (
                      /* Interruptor Booleano */
                      <div className="flex items-center space-x-3 pt-1">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!formData[field.name]}
                            onChange={(e) => handleChange(field.name, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-[#161b22] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 border border-[#30363d]"></div>
                          <span className="ml-3 text-xs font-mono font-bold text-slate-300">
                            {formData[field.name] ? 'TRUE (1)' : 'FALSE (0)'}
                          </span>
                        </label>
                      </div>
                    ) : isNumeric ? (
                      /* Input Numérico con Botones Stepper Estilizados al Tema */
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode={isFloat ? 'decimal' : 'numeric'}
                          value={formData[field.name] !== undefined ? formData[field.name] : ''}
                          onChange={(e) => {
                            // Permitir números, punto decimal y signo negativo libremente sin forzar ceros
                            const val = e.target.value;
                            if (val === '' || val === '-' || (isFloat ? /^-?\d*\.?\d*$/ : /^-?\d*$/).test(val)) {
                              handleChange(field.name, val);
                            }
                          }}
                          placeholder="0"
                          className="w-full bg-[#161b22] border border-[#30363d] focus:border-sky-500 rounded-xl pl-3.5 pr-14 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                        />
                        {/* Stepper buttons elegantes acordes a la UI */}
                        <div className="absolute right-1.5 flex items-center space-x-0.5 bg-[#0d1117] border border-[#30363d] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleStepNumber(field.name, isFloat ? -1 : -1, isFloat)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-[#21262d] rounded transition-colors"
                            title="Decrementar"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepNumber(field.name, isFloat ? 1 : 1, isFloat)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-[#21262d] rounded transition-colors"
                            title="Incrementar"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Input de Texto / Blob / JSON */
                      <input
                        type="text"
                        value={formData[field.name] !== undefined ? formData[field.name] : ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.type === 'blob' ? 'Ej: 048A5C127E3390 (Hex)' : 'Texto'}
                        className="w-full bg-[#161b22] border border-[#30363d] focus:border-sky-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                      />
                    )}
                  </div>
                );
              })}
            </div>
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
              disabled={loading}
              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center space-x-2 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Guardando en disco...' : isEditing ? 'Guardar Cambios' : 'Insertar en Disco'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
