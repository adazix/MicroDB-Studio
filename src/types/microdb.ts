// ============================================================================
// MICRODB STUDIO - FRONTEND TYPES
// ============================================================================

export interface DatabaseInfo {
  name: string;
  path: string;
  tableCount: number;
}

export interface DetectedDatabase {
  name: string;
  path: string;
  tableCount: number;
  tables: string[];
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
  arrayLength?: number;
  byteSize: number;
  offset: number;
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
  cStructDef?: string;
}

export interface TableHeaderData {
  magic: number;
  version: number;
  recordSize: number;
  totalSlots: number;
  activeRecords: number;
  deletedRecords: number;
  firstFreeSlot: number;
  nextAutoId: number;
  dataStartOffset: number;
  reserved?: any;
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

export interface DecodedRecord {
  _slotIndex: number;
  _status: number; // 0 = deleted, 1 = active
  _recordId: number;
  _nextFreeSlot: number;
  _rawHex: string;
  _isNew?: boolean;
  [key: string]: any;
}

export interface DetectedDrive {
  letter: string;
  name: string;
  type: 'removable' | 'fixed' | 'network' | 'unknown';
  isSdCard: boolean;
  hasDbFolder: boolean;
  dbPath?: string;
  databases: DetectedDatabase[];
  totalSpaceGb?: number;
  freeSpaceGb?: number;
}

export interface SqlQueryResult {
  columns: string[];
  rows: any[];
  executionTimeMs: number;
}
