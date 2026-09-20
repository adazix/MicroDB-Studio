// ============================================================================
// MICRODB STUDIO - MOTOR BINARIO DE ALTA VELOCIDAD PARA MICRODB (MTB1 / MID1)
// 100% Compatible a nivel de bytes con MicroDB para Arduino / ESP32 / SD
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import {
  MICRODB_MAGIC_TABLE,
  MICRODB_MAGIC_INDEX,
  MICRODB_NULL_OFFSET,
  TABLE_HEADER_SIZE,
  SLOT_HEADER_SIZE,
  INDEX_HEADER_SIZE,
  INDEX_ENTRY_SIZE,
  RecordStatus,
  TableHeaderData,
  SlotHeaderData,
  IndexHeaderData,
  IndexEntryData,
  TableSchema,
  FieldSchema,
  DecodedRecord,
  TableSummary
} from './microdbTypes.js';
import { SchemaParser } from './schemaParser.js';
import { fnv1a32 } from './fnv1a.js';

export class MicroDBEngine {
  /**
   * Lee la cabecera de 64 bytes de una tabla .tbl
   */
  public static readTableHeader(filePath: string): TableHeaderData {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(TABLE_HEADER_SIZE);
    fs.readSync(fd, buffer, 0, TABLE_HEADER_SIZE, 0);
    fs.closeSync(fd);

    const magic = buffer.readUInt32LE(0);
    if (magic !== MICRODB_MAGIC_TABLE) {
      throw new Error(`Archivo no válido o Magic number incorrecto: 0x${magic.toString(16)}`);
    }

    return {
      magic,
      version: buffer.readUInt16LE(4),
      recordSize: buffer.readUInt16LE(6),
      totalSlots: buffer.readUInt32LE(8),
      activeRecords: buffer.readUInt32LE(12),
      deletedRecords: buffer.readUInt32LE(16),
      firstFreeSlot: buffer.readUInt32LE(20),
      nextAutoId: buffer.readUInt32LE(24),
      dataStartOffset: buffer.readUInt32LE(28),
      reserved: buffer.subarray(32, 64)
    };
  }

  /**
   * Escribe la cabecera de 64 bytes en el archivo .tbl
   */
  public static writeTableHeader(filePath: string, header: TableHeaderData): void {
    const buffer = Buffer.alloc(TABLE_HEADER_SIZE);
    buffer.writeUInt32LE(header.magic, 0);
    buffer.writeUInt16LE(header.version, 4);
    buffer.writeUInt16LE(header.recordSize, 6);
    buffer.writeUInt32LE(header.totalSlots, 8);
    buffer.writeUInt32LE(header.activeRecords, 12);
    buffer.writeUInt32LE(header.deletedRecords, 16);
    buffer.writeUInt32LE(header.firstFreeSlot, 20);
    buffer.writeUInt32LE(header.nextAutoId, 24);
    buffer.writeUInt32LE(header.dataStartOffset, 28);
    if (header.reserved && header.reserved.length === 32) {
      header.reserved.copy(buffer, 32);
    }

    const fd = fs.openSync(filePath, 'r+');
    fs.writeSync(fd, buffer, 0, TABLE_HEADER_SIZE, 0);
    fs.closeSync(fd);
  }

