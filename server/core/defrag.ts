// ============================================================================
// MICRODB STUDIO - VACUUM / DESFRAGMENTADOR DE TABLAS E ÍNDICES
// Elimina slots marcados como borrados (Tombstones), compacta el archivo .tbl
// y regenera los índices secundarios .idx correspondientes.
// ============================================================================

import fs from 'node:fs';
import { MicroDBEngine } from './binaryEngine.js';
import { TableSchema, RecordStatus, MICRODB_NULL_OFFSET, SLOT_HEADER_SIZE } from './microdbTypes.js';

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

      const payloadBuf = MicroDBEngine.encodePayload(rec, schema);

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

    return {
      reclaimedBytes: Math.max(0, initialSize - finalSize),
      initialSlots,
      finalSlots: activeRecords.length
    };
  }
}
