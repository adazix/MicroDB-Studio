// ============================================================================
// MICRODB STUDIO - SERVIDOR BACKEND REST & WEBSOCKETS
// ============================================================================

import express from 'express';
import http from 'node:http';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { MicroDBEngine } from './core/binaryEngine.js';
import { SchemaParser } from './core/schemaParser.js';
import { SQLiteBridge } from './core/sqliteBridge.js';
import { Exporter } from './core/exporter.js';
import { TableDefragmenter } from './core/defrag.js';
import { DiskDetector, isSystemOrIgnoredDir, isDatabaseFolder, countDatabaseTables } from './services/diskDetector.js';
import { showNativeFolderDialog } from './services/dialogHelper.js';
import { SDWatcherService } from './services/sdWatcher.js';
import { TableSchema, TableSummary } from './core/microdbTypes.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Variables de estado del backend
let rootDirectory: string | null = null;
let currentDatabase: string = 'DB';
let currentDbDirectory: string | null = null;
const schemas = new Map<string, TableSchema>();
const sdWatcher = new SDWatcherService(wss);

interface DatabaseItem {
  name: string;
  path: string;
  tableCount: number;
}

// Función auxiliar para escanear todas las bases de datos válidas en rootDirectory
function scanDatabases(rootDir: string): DatabaseItem[] {
  if (!rootDir || !fs.existsSync(rootDir)) return [];
  const results: DatabaseItem[] = [];

  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const isDriveRoot = /^[a-zA-Z]:\\?$/.test(rootDir) || rootDir === '/' || rootDir === '\\';

    // 1. Verificar si la raíz misma contiene archivos .tbl
    const rootTblFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.tbl'));
    if (rootTblFiles.length > 0) {
      results.push({
        name: isDriveRoot ? 'Raíz (/)' : (path.basename(rootDir) || 'Principal (Raíz)'),
        path: rootDir,
        tableCount: rootTblFiles.length
      });
    }

    // 2. Escanear subdirectorios: SÓLO incluir si realmente son bases de datos MicroDB
    for (const entry of entries) {
      if (entry.isDirectory() && !isSystemOrIgnoredDir(entry.name)) {
        const subPath = path.join(rootDir, entry.name);
        if (isDatabaseFolder(subPath)) {
          results.push({
            name: entry.name,
            path: subPath,
            tableCount: countDatabaseTables(subPath)
          });
        }
      }
    }

    // 3. Si se abrió una carpeta específica y no es raíz de unidad, incluirla a ella misma SÓLO si es una carpeta de base de datos válida
    if (results.length === 0 && !isDriveRoot && isDatabaseFolder(rootDir)) {
      results.push({
        name: path.basename(rootDir),
        path: rootDir,
        tableCount: countDatabaseTables(rootDir)
      });
    }
  } catch (e) {
    console.error('Error escaneando bases de datos:', e);
  }

  return results;
}

// Helper para localizar el archivo .tbl de una tabla de forma insensible a mayúsculas/minúsculas
function getTableFileInfo(dirPath: string | null, tableNameParam: string): { tableName: string; tablePath: string } | null {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  try {
    const files = fs.readdirSync(dirPath);
    const cleanParam = tableNameParam.replace(/\.tbl$/i, '').toLowerCase();

    for (const f of files) {
      const ext = path.extname(f);
      if (ext.toLowerCase() === '.tbl') {
        const base = path.basename(f, ext);
        if (base.toLowerCase() === cleanParam) {
          return {
            tableName: base,
            tablePath: path.join(dirPath, f)
          };
        }
      }
    }
  } catch (e) {
    console.error('Error buscando archivo de tabla:', e);
  }
  return null;
}

// Cuando cambia una tabla en disco, resincronizar SQLite automáticamente
sdWatcher.setOnTableChanged(async (_tableName, _eventType) => {
  if (currentDbDirectory) {
    try {
      await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);
    } catch (e) {
      console.warn('Error en autosync de SQLite:', e);
    }
  }
});

// Helper para buscar y resolver el esquema exacto de una tabla (.jsn > .json > .schema.json > .sch > auto-infer)
function findSchemaForTable(dirPath: string | null, tableName: string, header?: any): TableSchema {
  const cleanName = tableName.replace(/\.tbl$/i, '');
  const lower = cleanName.toLowerCase();
  const upper = cleanName.toUpperCase();

  // 1. Verificar mapa en memoria
  if (schemas.has(lower)) return schemas.get(lower)!;
  if (schemas.has(cleanName)) return schemas.get(cleanName)!;
  if (schemas.has(upper)) return schemas.get(upper)!;

  // 2. Búsqueda directa en disco en dirPath
  if (dirPath && fs.existsSync(dirPath)) {
    try {
      const files = fs.readdirSync(dirPath);

      // Prioridad 1: Archivos .jsn y .json de catálogo de Arduino / Studio
      for (const f of files) {
        const fLower = f.toLowerCase();
        const base = f.replace(/\.(jsn|json|schema\.json)$/i, '').toLowerCase();
        if (base === lower) {
          try {
            const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
            const parsed = JSON.parse(content);
            const converted = fLower.endsWith('.schema.json')
              ? parsed
              : SchemaParser.parseArduinoJsonSchema(parsed);

            if (converted) {
              schemas.set(lower, converted);
              schemas.set(upper, converted);
              schemas.set(cleanName, converted);
              return converted;
            }
          } catch (e) {
            console.error(`Error leyendo esquema ${f}:`, e);
          }
        }
      }

      // Prioridad 2: Archivo binario .sch
      for (const f of files) {
        const base = f.replace(/\.sch$/i, '').toLowerCase();
        if (base === lower) {
          try {
            const buf = fs.readFileSync(path.join(dirPath, f));
            const converted = SchemaParser.parseArduinoBinarySchema(buf, cleanName);
            if (converted) {
              schemas.set(lower, converted);
              schemas.set(upper, converted);
              schemas.set(cleanName, converted);
              return converted;
            }
          } catch (e) {
            console.error(`Error leyendo .sch ${f}:`, e);
          }
        }
      }
    } catch (e) {
      console.warn(`Error buscando esquema para ${tableName}:`, e);
    }
  }

  // 3. Fallback: Autogenerar a partir de la cabecera binaria
  if (header) {
    return MicroDBEngine.generateDefaultSchema(header, cleanName);
  }

  return {
    tableName: cleanName,
    recordSize: 0,
    fields: []
  };
}

