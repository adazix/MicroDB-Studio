// ============================================================================
// MICRODB STUDIO - VACUUM / DESFRAGMENTADOR DE TABLAS E ÍNDICES
// Elimina slots marcados como borrados (Tombstones), compacta el archivo .tbl
// y regenera los índices secundarios .idx correspondientes.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { MicroDBEngine } from './binaryEngine.js';
import {
  TableSchema,
  RecordStatus,
  MICRODB_NULL_OFFSET,
  SLOT_HEADER_SIZE,
  INDEX_HEADER_SIZE,
  INDEX_ENTRY_SIZE
} from './microdbTypes.js';

export class TableDefragmenter {
  /**
   * Compacta y desfragmenta una tabla .tbl en disco
   */
  public static vacuumTable(filePath: string, schema: TableSchema): { reclaimedBytes: number; initialSlots: number; finalSlots: number } {
    const { header, records } = MicroDBEngine.readAllSlots(filePath, schema);
    const initialSlots = header.totalSlots;
    const activeRecords = records.filter(r => r._status === RecordStatus.RECORD_ACTIVE);

    const tempFilePath = `${filePath}.tmp_vacuum`;

    // Crear tabla limpia temporal
    MicroDBEngine.createTable(tempFilePath, header.recordSize);

    // Insertar registros activos preservando sus IDs originales
    const newHeader = MicroDBEngine.readTableHeader(tempFilePath);
    newHeader.nextAutoId = header.nextAutoId;

    const fd = fs.openSync(tempFilePath, 'r+');
    const slotTotalSize = SLOT_HEADER_SIZE + header.recordSize;

    for (let i = 0; i < activeRecords.length; i++) {
      const rec = activeRecords[i];
      const slotOffset = newHeader.dataStartOffset + (i * slotTotalSize);

      const slotHeaderBuf = Buffer.alloc(SLOT_HEADER_SIZE);
      slotHeaderBuf.writeUInt8(RecordStatus.RECORD_ACTIVE, 0);
      slotHeaderBuf.writeUInt32LE(rec._recordId, 1);
      slotHeaderBuf.writeUInt32LE(MICRODB_NULL_OFFSET, 5);

      const payloadBuf = rec._rawHex
        ? Buffer.from(rec._rawHex, 'hex')
        : MicroDBEngine.encodePayload(rec, schema);

      fs.writeSync(fd, slotHeaderBuf, 0, SLOT_HEADER_SIZE, slotOffset);
      fs.writeSync(fd, payloadBuf, 0, header.recordSize, slotOffset + SLOT_HEADER_SIZE);
    }

    newHeader.totalSlots = activeRecords.length;
    newHeader.activeRecords = activeRecords.length;
    newHeader.deletedRecords = 0;
    newHeader.firstFreeSlot = MICRODB_NULL_OFFSET;

    fs.closeSync(fd);
    MicroDBEngine.writeTableHeader(tempFilePath, newHeader);

    // Reemplazar el archivo original
    const initialSize = fs.statSync(filePath).size;
    fs.unlinkSync(filePath);
    fs.renameSync(tempFilePath, filePath);
    const finalSize = fs.statSync(filePath).size;

    // Reconstruir índices secundarios (.idx) si existen
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    const possibleIdx = [
      path.join(dir, `${baseName}.idx`),
      path.join(dir, `${baseName}.IDX`),
      path.join(dir, `${baseName.toUpperCase()}.IDX`),
      path.join(dir, `${baseName.toLowerCase()}.idx`)
    ];

    const recordIdToNewSlot = new Map<number, number>();
    activeRecords.forEach((rec, idx) => {
      recordIdToNewSlot.set(rec._recordId, idx);
    });

    for (const idxPath of possibleIdx) {
      if (fs.existsSync(idxPath)) {
        try {
          const { header: idxHeader, entries } = MicroDBEngine.readIndex(idxPath);
          const newEntries: typeof entries = [];

          for (const entry of entries) {
            if (recordIdToNewSlot.has(entry.recordId)) {
              newEntries.push({
                keyHash: entry.keyHash,
                recordId: entry.recordId,
                slotIndex: recordIdToNewSlot.get(entry.recordId)!
              });
            }
          }

          const idxFd = fs.openSync(idxPath, 'w');
          const idxHeaderBuf = Buffer.alloc(INDEX_HEADER_SIZE);
          idxHeaderBuf.writeUInt32LE(idxHeader.magic, 0);
          idxHeaderBuf.writeUInt16LE(idxHeader.version, 4);
          idxHeaderBuf.writeUInt16LE(idxHeader.entrySize, 6);
          idxHeaderBuf.writeUInt32LE(newEntries.length, 8);
          idxHeaderBuf.writeUInt32LE(idxHeader.isSorted, 12);
          idxHeader.reserved.copy(idxHeaderBuf, 16);
          fs.writeSync(idxFd, idxHeaderBuf, 0, INDEX_HEADER_SIZE, 0);

          for (let i = 0; i < newEntries.length; i++) {
            const e = newEntries[i];
            const eBuf = Buffer.alloc(INDEX_ENTRY_SIZE);
            eBuf.writeUInt32LE(e.keyHash, 0);
            eBuf.writeUInt32LE(e.recordId, 4);
            eBuf.writeUInt32LE(e.slotIndex, 8);
            fs.writeSync(idxFd, eBuf, 0, INDEX_ENTRY_SIZE, INDEX_HEADER_SIZE + (i * INDEX_ENTRY_SIZE));
          }
          fs.closeSync(idxFd);
        } catch (e) {
          console.warn(`[Vacuum] Advertencia al actualizar índice secundario ${idxPath}:`, e);
        }
      }
    }

    return {
      reclaimedBytes: Math.max(0, initialSize - finalSize),
      initialSlots,
      finalSlots: activeRecords.length
    };
  }
}
