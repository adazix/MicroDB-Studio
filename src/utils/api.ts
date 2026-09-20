// ============================================================================
// MICRODB STUDIO - CLIENTE API
// ============================================================================

import {
  DetectedDrive,
  TableSummary,
  TableSchema,
  DecodedRecord,
  TableHeaderData,
  SqlQueryResult
} from '../types/microdb.js';

const API_BASE = '/api';

export async function fetchDrives(): Promise<{ drives: DetectedDrive[]; currentDbDirectory: string | null }> {
  const res = await fetch(`${API_BASE}/drives`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function fetchDatabases(): Promise<{
  databases: DatabaseInfo[];
  activeDatabase: string;
  rootDirectory: string | null;
  currentDbDirectory: string | null;
}> {
  const res = await fetch(`${API_BASE}/databases`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function selectDatabase(databaseName: string): Promise<{
  currentDbDirectory: string;
  sqlitePath: string;
  activeDatabase: string;
}> {
  const res = await fetch(`${API_BASE}/select-database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ databaseName })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function createDatabase(databaseName: string): Promise<{
  database: DatabaseInfo;
  currentDbDirectory: string;
  sqlitePath: string;
}> {
  const res = await fetch(`${API_BASE}/database/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ databaseName })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function deleteDatabase(databaseName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/database/${databaseName}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function openDirectory(dirPath: string): Promise<{ currentDbDirectory: string; sqlitePath: string; activeDatabase: string }> {
  const res = await fetch(`${API_BASE}/open-directory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dirPath })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function fetchTables(): Promise<{ tables: TableSummary[]; currentDbDirectory: string | null }> {
  const res = await fetch(`${API_BASE}/tables`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function fetchTableDetail(tableName: string): Promise<{
  tableName: string;
  header: TableHeaderData;
  schema: TableSchema;
  records: DecodedRecord[];
  totalCount: number;
  activeCount: number;
  deletedCount: number;
}> {
  const res = await fetch(`${API_BASE}/table/${tableName}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function insertRecord(tableName: string, recordData: Record<string, any>): Promise<number> {
  const res = await fetch(`${API_BASE}/table/${tableName}/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recordData)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.assignedId;
}

export async function updateRecord(tableName: string, slotIndex: number, recordData: Record<string, any>): Promise<void> {
  const res = await fetch(`${API_BASE}/table/${tableName}/record/${slotIndex}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recordData)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function deleteRecord(tableName: string, slotIndex: number): Promise<void> {
  const res = await fetch(`${API_BASE}/table/${tableName}/record/${slotIndex}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function dropTable(tableName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/table/${tableName}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function vacuumTable(tableName: string): Promise<{ reclaimedBytes: number; initialSlots: number; finalSlots: number }> {
  const res = await fetch(`${API_BASE}/table/${tableName}/vacuum`, {
    method: 'POST'
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.result;
}

export async function createTable(tableName: string, schema: TableSchema): Promise<void> {
  const res = await fetch(`${API_BASE}/table/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableName, schema })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function parseCppStruct(code: string, tableName?: string): Promise<TableSchema> {
  const res = await fetch(`${API_BASE}/schema/parse-cpp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, tableName })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.schema;
}

export async function autoDetectSchema(tableName: string): Promise<TableSchema> {
  const res = await fetch(`${API_BASE}/schema/auto-detect/${tableName}`, {
    method: 'POST'
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.schema;
}

export async function saveSchema(schema: TableSchema): Promise<void> {
  const res = await fetch(`${API_BASE}/schema/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schema })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function executeSqlQuery(sql: string): Promise<SqlQueryResult> {
  const res = await fetch(`${API_BASE}/sql/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function exportData(options: {
  format: 'csv' | 'xlsx' | 'json' | 'sql';
  tableName?: string;
  customRecords?: any[];
}): Promise<Blob> {
  const res = await fetch(`${API_BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Error al exportar');
  }
  return await res.blob();
}