// Cargar esquemas guardados en disco (.jsn, .json, .schema.json y .sch)
function loadSchemasFromDisk(dirPath: string) {
  schemas.clear();
  try {
    const files = fs.readdirSync(dirPath);

    // PASO 1: Cargar todos los archivos .jsn, .json y .schema.json (MÁXIMA PRIORIDAD)
    for (const f of files) {
      const lower = f.toLowerCase();
      if (lower.endsWith('.schema.json')) {
        const tableName = f.replace(/\.schema\.json$/i, '');
        try {
          const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
          const parsed = JSON.parse(content);
          schemas.set(tableName.toLowerCase(), parsed);
          schemas.set(tableName.toUpperCase(), parsed);
          schemas.set(tableName, parsed);
        } catch (e) { }
      } else if (lower.endsWith('.jsn') || (lower.endsWith('.json') && !lower.endsWith('.schema.json'))) {
        const tableName = f.replace(/\.(json|jsn)$/i, '');
        try {
          const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
          const parsed = JSON.parse(content);
          const converted = SchemaParser.parseArduinoJsonSchema(parsed);
          if (converted) {
            schemas.set(tableName.toLowerCase(), converted);
            schemas.set(tableName.toUpperCase(), converted);
            schemas.set(tableName, converted);
            if (converted.tableName) {
              schemas.set(converted.tableName.toLowerCase(), converted);
              schemas.set(converted.tableName.toUpperCase(), converted);
              schemas.set(converted.tableName, converted);
            }
          }
        } catch (e) { }
      }
    }

    // PASO 2: Cargar archivos .sch sólo si la tabla NO tiene esquema .jsn/.json cargado
    for (const f of files) {
      const lower = f.toLowerCase();
      if (lower.endsWith('.sch')) {
        const tableName = f.replace(/\.sch$/i, '');
        if (!schemas.has(tableName.toLowerCase())) {
          try {
            const buffer = fs.readFileSync(path.join(dirPath, f));
            const converted = SchemaParser.parseArduinoBinarySchema(buffer, tableName);
            if (converted) {
              schemas.set(tableName.toLowerCase(), converted);
              schemas.set(tableName.toUpperCase(), converted);
              schemas.set(tableName, converted);
            }
          } catch (e) { }
        }
      }
    }
  } catch (e) {
    console.error('Error cargando esquemas:', e);
  }
}

// Validar Claves Foráneas (Foreign Keys) antes de insertar o actualizar
function validateForeignKeys(
  dirPath: string,
  _tableName: string,
  recordData: Record<string, any>,
  schema: TableSchema
) {
  for (const field of schema.fields) {
    if (field.isForeignKey && field.referencesTable) {
      const fkVal = recordData[field.name];
      if (fkVal === null || fkVal === undefined || fkVal === '') continue;

      const refTableName = field.referencesTable;
      const refFileInfo = getTableFileInfo(dirPath, refTableName);
      if (!refFileInfo) {
        throw new Error(
          `[Violación de Clave Foránea / FK Error] La tabla referenciada '${refTableName}' no existe en el directorio actual.`
        );
      }

      const refSchema = findSchemaForTable(dirPath, refFileInfo.tableName);
      const { records } = MicroDBEngine.readAllSlots(refFileInfo.tablePath, refSchema);
      const targetField = field.referencesField || '_recordId';

      const found = records.some((r) => {
        if (r._status !== 1) return false;
        if (targetField === '_recordId' || targetField === 'id') {
          return Number(r._recordId) === Number(fkVal) || Number(r.id) === Number(fkVal);
        }
        return String(r[targetField]) === String(fkVal);
      });

      if (!found) {
        throw new Error(
          `[Violación de Clave Foránea] El valor '${fkVal}' en el campo '${field.name}' NO existe como registro activo en la tabla padre '${refTableName}'. Operación rechazada para preservar la integridad referencial (insertWithFK).`
        );
      }
    }
  }
}