  /**
   * Decodifica un buffer binario de payload de registro usando el TableSchema
   */
  public static decodePayload(buffer: Buffer, schema: TableSchema): Record<string, any> {
    const result: Record<string, any> = {};

    for (const field of schema.fields) {
      const offset = field.offset;
      if (offset >= buffer.length) continue;

      try {
        switch (field.type) {
          case 'bool':
            result[field.name] = buffer.readUInt8(offset) !== 0;
            break;
          case 'int8':
            result[field.name] = buffer.readInt8(offset);
            break;
          case 'uint8':
            result[field.name] = buffer.readUInt8(offset);
            break;
          case 'int16':
            result[field.name] = buffer.readInt16LE(offset);
            break;
          case 'uint16':
            result[field.name] = buffer.readUInt16LE(offset);
            break;
          case 'int32':
            result[field.name] = buffer.readInt32LE(offset);
            break;
          case 'uint32':
            result[field.name] = buffer.readUInt32LE(offset);
            break;
          case 'int64':
            result[field.name] = Number(buffer.readBigInt64LE(offset));
            break;
          case 'uint64':
            result[field.name] = Number(buffer.readBigUInt64LE(offset));
            break;
          case 'float':
            // Redondear a 4 decimales o mantener precisión
            result[field.name] = Number.parseFloat(buffer.readFloatLE(offset).toFixed(6));
            break;
          case 'double':
            result[field.name] = buffer.readDoubleLE(offset);
            break;
          case 'char':
          case 'string':
          case 'json':
          case 'media_path': {
            const rawStr = buffer.toString('utf8', offset, offset + field.byteSize);
            // Cortar en el primer byte nulo '\0'
            const nullIndex = rawStr.indexOf('\0');
            const cleanStr = nullIndex !== -1 ? rawStr.substring(0, nullIndex) : rawStr;
            result[field.name] = cleanStr;
            break;
          }
          case 'blob': {
            const sub = buffer.subarray(offset, offset + field.byteSize);
            result[field.name] = sub.toString('hex').toUpperCase();
            break;
          }
          default:
            result[field.name] = buffer.subarray(offset, offset + field.byteSize).toString('hex');
            break;
        }
      } catch (err) {
        result[field.name] = null;
      }
    }

    return result;
  }

  /**
   * Codifica un objeto JSON a un buffer binario de payload de registro
   */
  public static encodePayload(recordData: Record<string, any>, schema: TableSchema): Buffer {
    const buffer = Buffer.alloc(schema.recordSize);

    for (const field of schema.fields) {
      const val = recordData[field.name];
      const offset = field.offset;
      if (offset >= schema.recordSize) continue;

      try {
        switch (field.type) {
          case 'bool':
            buffer.writeUInt8(val ? 1 : 0, offset);
            break;
          case 'int8':
            buffer.writeInt8(Number(val) || 0, offset);
            break;
          case 'uint8':
            buffer.writeUInt8(Number(val) || 0, offset);
            break;
          case 'int16':
            buffer.writeInt16LE(Number(val) || 0, offset);
            break;
          case 'uint16':
            buffer.writeUInt16LE(Number(val) || 0, offset);
            break;
          case 'int32':
            buffer.writeInt32LE(Number(val) || 0, offset);
            break;
          case 'uint32':
            buffer.writeUInt32LE(Number(val) || 0, offset);
            break;
          case 'int64':
            buffer.writeBigInt64LE(BigInt(Math.floor(Number(val) || 0)), offset);
            break;
          case 'uint64':
            buffer.writeBigUInt64LE(BigInt(Math.floor(Number(val) || 0)), offset);
            break;
          case 'float':
            buffer.writeFloatLE(Number(val) || 0.0, offset);
            break;
          case 'double':
            buffer.writeDoubleLE(Number(val) || 0.0, offset);
            break;
          case 'char':
          case 'string':
          case 'json':
          case 'media_path': {
            const strVal = String(val !== undefined && val !== null ? val : '');
            const strBuffer = Buffer.from(strVal, 'utf8');
            // Rellenar con ceros
            buffer.fill(0, offset, offset + field.byteSize);
            strBuffer.copy(buffer, offset, 0, Math.min(strBuffer.length, field.byteSize - 1));
            break;
          }
          case 'blob': {
            const hexStr = String(val || '').replace(/[^0-9a-fA-F]/g, '');
            const hexBuf = Buffer.from(hexStr, 'hex');
            buffer.fill(0, offset, offset + field.byteSize);
            hexBuf.copy(buffer, offset, 0, Math.min(hexBuf.length, field.byteSize));
            break;
          }
        }
      } catch (err) {
        console.error(`Error encoding field ${field.name}:`, err);
      }
    }

    return buffer;
  }

