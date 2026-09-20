// ============================================================================
// MICRODB STUDIO - DEFINICIÓN DE TIPOS Y CONSTANTES BINARIAS DE MICRODB
// ============================================================================

export const MICRODB_MAGIC_DB = 0x4D444231;      // "MDB1"
export const MICRODB_MAGIC_TABLE = 0x4D544231;   // "MTB1"
export const MICRODB_MAGIC_INDEX = 0x4D494431;   // "MID1"
export const MICRODB_NULL_OFFSET = 0xFFFFFFFF;

export const TABLE_HEADER_SIZE = 64;             // 64 bytes exactos
export const SLOT_HEADER_SIZE = 9;               // 1 + 4 + 4 = 9 bytes
export const INDEX_HEADER_SIZE = 32;             // 32 bytes
export const INDEX_ENTRY_SIZE = 12;              // 4 + 4 + 4 = 12 bytes

export enum RecordStatus {
  RECORD_DELETED = 0x00,
  RECORD_ACTIVE = 0x01
}

export interface TableHeaderData {
  magic: number;             // 0x4D544231
  version: number;           // 1
  recordSize: number;        // Tamaño en bytes del struct C++
  totalSlots: number;        // Total slots en disco
  activeRecords: number;     // Registros activos
  deletedRecords: number;    // Registros borrados (Tombstones)
  firstFreeSlot: number;     // Cabeza del stack de Free-List
  nextAutoId: number;        // Próximo ID a asignar
  dataStartOffset: number;   // Offset en bytes (64)
  reserved: Buffer;          // 32 bytes
}

export interface SlotHeaderData {
  status: RecordStatus;      // 0 = Borrado, 1 = Activo
  recordId: number;          // ID numérico
  nextFreeSlot: number;      // Puntero enlazado a siguiente slot libre
}

export interface IndexHeaderData {
  magic: number;             // 0x4D494431
  version: number;
  entrySize: number;         // 12
  totalEntries: number;
  isSorted: number;
  reserved: Buffer;
}

export interface IndexEntryData {
  keyHash: number;           // Hash FNV-1a o clave entera
  recordId: number;
  slotIndex: number;
}

export type SupportedFieldType =
  | 'bool'
  | 'int8'
  | 'uint8'
  | 'int16'
  | 'uint16'
  | 'int32'
  | 'uint32'
  | 'int64'
  | 'uint64'
  | 'float'
  | 'double'
  | 'char'
  | 'string'
  | 'blob'
  | 'json'
  | 'media_path';

export interface FieldSchema {
  name: string;
  type: SupportedFieldType;
  arrayLength?: number;      // Para char[N], uint8_t[N], etc.
  byteSize: number;          // Tamaño calculado en bytes
  offset: number;            // Offset en bytes dentro del struct
  description?: string;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string;
  referencesField?: string;
}

export interface TableSchema {
  tableName: string;
  recordSize: number;
  fields: FieldSchema[];
  cStructDef?: string;       // Código C++ original si fue importado
}

export interface DecodedRecord {
  _slotIndex: number;
  _status: RecordStatus;
  _recordId: number;
  _nextFreeSlot: number;
  _rawHex: string;
  [key: string]: any;
}

export interface TableSummary {
  name: string;
  filePath: string;
  fileSizeBytes: number;
  header: TableHeaderData;
  schema?: TableSchema;
  hasIndex: boolean;
  indexPath?: string;
  fragmentationPercent: number;
  lastModified: string;
}
