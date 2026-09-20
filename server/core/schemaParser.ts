// ============================================================================
// MICRODB STUDIO - PARSER DE STRUCTS C++ Y GESTOR DE ESQUEMAS
// ============================================================================

import { FieldSchema, SupportedFieldType, TableSchema } from './microdbTypes.js';

export class SchemaParser {
  /**
   * Mapea tipos de C++ a tipos soportados por MicroDB y su tamaño en bytes
   */
  public static getTypeInfo(rawType: string): { type: SupportedFieldType; baseSize: number } {
    const clean = rawType.trim().toLowerCase();

    if (clean === 'bool' || clean === 'boolean') {
      return { type: 'bool', baseSize: 1 };
    }
    if (clean === 'int8_t' || clean === 'int8' || clean === 'signed char') {
      return { type: 'int8', baseSize: 1 };
    }
    if (clean === 'uint8_t' || clean === 'uint8' || clean === 'byte' || clean === 'unsigned char') {
      return { type: 'uint8', baseSize: 1 };
    }
    if (clean === 'int16_t' || clean === 'int16' || clean === 'short' || clean === 'signed short') {
      return { type: 'int16', baseSize: 2 };
    }
    if (clean === 'uint16_t' || clean === 'uint16' || clean === 'unsigned short') {
      return { type: 'uint16', baseSize: 2 };
    }
    if (clean === 'int32_t' || clean === 'int32' || clean === 'int' || clean === 'long' || clean === 'signed int' || clean === 'signed long') {
      return { type: 'int32', baseSize: 4 };
    }
    if (clean === 'uint32_t' || clean === 'uint32' || clean === 'unsigned int' || clean === 'unsigned long') {
      return { type: 'uint32', baseSize: 4 };
    }
    if (clean === 'int64_t' || clean === 'int64' || clean === 'long long') {
      return { type: 'int64', baseSize: 8 };
    }
    if (clean === 'uint64_t' || clean === 'uint64' || clean === 'unsigned long long') {
      return { type: 'uint64', baseSize: 8 };
    }
    if (clean === 'float') {
      return { type: 'float', baseSize: 4 };
    }
    if (clean === 'double') {
      return { type: 'double', baseSize: 8 };
    }
    if (clean === 'char' || clean === 'char*') {
      return { type: 'char', baseSize: 1 };
    }

    // Default fallback
    return { type: 'uint8', baseSize: 1 };
  }

