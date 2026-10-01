// ============================================================================
// MICRODB STUDIO - MODAL DE GESTIÓN Y EDICIÓN DE ESTRUCTURA Y COLUMNAS
// Permite añadir, modificar tipos, renombrar, reordenar y eliminar columnas
// con migración transparente en caliente del archivo binario .tbl en disco.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Code2,
  AlertCircle,
  Layers,
  Plus,
  Trash2,
  Link,
  ShieldCheck,
  Key,
  Info,
  CheckCircle2,
  Save,
  Cpu
} from 'lucide-react';
import { saveSchema, parseCppStruct } from '../utils/api.js';
import { TableSchema, FieldSchema, SupportedFieldType } from '../types/microdb.js';
import { CustomSelect } from './ui/CustomSelect.js';
import { CustomCheckbox } from './ui/CustomCheckbox.js';

interface EditTableSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  schema: TableSchema;
  recordsCount?: number;
  availableTables: string[];
  onSchemaSaved: (newSchema: TableSchema) => void;
}

export interface McuProfile {
  id: string;
  name: string;
  sram: string;
  maxRecordSize: number;
  warnRecordSize: number;
}

export const MCU_PROFILES: McuProfile[] = [
  { id: 'uno', name: 'Arduino Uno / Nano (AVR)', sram: '2 KB SRAM', maxRecordSize: 512, warnRecordSize: 256 },
  { id: 'mega', name: 'Arduino Mega 2560 (AVR)', sram: '8 KB SRAM', maxRecordSize: 1024, warnRecordSize: 512 },
  { id: 'esp32', name: 'ESP32 / RP2040 / 32-bit', sram: '320 KB+ SRAM', maxRecordSize: 4096, warnRecordSize: 2048 }
];

const RESERVED_FIELD_NAMES = ['id', '_id', '_recordid', '_slotindex', '_status', '_nextfreeslot'];
const isReservedFieldName = (name: string): boolean => {
  return RESERVED_FIELD_NAMES.includes(name.trim().toLowerCase());
};

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

