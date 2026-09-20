// ============================================================================
// MICRODB STUDIO - DETECTOR DE UNIDADES SD Y DISCOS LOCALES (WINDOWS / CROSS-PLATFORM)
// ============================================================================

import { exec } from 'node:child_process';
import util from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execAsync = util.promisify(exec);

export interface DetectedDatabase {
  name: string;
  path: string;
  tableCount: number;
  tables: string[];
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

export class DiskDetector {
  /**
   * Obtiene la lista de unidades del sistema e identifica tarjetas SD y bases de datos MicroDB
   */
  public static async getAvailableDrives(): Promise<DetectedDrive[]> {
    if (process.platform !== 'win32') {
      return this.getDefaultNonWindowsDrive();
    }

    try {
      return await this.detectWindowsDrives();
    } catch (err) {
      console.warn('Error detectando unidades con PowerShell, usando fallback:', err);
      return this.detectFallbackDrives();
    }
  }

  private static getDefaultNonWindowsDrive(): DetectedDrive[] {
    const rootPath = '/';
    const { hasDbFolder, dbPath, databases } = this.scanDatabasesInDrive(rootPath);
    return [{
      letter: '/',
      name: 'Root /',
      type: 'fixed',
      isSdCard: false,
      hasDbFolder,
      dbPath,
      databases
    }];
  }

  private static async detectWindowsDrives(): Promise<DetectedDrive[]> {
    const psCommand = 'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, DriveType, Size, FreeSpace | ConvertTo-Json"';
    const { stdout } = await execAsync(psCommand);
    const trimmed = stdout.trim();
    if (!trimmed) {
      return [];
    }

    const rawData = JSON.parse(trimmed);
    const list = Array.isArray(rawData) ? rawData : [rawData];
    const drives: DetectedDrive[] = [];

    for (const item of list) {
      const drive = this.parseWindowsDriveItem(item);
      if (drive) {
        drives.push(drive);
      }
    }

    return drives;
  }

  private static parseWindowsDriveItem(item: any): DetectedDrive | null {
    const letter = item.DeviceID;
    if (!letter) return null;

    // DriveType 2 = Removable (SD card / USB), 3 = Fixed, 4 = Network
    const isRemovable = item.DriveType === 2;
    const isFixed = item.DriveType === 3;
    let type: DetectedDrive['type'] = 'unknown';
    if (isRemovable) {
      type = 'removable';
    } else if (isFixed) {
      type = 'fixed';
    }

    const drivePath = `${letter}\\`;
    const { hasDbFolder, dbPath, databases } = this.scanDatabasesInDrive(drivePath);

    return {
      letter,
      name: item.VolumeName || (isRemovable ? 'Tarjeta SD / Extraíble' : 'Disco Local'),
      type,
      isSdCard: isRemovable,
      hasDbFolder,
      dbPath: dbPath || drivePath,
      databases,
      totalSpaceGb: this.formatGigabytes(item.Size),
      freeSpaceGb: this.formatGigabytes(item.FreeSpace)
    };
  }

  public static scanDatabasesInDrive(drivePath: string): { hasDbFolder: boolean; dbPath?: string; databases: DetectedDatabase[] } {
    const databases: DetectedDatabase[] = [];
    try {
      if (!fs.existsSync(drivePath)) {
        return { hasDbFolder: false, databases: [] };
      }

      const entries = fs.readdirSync(drivePath, { withFileTypes: true });

      // 1. Verificar si en la raíz misma hay tablas .tbl
      const rootTbls = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.tbl'))
        .map((e) => e.name.replace(/\.tbl$/i, ''));

      if (rootTbls.length > 0) {
        databases.push({
          name: 'Raíz (/)',
          path: drivePath,
          tableCount: rootTbls.length,
          tables: rootTbls
        });
      }

      // 2. Escanear subcarpetas
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          !entry.name.includes('System Volume Information') &&
          !entry.name.startsWith('$')
        ) {
          const subPath = path.join(drivePath, entry.name);
          try {
            const subFiles = fs.readdirSync(subPath);
            const subTbls = subFiles
              .filter((f) => f.toLowerCase().endsWith('.tbl'))
              .map((f) => f.replace(/\.tbl$/i, ''));

            const hasSchemas = subFiles.some(
              (f) =>
                f.toLowerCase().endsWith('.jsn') ||
                f.toLowerCase().endsWith('.sch') ||
                f.toLowerCase().endsWith('.schema.json')
            );

            // Si tiene tablas, esquemas, o empieza por DB/STORE/SENSORS/etc.
            if (subTbls.length > 0 || hasSchemas || entry.name.toUpperCase().startsWith('DB')) {
              databases.push({
                name: entry.name,
                path: subPath,
                tableCount: subTbls.length,
                tables: subTbls
              });
            }
          } catch {
            // Ignorar carpetas protegidas
          }
        }
      }
    } catch {
      // Ignorar errores de acceso a unidad
    }

    const hasDbFolder = databases.length > 0;
    const firstDbWithTables = databases.find((d) => d.tableCount > 0);
    const dbPath = firstDbWithTables ? firstDbWithTables.path : (databases[0]?.path || drivePath);

    return { hasDbFolder, dbPath, databases };
  }

  private static detectFallbackDrives(): DetectedDrive[] {
    const letters = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'];
    const drives: DetectedDrive[] = [];

    for (const l of letters) {
      const drivePath = `${l}\\`;
      try {
        if (fs.existsSync(drivePath)) {
          const { hasDbFolder, dbPath, databases } = this.scanDatabasesInDrive(drivePath);
          drives.push({
            letter: l,
            name: `Unidad ${l}`,
            type: l === 'C:' || l === 'D:' ? 'fixed' : 'removable',
            isSdCard: l !== 'C:' && l !== 'D:',
            hasDbFolder,
            dbPath: dbPath || drivePath,
            databases
          });
        }
      } catch {
        // Ignorar unidades inaccesibles
      }
    }

    return drives;
  }

  private static formatGigabytes(bytes?: number): number | undefined {
    if (bytes === undefined || bytes === null) return undefined;
    return Number.parseFloat((bytes / (1024 ** 3)).toFixed(2));
  }
}