// Validar Restricciones de Unicidad (Unique Constraints) antes de insertar o actualizar
function validateUniqueConstraints(
  tablePath: string,
  tableName: string,
  recordData: Record<string, any>,
  schema: TableSchema,
  currentSlotIndex?: number
) {
  for (const field of schema.fields) {
    if (field.isUnique) {
      const val = recordData[field.name];
      if (val === null || val === undefined || val === '') continue;

      const { records } = MicroDBEngine.readAllSlots(tablePath, schema);

      for (const r of records) {
        if (r._status !== 1) continue;
        if (currentSlotIndex !== undefined && r._slotIndex === currentSlotIndex) continue;

        const existingVal = r[field.name];
        if (existingVal === null || existingVal === undefined) continue;

        let isDuplicate = false;
        if (typeof val === 'string' && typeof existingVal === 'string') {
          isDuplicate = val.trim().toLowerCase() === existingVal.trim().toLowerCase();
        } else {
          isDuplicate = String(val) === String(existingVal);
        }

        if (isDuplicate) {
          throw new Error(
            `[Violación de Clave Única] El valor '${val}' en el campo '${field.name}' ya existe en el registro #${r._recordId} (Slot #${r._slotIndex}) de la tabla '${tableName}'. Operación rechazada (insertUnique).`
          );
        }
      }
    }
  }
}