  /**
   * Lee los buffers binarios crudos de los slots activos de una tabla
   */
  public static readRawBuffers(filePath: string, maxSamples = 30): Buffer[] {
    const header = this.readTableHeader(filePath);
    const slotTotalSize = SLOT_HEADER_SIZE + header.recordSize;
    const stats = fs.statSync(filePath);
    const fd = fs.openSync(filePath, 'r');
    const buffers: Buffer[] = [];

    for (let slotIndex = 0; slotIndex < header.totalSlots && buffers.length < maxSamples; slotIndex++) {
      const slotOffset = header.dataStartOffset + (slotIndex * slotTotalSize);
      if (slotOffset + slotTotalSize > stats.size) break;

      const slotBuffer = Buffer.alloc(slotTotalSize);
      fs.readSync(fd, slotBuffer, 0, slotTotalSize, slotOffset);
      const status = slotBuffer.readUInt8(0);
      if (status === RecordStatus.RECORD_ACTIVE) {
        buffers.push(slotBuffer.subarray(SLOT_HEADER_SIZE, slotTotalSize));
      }
    }
    fs.closeSync(fd);
    return buffers;
  }

  /**
   * Genera un esquema por defecto o auto-inferido
   */
  public static generateDefaultSchema(header: TableHeaderData, tableName: string, sampleBuffers?: Buffer[]): TableSchema {
    if (sampleBuffers && sampleBuffers.length > 0) {
      return SchemaParser.inferSchemaFromBuffers(header.recordSize, sampleBuffers, tableName);
    }
    return SchemaParser.inferSchemaFromBuffers(header.recordSize, [], tableName);
  }

  /**
   * Lee todos los registros y slots de un archivo .tbl
   */
  public static readAllSlots(filePath: string, schema?: TableSchema): { header: TableHeaderData; records: DecodedRecord[] } {
    const header = this.readTableHeader(filePath);
    const ext = path.extname(filePath);
    const tableName = path.basename(filePath, ext);

    let activeSchema = schema;
    if (!activeSchema) {
      const sampleBuffers = this.readRawBuffers(filePath);
      activeSchema = this.generateDefaultSchema(header, tableName, sampleBuffers);
    }

    const slotTotalSize = SLOT_HEADER_SIZE + header.recordSize;
    const records: DecodedRecord[] = [];

    const stats = fs.statSync(filePath);
    const fd = fs.openSync(filePath, 'r');

    for (let slotIndex = 0; slotIndex < header.totalSlots; slotIndex++) {
      const slotOffset = header.dataStartOffset + (slotIndex * slotTotalSize);
      if (slotOffset + slotTotalSize > stats.size) break;

      const slotBuffer = Buffer.alloc(slotTotalSize);
      fs.readSync(fd, slotBuffer, 0, slotTotalSize, slotOffset);

      const status = slotBuffer.readUInt8(0) as RecordStatus;
      const recordId = slotBuffer.readUInt32LE(1);
      const nextFreeSlot = slotBuffer.readUInt32LE(5);
      const payloadBuffer = slotBuffer.subarray(SLOT_HEADER_SIZE, slotTotalSize);

      const decoded = this.decodePayload(payloadBuffer, activeSchema);

      records.push({
        _slotIndex: slotIndex,
        _status: status,
        _recordId: recordId,
        _nextFreeSlot: nextFreeSlot,
        _rawHex: payloadBuffer.toString('hex').toUpperCase(),
        ...decoded
      });
    }

    fs.closeSync(fd);
    return { header, records };
  }

