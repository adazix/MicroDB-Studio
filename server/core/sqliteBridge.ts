// ============================================================================
// MICRODB STUDIO - PUENTE SQLITE Y COMPATIBILIDAD CON DBEAVER
// Motor SQLite WebAssembly (WASM / Zero Native Dependencies)
// 100% Compatible con DBeaver, DataGrip, VS Code y SQLite CLI
// ============================================================================

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { MicroDBEngine } from './binaryEngine.js';
import { TableSchema, SupportedFieldType } from './microdbTypes.js';

let SQL: SqlJsStatic | null = null;

export class SQLiteBridge {
  private static async getSqlInstance(): Promise<SqlJsStatic> {
    if (!SQL) {
      SQL = await initSqlJs();
    }
    return SQL;
  }

  private static mapToSqliteType(fieldType: SupportedFieldType): string {
    switch (fieldType) {
      case 'bool':
      case 'int8':
      case 'uint8':
      case 'int16':
      case 'uint16':
      case 'int32':
      case 'uint32':
      case 'int64':
      case 'uint64':
        return 'INTEGER';
      case 'float':
      case 'double':
        return 'REAL';
      case 'char':
      case 'string':
      case 'json':
      case 'media_path':
        return 'TEXT';
      case 'blob':
        return 'TEXT';
      default:
        return 'TEXT';
    }
  }

  /**
   * Genera o sincroniza una base de datos SQLite binaria a partir de las tablas .tbl
   */
  public static async syncFolderToSqlite(
    dbDir: string,
    tableSchemas: Map<string, TableSchema>,
    outputSqlitePath?: string
  ): Promise<string> {
    const sqlitePath = outputSqlitePath || path.join(dbDir, 'microdb_live.sqlite');
    const SQLInstance = await this.getSqlInstance();

    let db: Database;
    // Si ya existe el archivo, podemos cargarlo en memoria
    if (fs.existsSync(sqlitePath)) {
      try {
        const fileBuffer = fs.readFileSync(sqlitePath);
        db = new SQLInstance.Database(fileBuffer);
      } catch (e) {
        db = new SQLInstance.Database();
      }
    } else {
      db = new SQLInstance.Database();
    }

    // Listar todos los archivos .tbl en el directorio
    const files = fs.readdirSync(dbDir).filter((f) => f.toLowerCase().endsWith('.tbl'));

    for (const file of files) {
      const ext = path.extname(file);
      const tableName = path.basename(file, ext);
      const tablePath = path.join(dbDir, file);

      try {
        const schema = tableSchemas.get(tableName);
        const { header, records } = MicroDBEngine.readAllSlots(tablePath, schema);

        const activeSchema = schema || MicroDBEngine.generateDefaultSchema(header, tableName);

        // Crear DDL de la tabla
        const columnsDdl: string[] = [
          'id INTEGER PRIMARY KEY',
          '_slot_index INTEGER',
          '_status INTEGER'
        ];

        for (const field of activeSchema.fields) {
          const sqlType = this.mapToSqliteType(field.type);
          columnsDdl.push(`"${field.name}" ${sqlType}`);
        }

        db.run(`DROP TABLE IF EXISTS "${tableName}";`);
        db.run(`CREATE TABLE "${tableName}" (${columnsDdl.join(', ')});`);

        // Insertar registros activos
        const fieldNames = activeSchema.fields.map((f) => `"${f.name}"`);
        const placeholders = activeSchema.fields.map(() => '?').join(', ');
        const insertSql = `INSERT INTO "${tableName}" (id, _slot_index, _status, ${fieldNames.join(', ')}) VALUES (?, ?, ?, ${placeholders})`;

        for (const row of records) {
          if (row._status === 1) { // Solo registros activos
            const values = activeSchema.fields.map((f) => {
              const val = row[f.name];
              if (f.type === 'bool') return val ? 1 : 0;
              return val !== undefined && val !== null ? val : null;
            });
            db.run(insertSql, [row._recordId, row._slotIndex, row._status, ...values]);
          }
        }
      } catch (err) {
        console.error(`Error sincronizando tabla ${tableName} a SQLite:`, err);
      }
    }

    // Exportar el archivo SQLite binario a disco
    const binaryArray = db.export();
    fs.writeFileSync(sqlitePath, Buffer.from(binaryArray));
    db.close();

    return sqlitePath;
  }

  /**
   * Ejecuta una consulta SQL arbitraria sobre el archivo SQLite y retorna filas y columnas
   */
  public static async executeQuery(
    sqlitePath: string,
    sqlQuery: string
  ): Promise<{ columns: string[]; rows: any[]; executionTimeMs: number }> {
    const startTime = performance.now();
    const SQLInstance = await this.getSqlInstance();

    if (!fs.existsSync(sqlitePath)) {
      throw new Error(`Base de datos SQLite no encontrada en: ${sqlitePath}`);
    }

    const fileBuffer = fs.readFileSync(sqlitePath);
    const db = new SQLInstance.Database(fileBuffer);

    try {
      const results = db.exec(sqlQuery);
      const executionTimeMs = Number.parseFloat((performance.now() - startTime).toFixed(2));

      if (results.length === 0) {
        db.close();
        return { columns: [], rows: [], executionTimeMs };
      }

      const firstResult = results[0];
      const columns = firstResult.columns;
      const rows = firstResult.values.map((valRow) => {
        const rowObj: Record<string, any> = {};
        columns.forEach((col, idx) => {
          rowObj[col] = valRow[idx];
        });
        return rowObj;
      });

      db.close();
      return { columns, rows, executionTimeMs };
    } catch (err: any) {
      db.close();
      throw new Error(`Error en consulta SQL: ${err.message}`);
    }
  }
}
