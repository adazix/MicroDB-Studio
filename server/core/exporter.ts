// ============================================================================
// MICRODB STUDIO - EXPORTADOR E IMPORTADOR MULTIFORMATO
// Exportación a CSV, Excel (XLSX), JSON, SQL DDL Dump y SQLite
// ============================================================================

import * as XLSX from 'xlsx';
import { TableSchema, DecodedRecord } from './microdbTypes.js';

export class Exporter {
  /**
   * Exporta a CSV
   */
  public static toCSV(records: DecodedRecord[], schema?: TableSchema): string {
    if (records.length === 0) return '';

    const keys = schema 
      ? ['id', ...schema.fields.map(f => f.name)]
      : Object.keys(records[0]).filter(k => !k.startsWith('_'));

    const headerLine = keys.map(k => `"${k}"`).join(',');
    const lines = [headerLine];

    for (const rec of records) {
      if (rec._status === 0) continue; // Omitir borrados
      const row = keys.map(k => {
        const val = k === 'id' ? rec._recordId : rec[k];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Exporta a JSON
   */
  public static toJSON(records: DecodedRecord[], schema?: TableSchema): string {
    const cleanRecords = records
      .filter(r => r._status === 1)
      .map(r => {
        const obj: Record<string, any> = { id: r._recordId };
        if (schema) {
          for (const f of schema.fields) {
            obj[f.name] = r[f.name];
          }
        } else {
          for (const k of Object.keys(r)) {
            if (!k.startsWith('_')) {
              obj[k] = r[k];
            }
          }
        }
        return obj;
      });

    return JSON.stringify(cleanRecords, null, 2);
  }

  /**
   * Exporta a Excel Buffer (.xlsx)
   */
  public static toExcelBuffer(records: DecodedRecord[], tableName: string, schema?: TableSchema): Buffer {
    const cleanRecords = records
      .filter(r => r._status === 1)
      .map(r => {
        const obj: Record<string, any> = { ID: r._recordId };
        if (schema) {
          for (const f of schema.fields) {
            obj[f.name] = r[f.name];
          }
        } else {
          for (const k of Object.keys(r)) {
            if (!k.startsWith('_')) {
              obj[k] = r[k];
            }
          }
        }
        return obj;
      });

    const worksheet = XLSX.utils.json_to_sheet(cleanRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tableName || 'Data');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Exporta a SQL Dump script (DDL + INSERTs)
   */
  public static toSQLDump(records: DecodedRecord[], tableName: string, schema?: TableSchema): string {
    const lines: string[] = [
      `-- ========================================================`,
      `-- MicroDB Studio - SQL Export for Table: ${tableName}`,
      `-- Generated at: ${new Date().toISOString()}`,
      `-- ========================================================`,
      ``,
      `DROP TABLE IF EXISTS "${tableName}";`
    ];

    if (schema) {
      const colDefs = ['"id" INTEGER PRIMARY KEY'];
      for (const f of schema.fields) {
        let colType = 'TEXT';
        if (['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'bool'].includes(f.type)) {
          colType = 'INTEGER';
        } else if (['float', 'double'].includes(f.type)) {
          colType = 'REAL';
        }
        colDefs.push(`"${f.name}" ${colType}`);
      }
      lines.push(`CREATE TABLE "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`);
      lines.push(``);

      const fieldNames = schema.fields.map(f => `"${f.name}"`);
      for (const rec of records) {
        if (rec._status === 0) continue;
        const valList = schema.fields.map(f => {
          const v = rec[f.name];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 1 : 0;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        lines.push(
          `INSERT INTO "${tableName}" ("id", ${fieldNames.join(', ')}) VALUES (${rec._recordId}, ${valList.join(', ')});`
        );
      }
    }

    return lines.join('\n');
  }
}