  /**
   * Inserta un nuevo registro en el archivo .tbl (O(1) con reciclaje de Free-List)
   */
  public static insertRecord(filePath: string, recordData: Record<string, any>, schema: TableSchema): number {
    const header = this.readTableHeader(filePath);
    const slotTotalSize = SLOT_HEADER_SIZE + header.recordSize;

    let targetSlot = MICRODB_NULL_OFFSET;
    const assignedId = header.nextAutoId;
    header.nextAutoId++;

    const fd = fs.openSync(filePath, 'r+');

    if (header.firstFreeSlot !== MICRODB_NULL_OFFSET) {
      // Reutilizar slot borrado
      targetSlot = header.firstFreeSlot;
      const slotOffset = header.dataStartOffset + (targetSlot * slotTotalSize);
      const oldSlotBuf = Buffer.alloc(SLOT_HEADER_SIZE);
      fs.readSync(fd, oldSlotBuf, 0, SLOT_HEADER_SIZE, slotOffset);

      header.firstFreeSlot = oldSlotBuf.readUInt32LE(5);
      header.deletedRecords = Math.max(0, header.deletedRecords - 1);
    } else {
      // Asignar nuevo slot al final
      targetSlot = header.totalSlots;
      header.totalSlots++;
    }

    // Escribir slot
    const slotOffset = header.dataStartOffset + (targetSlot * slotTotalSize);
    const slotHeaderBuf = Buffer.alloc(SLOT_HEADER_SIZE);
    slotHeaderBuf.writeUInt8(RecordStatus.RECORD_ACTIVE, 0);
    slotHeaderBuf.writeUInt32LE(assignedId, 1);
    slotHeaderBuf.writeUInt32LE(MICRODB_NULL_OFFSET, 5);

    const payloadBuf = this.encodePayload(recordData, schema);

    fs.writeSync(fd, slotHeaderBuf, 0, SLOT_HEADER_SIZE, slotOffset);
    fs.writeSync(fd, payloadBuf, 0, schema.recordSize, slotOffset + SLOT_HEADER_SIZE);

    header.activeRecords++;

    // Actualizar cabecera
    const headerBuf = Buffer.alloc(TABLE_HEADER_SIZE);
    headerBuf.writeUInt32LE(header.magic, 0);
    headerBuf.writeUInt16LE(header.version, 4);
    headerBuf.writeUInt16LE(header.recordSize, 6);
    headerBuf.writeUInt32LE(header.totalSlots, 8);
    headerBuf.writeUInt32LE(header.activeRecords, 12);
    headerBuf.writeUInt32LE(header.deletedRecords, 16);
    headerBuf.writeUInt32LE(header.firstFreeSlot, 20);
    headerBuf.writeUInt32LE(header.nextAutoId, 24);
    headerBuf.writeUInt32LE(header.dataStartOffset, 28);
    if (header.reserved && header.reserved.length === 32) {
      header.reserved.copy(headerBuf, 32);
    }

    fs.writeSync(fd, headerBuf, 0, TABLE_HEADER_SIZE, 0);
    fs.closeSync(fd);

    return assignedId;
  }

  /**
   * Actualiza un registro existente in-place por su slotIndex o recordId
   */
  public static updateRecord(filePath: string, slotIndex: number, recordData: Record<string, any>, schema: TableSchema): boolean {
    const header = this.readTableHeader(filePath);
    if (slotIndex >= header.totalSlots) return false;

    const slotTotalSize = SLOT_HEADER_SIZE + header.recordSize;
    const payloadOffset = header.dataStartOffset + (slotIndex * slotTotalSize) + SLOT_HEADER_SIZE;

    const payloadBuf = this.encodePayload(recordData, schema);
    const fd = fs.openSync(filePath, 'r+');
    fs.writeSync(fd, payloadBuf, 0, schema.recordSize, payloadOffset);
    fs.closeSync(fd);

    return true;
  }

  /**
   * Elimina lógicamente un registro (Tombstone O(1)) y lo encola en la Free-List
   */
  public static deleteRecord(filePath: string, slotIndex: number): boolean {
    const header = this.readTableHeader(filePath);
    if (slotIndex >= header.totalSlots) return false;

    const slotTotalSize = SLOT_HEADER_SIZE + header.recordSize;
    const slotOffset = header.dataStartOffset + (slotIndex * slotTotalSize);

    const fd = fs.openSync(filePath, 'r+');

    // Leer el slot actual para verificar si ya estaba borrado
    const slotBuf = Buffer.alloc(SLOT_HEADER_SIZE);
    fs.readSync(fd, slotBuf, 0, SLOT_HEADER_SIZE, slotOffset);
    const currentStatus = slotBuf.readUInt8(0);

    if (currentStatus === RecordStatus.RECORD_DELETED) {
      fs.closeSync(fd);
      return false; // Ya estaba borrado
    }

    // Marcar como borrado y apuntar al actual firstFreeSlot
    const newSlotHeader = Buffer.alloc(SLOT_HEADER_SIZE);
    newSlotHeader.writeUInt8(RecordStatus.RECORD_DELETED, 0);
    newSlotHeader.writeUInt32LE(0, 1);
    newSlotHeader.writeUInt32LE(header.firstFreeSlot, 5);

    fs.writeSync(fd, newSlotHeader, 0, SLOT_HEADER_SIZE, slotOffset);

    // Actualizar cabecera
    header.firstFreeSlot = slotIndex;
    header.activeRecords = Math.max(0, header.activeRecords - 1);
    header.deletedRecords++;

    const headerBuf = Buffer.alloc(TABLE_HEADER_SIZE);
    headerBuf.writeUInt32LE(header.magic, 0);
    headerBuf.writeUInt16LE(header.version, 4);
    headerBuf.writeUInt16LE(header.recordSize, 6);
    headerBuf.writeUInt32LE(header.totalSlots, 8);
    headerBuf.writeUInt32LE(header.activeRecords, 12);
    headerBuf.writeUInt32LE(header.deletedRecords, 16);
    headerBuf.writeUInt32LE(header.firstFreeSlot, 20);
    headerBuf.writeUInt32LE(header.nextAutoId, 24);
    headerBuf.writeUInt32LE(header.dataStartOffset, 28);
    if (header.reserved && header.reserved.length === 32) {
      header.reserved.copy(headerBuf, 32);
    }

    fs.writeSync(fd, headerBuf, 0, TABLE_HEADER_SIZE, 0);
    fs.closeSync(fd);

    return true;
  }