// Guardar esquema en disco (tanto .schema.json como .jsn para Arduino)
function saveSchemaToDisk(dirPath: string, schema: TableSchema) {
  schemas.set(schema.tableName, schema);
  schemas.set(schema.tableName.toLowerCase(), schema);

  // 1. Guardar .schema.json de MicroDB Studio
  const schemaFile = path.join(dirPath, `${schema.tableName}.schema.json`);
  fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2), 'utf8');

  // 2. Guardar .jsn para Arduino MicroDB (FAT 8.3)
  try {
    const arduinoJson = SchemaParser.toArduinoJsonSchema(schema);
    const jsnFile = path.join(dirPath, `${schema.tableName}.jsn`);
    const jsnUpperFile = path.join(dirPath, `${schema.tableName.toUpperCase()}.JSN`);
    const jsnContent = JSON.stringify(arduinoJson, null, 2);
    fs.writeFileSync(jsnFile, jsnContent, 'utf8');
    fs.writeFileSync(jsnUpperFile, jsnContent, 'utf8');
  } catch (e) {
    console.warn('Error guardando .jsn para Arduino:', e);
  }
}

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// 1. Obtener lista de unidades de disco y tarjetas SD
app.get('/api/drives', async (_req, res) => {
  try {
    const drives = await DiskDetector.getAvailableDrives();
    res.json({ success: true, drives, currentDbDirectory, rootDirectory, activeDatabase: currentDatabase });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1.1 Obtener lista de bases de datos detectadas en la SD / directorio
app.get('/api/databases', (_req, res) => {
  try {
    if (!rootDirectory || !fs.existsSync(rootDirectory)) {
      return res.json({
        success: true,
        databases: [],
        activeDatabase: currentDatabase,
        rootDirectory: null,
        currentDbDirectory: null
      });
    }
    const databases = scanDatabases(rootDirectory);
    res.json({
      success: true,
      databases,
      activeDatabase: currentDatabase,
      rootDirectory,
      currentDbDirectory
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1.2 Cambiar de base de datos activa
app.post('/api/select-database', async (req, res) => {
  try {
    const { databaseName } = req.body;
    if (!rootDirectory) {
      return res.status(400).json({ success: false, error: 'No hay unidad SD o directorio abierto' });
    }
    if (!databaseName) {
      return res.status(400).json({ success: false, error: 'Nombre de base de datos requerido' });
    }

    currentDatabase = databaseName;
    currentDbDirectory = databaseName === 'Principal (Raíz)' || databaseName === 'Raíz (/)' || databaseName === '/'
      ? rootDirectory
      : path.join(rootDirectory, databaseName);

    if (!fs.existsSync(currentDbDirectory)) {
      return res.status(404).json({ success: false, error: `La base de datos '${databaseName}' no existe en disco` });
    }

    loadSchemasFromDisk(currentDbDirectory);
    const sqlitePath = await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);

    res.json({
      success: true,
      activeDatabase: currentDatabase,
      currentDbDirectory,
      sqlitePath,
      message: `Cambiado a la base de datos '${currentDatabase}'`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1.3 Crear nueva base de datos (priorizando la tarjeta SD si existe o permitiendo elegir carpeta)
app.post('/api/database/create', async (req, res) => {
  try {
    let { databaseName, parentDirectory } = req.body;
    if (!databaseName || !databaseName.trim()) {
      return res.status(400).json({ success: false, error: 'Nombre de base de datos requerido' });
    }

    const cleanName = databaseName.trim().replace(/[^a-zA-Z0-9_-]/g, '');

    // Si no se proporcionó parentDirectory, priorizar tarjeta SD detectada
    if (!parentDirectory || !parentDirectory.trim()) {
      const drives = await DiskDetector.getAvailableDrives();
      const sd = drives.find((d) => d.isSdCard || d.type === 'removable');
      if (sd) {
        parentDirectory = sd.letter.endsWith('\\') ? sd.letter : `${sd.letter}\\`;
      } else if (rootDirectory) {
        parentDirectory = rootDirectory;
      } else if (currentDbDirectory) {
        parentDirectory = currentDbDirectory;
      }
    }

    if (!parentDirectory) {
      return res.status(400).json({
        success: false,
        error: 'No se detectó tarjeta SD ni se especificó una carpeta de destino. Por favor selecciona una carpeta.'
      });
    }

    const normalizedParent = path.normalize(parentDirectory);
    if (!fs.existsSync(normalizedParent)) {
      fs.mkdirSync(normalizedParent, { recursive: true });
    }

    const targetDir = path.join(normalizedParent, cleanName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Crear marcador de base de datos MicroDB (.microdb) para que sea reconocida inmediatamente
    const markerPath = path.join(targetDir, '.microdb');
    if (!fs.existsSync(markerPath)) {
      try {
        fs.writeFileSync(
          markerPath,
          JSON.stringify({ name: cleanName, createdAt: new Date().toISOString() }, null, 2),
          'utf8'
        );
      } catch (e) { }
    }

    rootDirectory = normalizedParent;
    currentDatabase = cleanName;
    currentDbDirectory = targetDir;
    loadSchemasFromDisk(currentDbDirectory);
    sdWatcher.watchDirectory(rootDirectory);
    const sqlitePath = await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);

    res.json({
      success: true,
      database: {
        name: cleanName,
        path: targetDir,
        tableCount: 0
      },
      currentDbDirectory,
      rootDirectory,
      sqlitePath,
      activeDatabase: cleanName,
      message: `Base de datos '${cleanName}' creada exitosamente en ${normalizedParent}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1.3.1 Abrir diálogo nativo del explorador para seleccionar carpeta o tarjeta SD
app.post('/api/browse-directory', async (req, res) => {
  try {
    const { title } = req.body;
    const selectedPath = await showNativeFolderDialog(title || 'Seleccionar carpeta o tarjeta SD');
    if (!selectedPath) {
      return res.json({ success: true, canceled: true });
    }
    res.json({
      success: true,
      canceled: false,
      selectedPath: path.normalize(selectedPath)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1.3.2 Explorar directorios y subcarpetas para navegación interactiva
app.post('/api/fs/explore', async (req, res) => {
  try {
    let { targetPath } = req.body;

    if (!targetPath || typeof targetPath !== 'string' || !targetPath.trim()) {
      if (currentDbDirectory && fs.existsSync(currentDbDirectory)) {
        targetPath = currentDbDirectory;
      } else if (rootDirectory && fs.existsSync(rootDirectory)) {
        targetPath = rootDirectory;
      } else {
        const drives = await DiskDetector.getAvailableDrives();
        targetPath = drives.length > 0
          ? (drives[0].letter.endsWith('\\') ? drives[0].letter : `${drives[0].letter}\\`)
          : 'C:\\';
      }
    }

    targetPath = targetPath.trim();
    if (/^[a-zA-Z]:$/.test(targetPath)) {
      targetPath = `${targetPath}\\`;
    }

    const normalized = path.normalize(targetPath);
    if (!fs.existsSync(normalized)) {
      return res.status(404).json({ success: false, error: `La ruta no existe: ${normalized}` });
    }

    const stat = fs.statSync(normalized);
    if (!stat.isDirectory()) {
      return res.status(400).json({ success: false, error: `La ruta no es un directorio: ${normalized}` });
    }

    const driveMatch = normalized.match(/^([a-zA-Z]:)/);
    const driveLetter = driveMatch ? driveMatch[1].toUpperCase() : (normalized.startsWith('/') ? '/' : '');

    const parentDir = path.dirname(normalized);
    const isDriveRoot = /^[a-zA-Z]:\\?$/.test(normalized) || normalized === '/' || normalized === '\\';
    const parentPath = isDriveRoot ? null : parentDir;

    // Construcción de breadcrumbs interactivos
    const breadcrumbs: { name: string; path: string }[] = [];
    if (process.platform === 'win32' && driveMatch) {
      const rootPart = `${driveLetter}\\`;
      breadcrumbs.push({ name: driveLetter, path: rootPart });
      const relative = path.relative(rootPart, normalized);
      if (relative && relative !== '.') {
        const parts = relative.split(/[\\/]+/).filter(Boolean);
        let acc = rootPart;
        for (const p of parts) {
          acc = path.join(acc, p);
          breadcrumbs.push({ name: p, path: acc });
        }
      }
    } else {
      breadcrumbs.push({ name: '/', path: '/' });
      const parts = normalized.split('/').filter(Boolean);
      let acc = '';
      for (const p of parts) {
        acc = `${acc}/${p}`;
        breadcrumbs.push({ name: p, path: acc });
      }
    }

    // Listar entradas de directorio de forma segura
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(normalized, { withFileTypes: true });
    } catch (e: any) {
      return res.status(403).json({ success: false, error: `Acceso denegado a la carpeta: ${e.message}` });
    }

    // Tablas directamente en la carpeta actual
    const currentTblFiles = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.tbl'))
      .map((e) => e.name.replace(/\.tbl$/i, ''));

    // Subdirectorios
    const directories: Array<{
      name: string;
      path: string;
      isDatabase: boolean;
      tableCount: number;
      tables: string[];
    }> = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !isSystemOrIgnoredDir(entry.name)) {
        const subPath = path.join(normalized, entry.name);
        try {
          const subFiles = fs.readdirSync(subPath);
          const tbls = subFiles
            .filter((f) => f.toLowerCase().endsWith('.tbl'))
            .map((f) => f.replace(/\.tbl$/i, ''));
          const hasDbMarker = subFiles.some((f) => {
            const l = f.toLowerCase();
            return (
              l === '.microdb' ||
              l === 'microdb.json' ||
              l.endsWith('.jsn') ||
              l.endsWith('.schema.json') ||
              l.endsWith('.sch')
            );
          });

          directories.push({
            name: entry.name,
            path: subPath,
            isDatabase: tbls.length > 0 || hasDbMarker,
            tableCount: tbls.length,
            tables: tbls
          });
        } catch {
          // Si no hay permisos para leer el interior de la subcarpeta, se lista como carpeta normal
          directories.push({
            name: entry.name,
            path: subPath,
            isDatabase: false,
            tableCount: 0,
            tables: []
          });
        }
      }
    }

    directories.sort((a, b) => {
      if (a.isDatabase && !b.isDatabase) return -1;
      if (!a.isDatabase && b.isDatabase) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json({
      success: true,
      currentPath: normalized,
      driveLetter,
      parentPath,
      breadcrumbs,
      directories,
      currentFolderTables: currentTblFiles,
      isDatabaseFolder: currentTblFiles.length > 0 || entries.some((e) => e.name.toLowerCase() === '.microdb')
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error explorando directorio' });
  }
});

// 1.3.3 Crear carpeta / base de datos en un directorio específico
app.post('/api/fs/create-folder', async (req, res) => {
  try {
    const { parentPath, folderName, isDatabase = true } = req.body;
    if (!parentPath || typeof parentPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Ruta padre no proporcionada' });
    }
    if (!folderName || typeof folderName !== 'string' || !folderName.trim()) {
      return res.status(400).json({ success: false, error: 'Nombre de carpeta no proporcionado' });
    }

    const cleanName = folderName.trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!cleanName) {
      return res.status(400).json({ success: false, error: 'Nombre de carpeta inválido' });
    }

    const normalizedParent = path.normalize(parentPath);
    if (!fs.existsSync(normalizedParent)) {
      return res.status(404).json({ success: false, error: `La ruta padre no existe: ${normalizedParent}` });
    }

    const targetDir = path.join(normalizedParent, cleanName);
    if (fs.existsSync(targetDir)) {
      return res.status(400).json({ success: false, error: `La carpeta '${cleanName}' ya existe en esta ubicación.` });
    }

    fs.mkdirSync(targetDir, { recursive: true });

    if (isDatabase) {
      const markerPath = path.join(targetDir, '.microdb');
      try {
        fs.writeFileSync(
          markerPath,
          JSON.stringify({ name: cleanName, createdAt: new Date().toISOString() }, null, 2),
          'utf8'
        );
      } catch { }
    }

    res.json({
      success: true,
      folderPath: targetDir,
      folderName: cleanName,
      message: `Carpeta '${cleanName}' creada exitosamente en ${normalizedParent}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error creando carpeta' });
  }
});

// 1.4 Eliminar base de datos completa de la SD
app.delete('/api/database/:name', async (req, res) => {
  try {
    const dbName = req.params.name;
    if (!rootDirectory) return res.status(400).json({ success: false, error: 'No hay unidad abierta' });
    if (dbName === 'Principal (Raíz)' || isSystemOrIgnoredDir(dbName)) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una carpeta de sistema o el directorio raíz' });
    }

    const targetDir = path.join(rootDirectory, dbName);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    const dbs = scanDatabases(rootDirectory);
    if (dbs.length > 0) {
      currentDatabase = dbs[0].name;
      currentDbDirectory = currentDatabase === 'Principal (Raíz)' || currentDatabase === 'Raíz (/)' || currentDatabase === '/'
        ? rootDirectory
        : path.join(rootDirectory, currentDatabase);
      loadSchemasFromDisk(currentDbDirectory);
      await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);
    } else {
      currentDatabase = '';
      currentDbDirectory = null;
      schemas.clear();
    }

    res.json({
      success: true,
      activeDatabase: currentDatabase,
      message: `Base de datos '${dbName}' eliminada de la SD`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Abrir directorio de base de datos (o unidad SD completa)
app.post('/api/open-directory', async (req, res) => {
  try {
    let { dirPath } = req.body;
    if (!dirPath || typeof dirPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Ruta de directorio no proporcionada' });
    }

    dirPath = dirPath.trim();
    if (/^[a-zA-Z]:$/.test(dirPath)) {
      dirPath = `${dirPath}\\`;
    }

    const normalized = path.normalize(dirPath);

    // Si no existe, no intentar crearlo automáticamente
    if (!fs.existsSync(normalized)) {
      return res.status(400).json({ success: false, error: `Directorio no válido o inaccesible: ${normalized}` });
    }

    const isDriveRoot = /^[a-zA-Z]:\\?$/.test(normalized) || normalized === '/' || normalized === '\\';
    const files = fs.readdirSync(normalized);
    const hasTblDirectly = files.some((f) => f.toLowerCase().endsWith('.tbl'));
    const parentDir = path.dirname(normalized);
    const folderName = path.basename(normalized);

    if (isDriveRoot) {
      // El usuario seleccionó la raíz de la unidad (ej: E:\ o D:\)
      rootDirectory = normalized;
      const dbs = scanDatabases(rootDirectory);
      if (dbs.length > 0) {
        const dbWithTables = dbs.find((d) => d.tableCount > 0);
        currentDatabase = dbWithTables ? dbWithTables.name : dbs[0].name;
        currentDbDirectory = currentDatabase === 'Principal (Raíz)' || currentDatabase === 'Raíz (/)' || currentDatabase === '/'
          ? rootDirectory
          : path.join(rootDirectory, currentDatabase);
      } else {
        // La unidad no contiene bases de datos todavía. NO crear nada automáticamente.
        currentDatabase = '';
        currentDbDirectory = null;
      }
    } else {
      // El usuario abrió una carpeta específica.
      // Comprobamos si tiene subcarpetas que sean bases de datos MicroDB reales.
      const subEntries = fs.readdirSync(normalized, { withFileTypes: true });
      const databaseSubfolders = subEntries.filter(
        (e) => e.isDirectory() && !isSystemOrIgnoredDir(e.name) && isDatabaseFolder(path.join(normalized, e.name))
      );

      if (databaseSubfolders.length > 0) {
        // La carpeta seleccionada contiene múltiples bases de datos reales en sus subcarpetas
        rootDirectory = normalized;
        const subWithTables = databaseSubfolders.find((e) => countDatabaseTables(path.join(normalized, e.name)) > 0);
        currentDatabase = subWithTables ? subWithTables.name : databaseSubfolders[0].name;
        currentDbDirectory = path.join(rootDirectory, currentDatabase);
      } else if (hasTblDirectly || isDatabaseFolder(normalized)) {
        // La carpeta seleccionada es ELLA MISMA una base de datos MicroDB legítima existente
        const isParentDrive = /^[a-zA-Z]:\\?$/.test(parentDir) || parentDir === '/' || parentDir === '\\';
        rootDirectory = isParentDrive ? normalized : (parentDir || normalized);
        currentDatabase = folderName;
        currentDbDirectory = normalized;
      } else {
        // Carpeta ordinaria o vacía. NO creamos .microdb, NO creamos carpetas 'DB' en automático.
        rootDirectory = normalized;
        currentDatabase = '';
        currentDbDirectory = null;
      }
    }

    let sqlitePath: string | null = null;
    if (currentDbDirectory && fs.existsSync(currentDbDirectory)) {
      loadSchemasFromDisk(currentDbDirectory);
      try {
        sqlitePath = await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);
      } catch (e) {
        console.warn('Aviso: SQLiteBridge no pudo sincronizarse:', e);
      }
    } else {
      schemas.clear();
    }

    sdWatcher.watchDirectory(rootDirectory); // Observar toda la SD recursivamente

    res.json({
      success: true,
      rootDirectory,
      activeDatabase: currentDatabase,
      currentDbDirectory,
      sqlitePath,
      message: currentDatabase
        ? `Directorio abierto correctamente. Base de datos activa: '${currentDatabase}'`
        : `Directorio abierto correctamente. Sin bases de datos preexistentes.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2.1 Cerrar directorio / desconectar ubicación activa
app.post('/api/close-directory', async (req, res) => {
  try {
    sdWatcher.stop();
    rootDirectory = null;
    currentDatabase = 'DB';
    currentDbDirectory = null;
    schemas.clear();

    res.json({
      success: true,
      message: 'Directorio cerrado correctamente'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Listar todas las tablas en el directorio actual
app.get('/api/tables', (_req, res) => {
  try {
    if (!currentDbDirectory || !fs.existsSync(currentDbDirectory)) {
      return res.json({ success: true, tables: [] });
    }

    const files = fs.readdirSync(currentDbDirectory);
    const tableFiles = files.filter(f => f.toLowerCase().endsWith('.tbl'));
    const tables: TableSummary[] = [];

    for (const f of tableFiles) {
      const ext = path.extname(f);
      const tableName = path.basename(f, ext);
      const filePath = path.join(currentDbDirectory, f);
      const indexPath = path.join(currentDbDirectory, `${tableName}.idx`);
      const hasIndex = fs.existsSync(indexPath) || fs.existsSync(path.join(currentDbDirectory, `${tableName}.IDX`));

      try {
        const stats = fs.statSync(filePath);
        const header = MicroDBEngine.readTableHeader(filePath);
        const schema = findSchemaForTable(currentDbDirectory, tableName, header);

        const total = header.totalSlots;
        const deleted = header.deletedRecords;
        const fragmentationPercent = total > 0 ? Number.parseFloat(((deleted / total) * 100).toFixed(1)) : 0;

        tables.push({
          name: tableName,
          filePath,
          fileSizeBytes: stats.size,
          header,
          schema,
          hasIndex,
          indexPath: hasIndex ? indexPath : undefined,
          fragmentationPercent,
          lastModified: stats.mtime.toISOString()
        });
      } catch (err) {
        console.warn(`Error leyendo cabecera de ${f}:`, err);
      }
    }

    res.json({ success: true, tables, currentDbDirectory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Obtener detalle y registros de una tabla
app.get('/api/table/:name', (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const fileInfo = getTableFileInfo(currentDbDirectory, req.params.name);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: `Tabla '${req.params.name}' no encontrada` });
    }

    const { tableName, tablePath } = fileInfo;
    const header = MicroDBEngine.readTableHeader(tablePath);
    const schema = findSchemaForTable(currentDbDirectory, tableName, header);

    const { records } = MicroDBEngine.readAllSlots(tablePath, schema);

    res.json({
      success: true,
      tableName,
      header,
      schema,
      records,
      totalCount: records.length,
      activeCount: header.activeRecords,
      deletedCount: header.deletedRecords
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Insertar un nuevo registro (con validación de Claves Foráneas y Unicidad)
app.post('/api/table/:name/record', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const fileInfo = getTableFileInfo(currentDbDirectory, req.params.name);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: `Tabla '${req.params.name}' no encontrada` });
    }

    const { tableName, tablePath } = fileInfo;
    const recordData = req.body;

    const header = MicroDBEngine.readTableHeader(tablePath);
    const schema = findSchemaForTable(currentDbDirectory, tableName, header);

    // Validaciones de integridad referencial y unicidad
    validateForeignKeys(currentDbDirectory, tableName, recordData, schema);
    validateUniqueConstraints(tablePath, tableName, recordData, schema);

    const assignedId = MicroDBEngine.insertRecord(tablePath, recordData, schema);
    await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);

    res.json({ success: true, assignedId, message: `Registro insertado exitosamente con ID #${assignedId}` });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6. Actualizar un registro in-place (con validación de Claves Foráneas y Unicidad)
app.put('/api/table/:name/record/:slotIndex', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const fileInfo = getTableFileInfo(currentDbDirectory, req.params.name);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: `Tabla '${req.params.name}' no encontrada` });
    }

    const { tableName, tablePath } = fileInfo;
    const slotIndex = Number.parseInt(req.params.slotIndex, 10);
    const recordData = req.body;

    const header = MicroDBEngine.readTableHeader(tablePath);
    const schema = findSchemaForTable(currentDbDirectory, tableName, header);

    // Validaciones de integridad referencial y unicidad
    validateForeignKeys(currentDbDirectory, tableName, recordData, schema);
    validateUniqueConstraints(tablePath, tableName, recordData, schema, slotIndex);

    const updated = MicroDBEngine.updateRecord(tablePath, slotIndex, recordData, schema);
    if (!updated) {
      return res.status(400).json({ success: false, error: 'No se pudo actualizar el registro' });
    }

    await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);
    res.json({ success: true, message: 'Registro actualizado in-place correctamente' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 7. Borrar registro lógicamente (Tombstone O(1))
app.delete('/api/table/:name/record/:slotIndex', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const fileInfo = getTableFileInfo(currentDbDirectory, req.params.name);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: `Tabla '${req.params.name}' no encontrada` });
    }

    const { tablePath } = fileInfo;
    const slotIndex = Number.parseInt(req.params.slotIndex, 10);

    const deleted = MicroDBEngine.deleteRecord(tablePath, slotIndex);
    if (!deleted) {
      return res.status(400).json({ success: false, error: 'El registro ya estaba borrado o índice inválido' });
    }

    await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);
    res.json({ success: true, message: 'Registro marcado como borrado y encolado en la Free-List' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Desfragmentar y compactar tabla (Vacuum)
app.post('/api/table/:name/vacuum', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const fileInfo = getTableFileInfo(currentDbDirectory, req.params.name);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: `Tabla '${req.params.name}' no encontrada` });
    }

    const { tableName, tablePath } = fileInfo;
    let schema = schemas.get(tableName) || schemas.get(tableName.toLowerCase());
    if (!schema) {
      const header = MicroDBEngine.readTableHeader(tablePath);
      schema = MicroDBEngine.generateDefaultSchema(header, tableName);
    }

    const result = TableDefragmenter.vacuumTable(tablePath, schema);
    await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);

    res.json({
      success: true,
      result,
      message: `Tabla compactada exitosamente. Se recuperaron ${result.reclaimedBytes} bytes.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.1 Eliminar tabla completa (Drop Table)
app.delete('/api/table/:name', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const fileInfo = getTableFileInfo(currentDbDirectory, req.params.name);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: `Tabla '${req.params.name}' no encontrada` });
    }

    const { tableName, tablePath } = fileInfo;

    // Eliminar archivo .tbl
    if (fs.existsSync(tablePath)) {
      fs.unlinkSync(tablePath);
    }

    // Eliminar archivo .idx si existe
    const indexPath = path.join(currentDbDirectory, `${tableName}.idx`);
    if (fs.existsSync(indexPath)) {
      fs.unlinkSync(indexPath);
    }
    const indexUpperPath = path.join(currentDbDirectory, `${tableName}.IDX`);
    if (fs.existsSync(indexUpperPath)) {
      fs.unlinkSync(indexUpperPath);
    }

    // Eliminar archivo de esquema si existe (.schema.json, .jsn, .sch, .json)
    const possibleSchemaFiles = [
      `${tableName}.schema.json`,
      `${tableName}.jsn`,
      `${tableName.toUpperCase()}.JSN`,
      `${tableName}.sch`,
      `${tableName.toUpperCase()}.SCH`,
      `${tableName}.json`
    ];
    for (const f of possibleSchemaFiles) {
      const p = path.join(currentDbDirectory, f);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) { }
      }
    }
    schemas.delete(tableName);
    schemas.delete(tableName.toLowerCase());

    // Sincronizar SQLite para remover la tabla
    await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);

    res.json({ success: true, message: `Tabla '${tableName}' eliminada exitosamente de la tarjeta SD` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Crear nueva tabla
app.post('/api/table/create', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const { tableName, schema } = req.body;
    if (!tableName) return res.status(400).json({ success: false, error: 'Nombre de tabla requerido' });

    const cleanName = tableName.replace(/\.tbl$/i, '');
    const tablePath = path.join(currentDbDirectory, `${cleanName}.tbl`);
    if (fs.existsSync(tablePath)) {
      return res.status(400).json({ success: false, error: 'La tabla ya existe' });
    }

    const finalSchema = schema || {
      tableName: cleanName,
      recordSize: 32,
      fields: []
    };

    MicroDBEngine.createTable(tablePath, finalSchema.recordSize);
    saveSchemaToDisk(currentDbDirectory, finalSchema);
    await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);

    res.json({ success: true, message: `Tabla '${cleanName}' creada con éxito` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Parser de Structs C++
app.post('/api/schema/parse-cpp', (req, res) => {
  try {
    const { code, tableName } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Código C++ no proporcionado' });

    const cleanName = (tableName || 'unnamed').replace(/\.tbl$/i, '');
    const parsedSchema = SchemaParser.parseCppStruct(code, cleanName);
    res.json({ success: true, schema: parsedSchema });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10.1 Auto-detectar esquema desde los bytes reales de la tabla
app.post('/api/schema/auto-detect/:name', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const fileInfo = getTableFileInfo(currentDbDirectory, req.params.name);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: `Tabla '${req.params.name}' no encontrada` });
    }

    const { tableName, tablePath } = fileInfo;
    const header = MicroDBEngine.readTableHeader(tablePath);
    const sampleBuffers = MicroDBEngine.readRawBuffers(tablePath);
    const inferredSchema = SchemaParser.inferSchemaFromBuffers(header.recordSize, sampleBuffers, tableName);

    saveSchemaToDisk(currentDbDirectory, inferredSchema);
    await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);

    res.json({
      success: true,
      schema: inferredSchema,
      message: `Esquema para '${tableName}' auto-detectado y aplicado con éxito`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Guardar esquema
app.post('/api/schema/save', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const { schema } = req.body;
    if (!schema?.tableName) {
      return res.status(400).json({ success: false, error: 'Esquema no válido' });
    }

    schema.tableName = schema.tableName.replace(/\.tbl$/i, '');
    saveSchemaToDisk(currentDbDirectory, schema);
    await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);

    res.json({ success: true, message: `Esquema de '${schema.tableName}' guardado con éxito` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Ejecución de Consultas SQL (DBeaver / SQL Studio)
app.post('/api/sql/query', async (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const { sql } = req.body;
    if (!sql?.trim()) {
      return res.status(400).json({ success: false, error: 'Consulta SQL vacía' });
    }

    const sqlitePath = path.join(currentDbDirectory, 'microdb_live.sqlite');
    if (!fs.existsSync(sqlitePath)) {
      await SQLiteBridge.syncFolderToSqlite(currentDbDirectory, schemas);
    }

    const result = await SQLiteBridge.executeQuery(sqlitePath, sql);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 13. Exportación Multiformato (CSV, Excel, JSON, SQL Dump)
app.post('/api/export', (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const { format, tableName, customRecords } = req.body;
    let recordsToExport: any[] = [];
    let activeSchema: TableSchema | undefined;

    if (customRecords && Array.isArray(customRecords)) {
      recordsToExport = customRecords;
    } else if (tableName) {
      const fileInfo = getTableFileInfo(currentDbDirectory, tableName);
      if (fileInfo) {
        activeSchema = schemas.get(fileInfo.tableName) || schemas.get(fileInfo.tableName.toLowerCase());
        const { records } = MicroDBEngine.readAllSlots(fileInfo.tablePath, activeSchema);
        recordsToExport = records;
      }
    }

    switch (format) {
      case 'csv': {
        const csvContent = Exporter.toCSV(recordsToExport, activeSchema);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName || 'export'}.csv"`);
        return res.send(csvContent);
      }
      case 'json': {
        const jsonContent = Exporter.toJSON(recordsToExport, activeSchema);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName || 'export'}.json"`);
        return res.send(jsonContent);
      }
      case 'xlsx': {
        const excelBuffer = Exporter.toExcelBuffer(recordsToExport, tableName || 'Data', activeSchema);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName || 'export'}.xlsx"`);
        return res.send(excelBuffer);
      }
      case 'sql': {
        const sqlContent = Exporter.toSQLDump(recordsToExport, tableName || 'exported_table', activeSchema);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName || 'export'}.sql"`);
        return res.send(sqlContent);
      }
      default:
        return res.status(400).json({ success: false, error: 'Formato no soportado' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Leer índice secundario .idx
app.get('/api/index/:name', (req, res) => {
  try {
    if (!currentDbDirectory) return res.status(400).json({ success: false, error: 'No hay directorio abierto' });

    const indexName = req.params.name.replace(/\.idx$/i, '');
    let indexPath = path.join(currentDbDirectory, `${indexName}.idx`);
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(currentDbDirectory, `${indexName}.IDX`);
    }

    const data = MicroDBEngine.readIndex(indexPath);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Servir frontend compilado en producción
const possibleDistPaths = [
  path.join(__dirname, '../dist'),
  path.join(__dirname, 'dist'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'resources/app.asar/dist'),
  path.join(process.cwd(), 'resources/app/dist')
];

let clientDist = possibleDistPaths.find((p) => fs.existsSync(p));
if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist!, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 MicroDB Studio Backend ejecutándose en: http://localhost:${PORT}`);
  console.log(`📁 API REST & WebSocket Bridge listos`);
  console.log(`======================================================\n`);
});