export const EditTableSchemaModal: React.FC<EditTableSchemaModalProps> = ({
  isOpen,
  onClose,
  tableName,
  schema,
  recordsCount = 0,
  availableTables,
  onSchemaSaved
}) => {
  const [mode, setMode] = useState<'visual' | 'cpp'>('visual');
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [cppCode, setCppCode] = useState('');
  const [selectedMcuId, setSelectedMcuId] = useState<string>('uno');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalcular layout visual y offsets
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

  // Convertir fields actuales a código C++
  const generateCppCode = (fList: FieldSchema[], name: string): string => {
    const lines = fList.map((f) => {
      if (['string', 'char', 'json', 'media_path'].includes(f.type)) {
        return `  char     ${f.name}[${f.arrayLength || f.byteSize || 16}];`;
      }
      if (f.type === 'blob') {
        return `  uint8_t  ${f.name}[${f.arrayLength || f.byteSize || 16}];`;
      }
      const typeMap: Record<string, string> = {
        bool: 'bool    ',
        int8: 'int8_t  ',
        uint8: 'uint8_t ',
        int16: 'int16_t ',
        uint16: 'uint16_t',
        int32: 'int32_t ',
        uint32: 'uint32_t',
        int64: 'int64_t ',
        uint64: 'uint64_t',
        float: 'float   ',
        double: 'double  '
      };
      return `  ${typeMap[f.type] || 'uint32_t'} ${f.name};`;
    });

    return `#pragma pack(push, 1)\nstruct ${name} {\n${lines.join('\n')}\n};\n#pragma pack(pop)`;
  };

  useEffect(() => {
    if (isOpen && schema) {
      setError(null);
      const currentFields = (schema.fields || []).map((f) => ({ ...f }));
      const { fields: initialFields } = recalculateFields(currentFields);
      setFields(initialFields);
      setCppCode(generateCppCode(initialFields, tableName));
    }
  }, [isOpen, schema, tableName]);

  if (!isOpen) return null;

  const handleAddField = () => {
    let nextIdx = fields.length + 1;
    let candidateName = `col_${nextIdx}`;
    while (
      fields.some((f) => f.name.toLowerCase() === candidateName.toLowerCase()) ||
      isReservedFieldName(candidateName)
    ) {
      nextIdx++;
      candidateName = `col_${nextIdx}`;
    }

    const newField: FieldSchema = {
      name: candidateName,
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

  const currentMcu = MCU_PROFILES.find((p) => p.id === selectedMcuId) || MCU_PROFILES[0];
  const { totalSize: currentRecordSize } = recalculateFields(fields);
  const isOverLimit = currentRecordSize > currentMcu.maxRecordSize;
  const isWarning = currentRecordSize > currentMcu.warnRecordSize && !isOverLimit;
  const memoryPercent = Math.min(100, Math.round((currentRecordSize / currentMcu.maxRecordSize) * 100));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isOverLimit) {
      setError(
        `El tamaño total del registro (${currentRecordSize} Bytes) excede el límite de memoria para ${currentMcu.name} (${currentMcu.maxRecordSize} Bytes). En Arduino provocará desbordamiento de pila (Stack Overflow). Reduce la longitud de las columnas.`
      );
      return;
    }

    setLoading(true);

    try {
      let finalFields: FieldSchema[];
      let finalRecordSize: number;

      if (mode === 'cpp' && cppCode.trim()) {
        const parsed = await parseCppStruct(cppCode, tableName);
        if (parsed.recordSize > currentMcu.maxRecordSize) {
          setError(
            `El struct C++ tiene un tamaño de ${parsed.recordSize} Bytes, superando el límite de ${currentMcu.maxRecordSize} Bytes para ${currentMcu.name}.`
          );
          setLoading(false);
          return;
        }
        finalFields = parsed.fields;
        finalRecordSize = parsed.recordSize;
      } else {
        // Validar columnas
        for (const f of fields) {
          const clean = (f.name || '').trim();
          if (!clean) {
            setError('Todas las columnas deben tener un nombre asignado.');
            setLoading(false);
            return;
          }
          if (isReservedFieldName(clean)) {
            setError(
              `El nombre de columna '${clean}' está reservado por MicroDB. El motor binario ya gestiona automáticamente la Clave Primaria 'ID' autoincremental en la cabecera.`
            );
            setLoading(false);
            return;
          }
        }

        const names = fields.map((f) => f.name.trim().toLowerCase());
        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) {
          setError('Existen columnas con nombres duplicados. Cada columna debe tener un nombre único.');
          setLoading(false);
          return;
        }

        const { fields: recFields, totalSize } = recalculateFields(fields);
        finalFields = recFields;
        finalRecordSize = totalSize || 32;
      }

      const updatedSchema: TableSchema = {
        tableName,
        recordSize: finalRecordSize,
        fields: finalFields
      };

      await saveSchema(updatedSchema);
      onSchemaSaved(updatedSchema);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la estructura de la tabla');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white">Estructura y Columnas</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                  {tableName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {fields.length} {fields.length === 1 ? 'columna definida' : 'columnas definidas'} •{' '}
                <strong className="text-sky-300 font-mono">{currentRecordSize} Bytes</strong> por registro
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

        {/* Tab Switcher */}
        <div className="flex border-b border-[#30363d] bg-[#161b22] px-6 select-none">
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-all flex items-center space-x-2 ${
              mode === 'visual'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Diseñador Visual de Columnas</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCppCode(generateCppCode(fields, tableName));
              setMode('cpp');
            }}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-all flex items-center space-x-2 ${
              mode === 'cpp'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Ver / Pegar Struct C++</span>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col justify-between">
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Aviso si la tabla tiene registros existentes */}
            {recordsCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Migración Binaria Automática:</strong> Esta tabla contiene{' '}
                  <strong className="text-white font-mono">{recordsCount}</strong> registro(s) en disco. Al
                  guardar, se preservarán sus datos y valores de clave primaria original migrando cada slot
                  al nuevo tamaño de {currentRecordSize} Bytes.
                </div>
              </div>
            )}

            {mode === 'visual' ? (
              <div className="space-y-3">
                {/* Indicador Informativo Fijo: Clave Primaria ID Automática de MicroDB */}
                <div className="p-3 bg-gradient-to-r from-sky-950/40 via-[#161b22] to-sky-950/20 border border-sky-500/40 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-sky-300">ID</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                          uint32_t (4B)
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          PK
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          AUTO
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Clave Primaria autoincremental provista por la cabecera de MicroDB (no ocupa espacio en el payload).
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end text-right shrink-0 pl-2">
                    <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 font-semibold">
                      Slot Header (9B)
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Automático en disco</span>
                  </div>
                </div>

                {/* Monitor de Memoria RAM de Arduino */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    isOverLimit
                      ? 'bg-rose-950/20 border-rose-500/50 shadow-sm shadow-rose-500/10'
                      : isWarning
                        ? 'bg-amber-950/20 border-amber-500/50 shadow-sm shadow-amber-500/10'
                        : 'bg-[#0d1117] border-[#30363d]'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <Cpu
                        className={`w-4 h-4 ${
                          isOverLimit ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-sky-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-200">
                        Perfil de Hardware Arduino:
                      </span>
                      <CustomSelect
                        value={selectedMcuId}
                        onChange={(val) => setSelectedMcuId(val)}
                        variant={isOverLimit ? 'default' : 'sky'}
                        size="sm"
                        className="w-56"
                        options={MCU_PROFILES.map((m) => ({
                          value: m.id,
                          label: m.name,
                          badge: `${m.maxRecordSize}B`
                        }))}
                      />
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-mono">
                      <span className="text-slate-400">RAM Payload:</span>
                      <span
                        className={`font-bold ${
                          isOverLimit
                            ? 'text-rose-400 text-sm'
                            : isWarning
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                        }`}
                      >
                        {currentRecordSize} / {currentMcu.maxRecordSize} Bytes
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isOverLimit
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : isWarning
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {memoryPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso de RAM */}
                  <div className="w-full h-2 bg-[#161b22] rounded-full overflow-hidden border border-[#30363d]">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isOverLimit
                          ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                          : isWarning
                            ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                            : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                      }`}
                      style={{ width: `${memoryPercent}%` }}
                    />
                  </div>

                  {/* Mensajes de diagnóstico */}
                  {isOverLimit ? (
                    <div className="flex items-center space-x-1.5 text-xs text-rose-400 font-semibold mt-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        ¡Supera el límite de memoria para {currentMcu.name}! Provocará desbordamiento de pila (Stack Overflow). Reduce la longitud de las columnas.
                      </span>
                    </div>
                  ) : isWarning ? (
                    <div className="flex items-center space-x-1.5 text-xs text-amber-300 mt-2">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Aviso de rendimiento: Registro mayor a {currentMcu.warnRecordSize}B. En la SD caben menos de 2 registros por sector de 512B.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        Tamaño óptimo y seguro para {currentMcu.name} ({currentMcu.sram}).
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Columnas de Datos / Payload ({currentRecordSize} Bytes/registro)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Columna</span>
                  </button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-8 px-4 border border-dashed border-[#30363d] rounded-xl text-slate-400">
                    <Sliders className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-50" />
                    <p className="text-xs font-semibold">No hay columnas de datos en esta tabla</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                      Agrega al menos una columna para almacenar registros en disco
                    </p>
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Primera Columna</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {fields.map((f, idx) => {
                      const isReserved = isReservedFieldName(f.name);

                      return (
                        <div
                          key={idx}
                          className={`p-2.5 bg-[#0d1117] border rounded-xl space-y-2 transition-colors ${
                            isReserved ? 'border-rose-500/60 bg-rose-950/10' : 'border-[#30363d]'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-slate-500 w-4 text-center">
                              {idx + 1}
                            </span>

                            <div className="flex-1 flex flex-col">
                              <input
                                type="text"
                                value={f.name}
                                onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                                placeholder="Nombre columna"
                                className={`w-full bg-[#161b22] border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none transition-colors ${
                                  isReserved
                                    ? 'border-rose-500 focus:border-rose-400 text-rose-300'
                                    : 'border-[#30363d] focus:border-sky-500'
                                }`}
                              />
                              {isReserved && (
                                <span className="text-[10px] text-rose-400 font-mono flex items-center space-x-1 mt-1">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>'ID' ya está provisto por el sistema. Usa otro nombre.</span>
                                </span>
                              )}
                            </div>

                            <CustomSelect
                              value={f.type}
                              onChange={(val) => handleFieldChange(idx, 'type', val)}
                              variant="sky"
                              className="w-52 shrink-0"
                              options={AVAILABLE_TYPES.map((t) => ({
                                value: t.type,
                                label: t.label,
                                badge: `${t.bytes}B`
                              }))}
                            />

                            {['string', 'blob', 'json', 'media_path', 'char'].includes(f.type) && (
                              <input
                                type="number"
                                min={1}
                                max={currentMcu.maxRecordSize}
                                value={f.arrayLength || f.byteSize || 16}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 1;
                                  handleFieldChange(
                                    idx,
                                    'arrayLength',
                                    Math.min(val, currentMcu.maxRecordSize)
                                  );
                                }}
                                placeholder="Len"
                                className="w-16 bg-[#161b22] border border-[#30363d] focus:border-sky-500 rounded-xl px-2 py-1.5 text-xs text-white font-mono focus:outline-none text-center transition-colors"
                                title={`Longitud en bytes (ej. char name[16], máx ${currentMcu.maxRecordSize}B)`}
                              />
                            )}

                            <span className="text-[10px] font-mono text-sky-400 w-12 text-right">
                              {f.byteSize}B
                            </span>

                            <button
                              type="button"
                              onClick={() => handleRemoveField(idx)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Eliminar columna"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* FK & Unique Controls */}
                          <div className="flex items-center space-x-4 pl-8 pt-1 text-[11px] border-t border-[#21262d]/60">
                            <CustomCheckbox
                              checked={!!f.isUnique}
                              onChange={(chk) => handleFieldChange(idx, 'isUnique', chk)}
                              variant="emerald"
                              label={
                                <span className="flex items-center space-x-1">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Único (insertUnique)</span>
                                </span>
                              }
                            />

                            <CustomCheckbox
                              checked={!!f.isForeignKey}
                              onChange={(chk) => {
                                handleFieldChange(idx, 'isForeignKey', chk);
                                if (chk && availableTables.length > 0 && !f.referencesTable) {
                                  handleFieldChange(idx, 'referencesTable', availableTables[0]);
                                }
                              }}
                              variant="violet"
                              label={
                                <span className="flex items-center space-x-1">
                                  <Link className="w-3.5 h-3.5 text-violet-400" />
                                  <span>Clave Foránea</span>
                                </span>
                              }
                            />

                            {f.isForeignKey && (
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] text-violet-300 font-mono">&rarr; Tabla:</span>
                                <CustomSelect
                                  value={f.referencesTable || ''}
                                  onChange={(val) => handleFieldChange(idx, 'referencesTable', val)}
                                  variant="violet"
                                  size="sm"
                                  className="w-40"
                                  placeholder="-- Seleccionar --"
                                  options={availableTables.map((t) => ({
                                    value: t,
                                    label: t
                                  }))}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="p-3 bg-sky-950/20 border border-sky-500/30 rounded-xl text-xs text-sky-300 flex items-start space-x-2.5 mb-3">
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-slate-300 leading-relaxed">
                    <strong className="text-sky-300 font-semibold">Nota importante:</strong> MicroDB gestiona
                    automáticamente la Clave Primaria <span className="font-mono text-sky-300 font-bold">ID (uint32)</span> autoincremental en la cabecera binaria del slot.{' '}
                    <strong className="text-white">No incluyas `uint32_t id;` en tu struct C++</strong>.
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Definición C++ Struct
                  </label>
                  <span className="text-[10px] text-sky-400 font-semibold">Auto-cálculo de bytes y offsets</span>
                </div>
                <textarea
                  value={cppCode}
                  onChange={(e) => setCppCode(e.target.value)}
                  rows={8}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-xl p-3 text-xs text-sky-300 font-mono focus:outline-none leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-xs font-mono whitespace-nowrap">
                <span className="text-slate-400 font-medium">RAM Payload:</span>
                <strong
                  className={
                    isOverLimit
                      ? 'text-rose-400 font-bold'
                      : isWarning
                        ? 'text-amber-300 font-bold'
                        : 'text-emerald-400 font-bold'
                  }
                >
                  {currentRecordSize} / {currentMcu.maxRecordSize} B
                </strong>
              </div>
              <span className="text-xs text-slate-500 truncate hidden sm:inline" title={currentMcu.name}>
                ({currentMcu.name})
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || isOverLimit}
                className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{loading ? 'Guardando...' : 'Guardar Estructura'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