  /**
   * Crea una nueva tabla vacía .tbl
   */
  public static createTable(filePath: string, recordSize: number): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const header: TableHeaderData = {
      magic: MICRODB_MAGIC_TABLE,
      version: 1,
      recordSize,
      totalSlots: 0,
      activeRecords: 0,
      deletedRecords: 0,
      firstFreeSlot: MICRODB_NULL_OFFSET,
      nextAutoId: 1,
      dataStartOffset: TABLE_HEADER_SIZE,
      reserved: Buffer.alloc(32, 0)
    };

    const buffer = Buffer.alloc(TABLE_HEADER_SIZE);
    buffer.writeUInt32LE(header.magic, 0);
    buffer.writeUInt16LE(header.version, 4);
    buffer.writeUInt16LE(header.recordSize, 6);
    buffer.writeUInt32LE(header.totalSlots, 8);
    buffer.writeUInt32LE(header.activeRecords, 12);
    buffer.writeUInt32LE(header.deletedRecords, 16);
    buffer.writeUInt32LE(header.firstFreeSlot, 20);
    buffer.writeUInt32LE(header.nextAutoId, 24);
    buffer.writeUInt32LE(header.dataStartOffset, 28);

    fs.writeFileSync(filePath, buffer);
  }

  /**
   * Lee la cabecera de un archivo de índice .idx
   */
  public static readIndex(indexPath: string): { header: IndexHeaderData; entries: IndexEntryData[] } {
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Índice no encontrado: ${indexPath}`);
    }

    const stats = fs.statSync(indexPath);
    const fd = fs.openSync(indexPath, 'r');

    const headerBuf = Buffer.alloc(INDEX_HEADER_SIZE);
    fs.readSync(fd, headerBuf, 0, INDEX_HEADER_SIZE, 0);

    const magic = headerBuf.readUInt32LE(0);
    if (magic !== MICRODB_MAGIC_INDEX) {
      fs.closeSync(fd);
      throw new Error(`Magic number de índice no coincide: 0x${magic.toString(16)}`);
    }

    const header: IndexHeaderData = {
      magic,
      version: headerBuf.readUInt16LE(4),
      entrySize: headerBuf.readUInt16LE(6),
      totalEntries: headerBuf.readUInt32LE(8),
      isSorted: headerBuf.readUInt32LE(12),
      reserved: headerBuf.subarray(16, 32)
    };

    const entries: IndexEntryData[] = [];
    for (let i = 0; i < header.totalEntries; i++) {
      const offset = INDEX_HEADER_SIZE + (i * INDEX_ENTRY_SIZE);
      if (offset + INDEX_ENTRY_SIZE > stats.size) break;

      const entryBuf = Buffer.alloc(INDEX_ENTRY_SIZE);
      fs.readSync(fd, entryBuf, 0, INDEX_ENTRY_SIZE, offset);

      entries.push({
        keyHash: entryBuf.readUInt32LE(0),
        recordId: entryBuf.readUInt32LE(4),
        slotIndex: entryBuf.readUInt32LE(8)
      });
    }

    fs.closeSync(fd);
    return { header, entries };
  }
}