  /**
   * Analiza una definición C++ struct y genera el TableSchema exacto con offsets
   */
  public static parseCppStruct(cCode: string, tableName = 'unnamed'): TableSchema {
    const fields: FieldSchema[] = [];
    
    // Limpiar comentarios multilínea y de una línea
    const cleanCode = cCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    // Detectar si el struct tiene nombre
    const structMatch = cleanCode.match(/struct\s+([A-Za-z0-9_]+)\s*\{/i);
    const resolvedTableName = structMatch ? structMatch[1] : tableName;

    // Extraer el contenido entre llaves { ... }
    const bodyMatch = cleanCode.match(/\{([\s\S]*?)\}/);
    const body = bodyMatch ? bodyMatch[1] : cleanCode;

    // Dividir por declaraciones separadas por ';'
    const statements = body.split(';');

    let currentOffset = 0;

    for (const rawStmt of statements) {
      const stmt = rawStmt.trim();
      if (!stmt) continue;

      // Ejemplo: "char nodeName[16]" o "uint32_t epochTimestamp" o "bool isActive, isAlarm"
      const fieldRegex = /^(?:const\s+)?([A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)?)\s+([A-Za-z0-9_]+)(?:\s*\[\s*([0-9]+)\s*\])?/i;
      const match = stmt.match(fieldRegex);

      if (match) {
        const rawType = match[1].trim();
        const fieldName = match[2].trim();
        const arrayLen = match[3] ? Number.parseInt(match[3], 10) : undefined;

        const { type, baseSize } = this.getTypeInfo(rawType);

        let finalType = type;
        let totalByteSize = baseSize;

        if (arrayLen && arrayLen > 0) {
          totalByteSize = baseSize * arrayLen;
          if (type === 'char') {
            if (fieldName.toLowerCase().includes('json')) {
              finalType = 'json';
            } else if (fieldName.toLowerCase().includes('file') || fieldName.toLowerCase().includes('path') || fieldName.toLowerCase().includes('img') || fieldName.toLowerCase().includes('media')) {
              finalType = 'media_path';
            } else {
              finalType = 'string';
            }
          } else if (type === 'uint8' || type === 'int8') {
            finalType = 'blob';
          }
        }

        fields.push({
          name: fieldName,
          type: finalType,
          arrayLength: arrayLen,
          byteSize: totalByteSize,
          offset: currentOffset,
          description: `Tipo C++: ${rawType}${arrayLen ? `[${arrayLen}]` : ''}`
        });

        currentOffset += totalByteSize;
      }
    }

    return {
      tableName: resolvedTableName,
      recordSize: currentOffset,
      fields,
      cStructDef: cCode
    };
  }

  /**
   * Recalcula offsets y tamaño total para una lista de campos
   */
  public static calculateLayout(fields: FieldSchema[]): { fields: FieldSchema[]; totalSize: number } {
    let offset = 0;
    const computedFields = fields.map(f => {
      let byteSize = f.byteSize;
      if (!byteSize || byteSize <= 0) {
        const info = this.getTypeInfo(f.type);
        byteSize = (f.arrayLength && f.arrayLength > 0) ? info.baseSize * f.arrayLength : info.baseSize;
      }
      const fieldWithOffset = { ...f, offset, byteSize };
      offset += byteSize;
      return fieldWithOffset;
    });

    return { fields: computedFields, totalSize: offset };
  }

  /**
   * 🪄 Auto-Inferencia heurística inteligente a partir de los bytes reales de los registros
   */
  public static inferSchemaFromBuffers(recordSize: number, sampleBuffers: Buffer[], tableName: string): TableSchema {
    const fields: FieldSchema[] = [];
    let offset = 0;
    let fieldCount = 1;

    while (offset < recordSize) {
      const remaining = recordSize - offset;

      // 1. Probar si hay una cadena de texto típica (ej: 64, 32, 24, 20, 16, 12, 8 bytes)
      let foundString = false;
      const candidateStringSizes = [64, 32, 24, 20, 16, 12, 8].filter(s => s <= remaining);

      for (const strSize of candidateStringSizes) {
        let isAllAscii = true;
        let hasPrintableChars = false;

        for (const buf of sampleBuffers) {
          if (offset + strSize > buf.length) continue;
          const slice = buf.subarray(offset, offset + strSize);
          
          let nullFound = false;
          for (let i = 0; i < slice.length; i++) {
            const b = slice[i];
            if (b === 0) {
              nullFound = true;
            } else if (nullFound) {
              // Después de un \0 en C-string suele haber ceros o basura
            } else if (b >= 32 && b <= 126) {
              hasPrintableChars = true;
            } else if (b === 9 || b === 10 || b === 13) {
              // whitespace
            } else {
              isAllAscii = false;
              break;
            }
          }
          if (!isAllAscii) break;
        }

        if (isAllAscii && hasPrintableChars) {
          const fieldName = `texto_${offset}_${strSize}`;
          fields.push({
            name: fieldName,
            type: 'string',
            arrayLength: strSize,
            byteSize: strSize,
            offset,
            description: `char ${fieldName}[${strSize}] (Auto-detectado)`
          });
          offset += strSize;
          foundString = true;
          fieldCount++;
          break;
        }
      }

      if (foundString) continue;

      // 2. Probar si es booleano (1 byte con valores 0 o 1)
      if (remaining === 1 || (sampleBuffers.length > 0 && sampleBuffers.every(b => offset < b.length && (b[offset] === 0 || b[offset] === 1)))) {
        const fieldName = remaining === 1 ? 'estado_activo' : `flag_${fieldCount}`;
        fields.push({
          name: fieldName,
          type: 'bool',
          byteSize: 1,
          offset,
          description: `bool (Auto-detectado)`
        });
        offset += 1;
        fieldCount++;
        continue;
      }

      // 3. Probar si son 4 bytes (Entero uint32 / float)
      if (remaining >= 4) {
        const fieldName = `valor_${fieldCount}`;
        fields.push({
          name: fieldName,
          type: 'uint32',
          byteSize: 4,
          offset,
          description: `uint32_t (Auto-detectado)`
        });
        offset += 4;
        fieldCount++;
        continue;
      }

      // 4. Si quedan menos de 4 bytes
      if (remaining === 2) {
        fields.push({
          name: `val16_${fieldCount}`,
          type: 'uint16',
          byteSize: 2,
          offset,
          description: `uint16_t`
        });
        offset += 2;
        fieldCount++;
      } else {
        fields.push({
          name: `byte_${fieldCount}`,
          type: 'uint8',
          byteSize: 1,
          offset,
          description: `uint8_t`
        });
        offset += 1;
        fieldCount++;
      }
    }

    // Generar código C++ representativo
    const structLines = fields.map(f => {
      if (f.type === 'string') return `  char     ${f.name}[${f.byteSize}];`;
      if (f.type === 'bool') return `  bool     ${f.name};`;
      if (f.type === 'float') return `  float    ${f.name};`;
      if (f.type === 'uint32') return `  uint32_t ${f.name};`;
      if (f.type === 'uint16') return `  uint16_t ${f.name};`;
      return `  uint8_t  ${f.name};`;
    });

    const cStructDef = `struct ${tableName} {\n${structLines.join('\n')}\n};`;

    return {
      tableName,
      recordSize,
      fields,
      cStructDef
    };
  }

  /**
   * Convierte un archivo de catálogo exportado por Arduino MicroDB (.json o .jsn)
   * generado por TableSchema::exportJsonSchema() a TableSchema de MicroDB Studio
   */
  public static parseArduinoJsonSchema(jsonObj: any): TableSchema | null {
    if (!jsonObj || !jsonObj.table || !Array.isArray(jsonObj.columns)) {
      return null;
    }

    const tableName = jsonObj.table;
    const fields: FieldSchema[] = [];
    let calculatedRecordSize = 0;

    for (const col of jsonObj.columns) {
      const colName = col.name;
      const typeStr = String(col.type || '').toUpperCase();
      const length = Number(col.length) || 1;
      const offset = Number(col.offset) || 0;
      const isUnique = !!col.isUnique;
      const isForeignKey = !!(col.isForeignKey || col.references);
      const referencesTable = isForeignKey ? (col.referencesTable || (col.references && col.references.table)) : undefined;
      const referencesField = isForeignKey ? (col.referencesField || (col.references && col.references.column) || 'id') : undefined;

      let fieldType: SupportedFieldType = 'uint8';
      let arrayLen: number | undefined;

      const lowerName = colName.toLowerCase();
      const isLikelyBool =
        typeStr === 'BOOL' ||
        typeStr === 'BOOLEAN' ||
        (length === 1 &&
          (lowerName.startsWith('is') ||
            lowerName.startsWith('has') ||
            lowerName.startsWith('activo') ||
            lowerName.startsWith('active') ||
            lowerName.includes('alert') ||
            lowerName.includes('flag') ||
            lowerName.includes('enable')));

      if (isLikelyBool) {
        fieldType = 'bool';
      } else {
        switch (typeStr) {
          case 'BOOL':
          case 'BOOLEAN':
            fieldType = 'bool';
            break;
          case 'UINT8':
            fieldType = 'uint8';
            break;
          case 'INT8':
            fieldType = 'int8';
            break;
          case 'INT16':
            fieldType = 'int16';
            break;
          case 'UINT16':
            fieldType = 'uint16';
            break;
          case 'INT32':
            fieldType = 'int32';
            break;
          case 'UINT32':
            fieldType = 'uint32';
            break;
          case 'FLOAT':
            fieldType = 'float';
            break;
          case 'DOUBLE':
            fieldType = 'double';
            break;
          case 'STRING':
            fieldType = 'string';
            arrayLen = length;
            break;
          default:
            fieldType = 'uint8';
            break;
        }
      }

      fields.push({
        name: colName,
        type: fieldType,
        byteSize: length,
        offset: offset,
        arrayLength: arrayLen,
        isUnique,
        isForeignKey,
        referencesTable,
        referencesField,
        description: `Exportado desde Arduino MicroDB (${typeStr})`
      });

      if (offset + length > calculatedRecordSize) {
        calculatedRecordSize = offset + length;
      }
    }

    return {
      tableName,
      recordSize: calculatedRecordSize,
      fields
    };
  }

  /**
   * Genera el formato JSON exacto de catálogo para Arduino MicroDB (.jsn)
   */
  public static toArduinoJsonSchema(schema: TableSchema): Record<string, any> {
    const columns = schema.fields.map((f) => {
      let typeStr = 'UINT8';
      let typeId = 0;

      switch (f.type) {
        case 'bool':
          typeStr = 'BOOL';
          typeId = 8;
          break;
        case 'uint8':
        case 'int8':
          typeStr = 'UINT8';
          typeId = 0;
          break;
        case 'int16':
          typeStr = 'INT16';
          typeId = 1;
          break;
        case 'uint16':
          typeStr = 'UINT16';
          typeId = 2;
          break;
        case 'int32':
          typeStr = 'INT32';
          typeId = 3;
          break;
        case 'uint32':
          typeStr = 'UINT32';
          typeId = 4;
          break;
        case 'float':
          typeStr = 'FLOAT';
          typeId = 5;
          break;
        case 'double':
          typeStr = 'DOUBLE';
          typeId = 6;
          break;
        case 'string':
        case 'json':
        case 'media_path':
          typeStr = 'STRING';
          typeId = 7;
          break;
        default:
          typeStr = 'UINT8';
          typeId = 0;
          break;
      }

      const colObj: Record<string, any> = {
        name: f.name,
        type: typeStr,
        typeId,
        offset: f.offset,
        length: f.byteSize
      };

      if (f.isUnique) {
        colObj.isUnique = true;
      }

      if (f.isForeignKey && f.referencesTable) {
        colObj.isForeignKey = true;
        colObj.references = {
          table: f.referencesTable,
          column: f.referencesField || 'id'
        };
      }

      return colObj;
    });

    return {
      table: schema.tableName,
      columnCount: columns.length,
      columns
    };
  }

  /**
   * Lee un archivo de esquema binario .sch generado por TableSchema::saveBinarySchema()
   */
  public static parseArduinoBinarySchema(buffer: Buffer, tableName: string): TableSchema | null {
    if (buffer.length < 1) return null;
    const columnCount = buffer.readUInt8(0);
    const fields: FieldSchema[] = [];
    let calculatedRecordSize = 0;
    let offset = 1;

    // Cada ColumnMetadata: name(16) + type(1) + offset(2) + length(2) = 21 o 22 bytes
    const entrySize = 21;

    for (let i = 0; i < columnCount && offset + entrySize <= buffer.length; i++) {
      const nameRaw = buffer.toString('utf8', offset, offset + 16);
      const nullIdx = nameRaw.indexOf('\0');
      const name = nullIdx !== -1 ? nameRaw.substring(0, nullIdx) : nameRaw.trim();

      const typeId = buffer.readUInt8(offset + 16);
      const colOffset = buffer.readUInt16LE(offset + 17);
      const colLength = buffer.readUInt16LE(offset + 19);

      let fieldType: SupportedFieldType = 'uint8';
      let arrayLen: number | undefined;

      switch (typeId) {
        case 0: // TYPE_UINT8
          fieldType = 'uint8';
          break;
        case 1: // TYPE_INT16
          fieldType = 'int16';
          break;
        case 2: // TYPE_UINT16
          fieldType = 'uint16';
          break;
        case 3: // TYPE_INT32
          fieldType = 'int32';
          break;
        case 4: // TYPE_UINT32
          fieldType = 'uint32';
          break;
        case 5: // TYPE_FLOAT
          fieldType = 'float';
          break;
        case 6: // TYPE_DOUBLE
          fieldType = 'double';
          break;
        case 7: // TYPE_STRING
          fieldType = 'string';
          arrayLen = colLength;
          break;
        default:
          fieldType = 'uint8';
          break;
      }

      fields.push({
        name,
        type: fieldType,
        byteSize: colLength,
        offset: colOffset,
        arrayLength: arrayLen,
        description: `Esquema binario .sch desde Arduino`
      });

      if (colOffset + colLength > calculatedRecordSize) {
        calculatedRecordSize = colOffset + colLength;
      }

      offset += entrySize;
    }

    return {
      tableName,
      recordSize: calculatedRecordSize,
      fields
    };
  }
}
