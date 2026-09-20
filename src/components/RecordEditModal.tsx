import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Link,
  ShieldCheck,
  Search
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
          initial[f.name] = recordToEdit[f.name];
        });
        setFormData(initial);
      } else {
        // Initial defaults
        const defaults: Record<string, any> = {};
        schema.fields.forEach((f) => {
          if (f.type === 'bool') defaults[f.name] = false;
          else if (['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float', 'double'].includes(f.type))
            defaults[f.name] = 0;
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isEditing && recordToEdit) {
        await updateRecord(tableName, recordToEdit._slotIndex, formData);
      } else {
        await insertRecord(tableName, formData);
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Error de Validación:</strong>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {schema.fields.map((field) => (
                <div key={field.name} className="space-y-1.5 p-3 rounded-xl bg-[#0d1117]/60 border border-[#30363d]/60">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center space-x-2">
                      <label className="text-xs font-bold text-slate-200 font-mono">{field.name}</label>
                      {field.isUnique && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Único</span>
                        </span>
                      )}
                      {field.isForeignKey && field.referencesTable && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 font-bold border border-violet-500/30 flex items-center space-x-1 font-mono">
                          <Link className="w-3 h-3" />
                          <span>FK &rarr; {field.referencesTable}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Tipo: {field.type} ({field.byteSize}B)
                    </span>
                  </div>

                  {/* Selector especial si es Foreign Key */}
                  {field.isForeignKey && field.referencesTable ? (
                    <div className="space-y-1.5">
                      <select
                        value={formData[field.name] !== undefined ? formData[field.name] : ''}
                        onChange={(e) => {
                          const val = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32'].includes(field.type)
                            ? Number(e.target.value) || 0
                            : e.target.value;
                          handleChange(field.name, val);
                        }}
                        className="w-full bg-[#161b22] border border-violet-500/40 focus:border-violet-400 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                      >
                        <option value="">-- Seleccionar registro de '{field.referencesTable}' --</option>
                        {foreignOptions[field.name]?.map((parentRec) => {
                          // Intentar obtener un texto representativo del registro padre
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
                      <p className="text-[10px] text-violet-300/80 font-mono">
                        Validado automáticamente contra la tabla padre '{field.referencesTable}'
                      </p>
                    </div>
                  ) : field.type === 'bool' ? (
                    <div className="flex items-center space-x-3 pt-1">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData[field.name]}
                          onChange={(e) => handleChange(field.name, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-[#161b22] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 border border-[#30363d]"></div>
                        <span className="ml-3 text-xs font-mono font-bold text-slate-300">
                          {formData[field.name] ? 'TRUE (1)' : 'FALSE (0)'}
                        </span>
                      </label>
                    </div>
                  ) : ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float', 'double'].includes(
                      field.type
                    ) ? (
                    <input
                      type="number"
                      step={['float', 'double'].includes(field.type) ? 'any' : '1'}
                      value={formData[field.name] !== undefined ? formData[field.name] : 0}
                      onChange={(e) => handleChange(field.name, parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#161b22] border border-[#30363d] focus:border-sky-500 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.type === 'blob' ? 'Ej: 048A5C127E3390 (Hex)' : 'Texto'}
                      className="w-full bg-[#161b22] border border-[#30363d] focus:border-sky-500 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  )}
                </div>
              ))}
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
              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center space-x-2"
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
