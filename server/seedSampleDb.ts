// ============================================================================
// MICRODB STUDIO - SEEDER DE BASE DE DATOS DE EJEMPLO
// Genera tablas binarias reales (.tbl) con todos los tipos de datos de MicroDB
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { MicroDBEngine } from './core/binaryEngine.js';
import { SchemaParser } from './core/schemaParser.js';
import { TableSchema } from './core/microdbTypes.js';

const SAMPLE_DIR = path.join(process.cwd(), 'sample_db');
if (!fs.existsSync(SAMPLE_DIR)) {
  fs.mkdirSync(SAMPLE_DIR, { recursive: true });
}

console.log(`Generando base de datos de prueba en: ${SAMPLE_DIR}`);

// 1. Tabla 'alldata' (AllDataTypesDemo.ino)
const allDataCpp = `
struct MasterRecord {
  bool     isActive;
  bool     isAlarmTriggered;
  int8_t   tempCalibration;
  uint8_t  batteryPercent;
  int16_t  altitudeMeters;
  uint16_t rawAdcValue;
  int32_t  systemErrorCode;
  uint32_t sampleCounter;
  uint32_t epochTimestamp;
  float    sensorVoltage;
  double   gpsLatitude;
  double   gpsLongitude;
  char     nodeName[16];
  char     hardwareVersion[8];
  uint8_t  rfidCardUid[7];
  uint8_t  aesEncryptionKey[16];
  char     jsonConfig[64];
  char     mediaFilePath[24];
};
`;

const allDataSchema = SchemaParser.parseCppStruct(allDataCpp, 'alldata');
const allDataTblPath = path.join(SAMPLE_DIR, 'alldata.tbl');

MicroDBEngine.createTable(allDataTblPath, allDataSchema.recordSize);
fs.writeFileSync(path.join(SAMPLE_DIR, 'alldata.schema.json'), JSON.stringify(allDataSchema, null, 2));

// Insertar registros de prueba
const sampleRecords = [
  {
    isActive: true,
    isAlarmTriggered: false,
    tempCalibration: -3,
    batteryPercent: 95,
    altitudeMeters: 2600,
    rawAdcValue: 1023,
    systemErrorCode: 0,
    sampleCounter: 5001,
    epochTimestamp: 1774182000,
    sensorVoltage: 3.31,
    gpsLatitude: 4.710989,
    gpsLongitude: -74.072092,
    nodeName: 'ESTACION_BOGOTA',
    hardwareVersion: 'v1.4',
    rfidCardUid: '048A5C127E3390',
    aesEncryptionKey: '0102030405060708090A0B0C0D0E0F10',
    jsonConfig: '{"mode":"AUTO","relay1":true,"target":22.5}',
    mediaFilePath: 'DCIM/FOTO_001.JPG'
  },
  {
    isActive: true,
    isAlarmTriggered: true,
    tempCalibration: 2,
    batteryPercent: 42,
    altitudeMeters: 1540,
    rawAdcValue: 850,
    systemErrorCode: 104,
    sampleCounter: 5002,
    epochTimestamp: 1774182060,
    sensorVoltage: 3.12,
    gpsLatitude: 6.244203,
    gpsLongitude: -75.581211,
    nodeName: 'NODO_MEDELLIN',
    hardwareVersion: 'v1.4',
    rfidCardUid: '1A2B3C4D5E6F70',
    aesEncryptionKey: 'A1B2C3D4E5F60708090A0B0C0D0E0F10',
    jsonConfig: '{"mode":"ALERT","relay1":false,"target":28.0}',
    mediaFilePath: 'DCIM/FOTO_002.JPG'
  },
  {
    isActive: false,
    isAlarmTriggered: false,
    tempCalibration: 0,
    batteryPercent: 88,
    altitudeMeters: 1000,
    rawAdcValue: 920,
    systemErrorCode: 0,
    sampleCounter: 5003,
    epochTimestamp: 1774182120,
    sensorVoltage: 3.28,
    gpsLatitude: 3.451647,
    gpsLongitude: -76.531985,
    nodeName: 'NODO_CALI',
    hardwareVersion: 'v2.0',
    rfidCardUid: '01020304050607',
    aesEncryptionKey: '112233445566778899AABBCCDDEEFF00',
    jsonConfig: '{"mode":"ECO","fan":false,"target":20.0}',
    mediaFilePath: 'DCIM/FOTO_003.JPG'
  }
];

sampleRecords.forEach((r) => {
  MicroDBEngine.insertRecord(allDataTblPath, r, allDataSchema);
});

// 2. Tablas Relacionales (Clientes y Facturas - RelationalJoin.ino)
const custCpp = `
struct Customer {
  char name[20];
  char phone[12];
};
`;
const custSchema = SchemaParser.parseCppStruct(custCpp, 'custs');
const custTblPath = path.join(SAMPLE_DIR, 'custs.tbl');
MicroDBEngine.createTable(custTblPath, custSchema.recordSize);
fs.writeFileSync(path.join(SAMPLE_DIR, 'custs.schema.json'), JSON.stringify(custSchema, null, 2));

const cid1 = MicroDBEngine.insertRecord(custTblPath, { name: 'Empresa ABC', phone: '555-0100' }, custSchema);
const cid2 = MicroDBEngine.insertRecord(custTblPath, { name: 'Tech Labs', phone: '555-0200' }, custSchema);
const cid3 = MicroDBEngine.insertRecord(custTblPath, { name: 'Adazix Systems', phone: '555-0300' }, custSchema);

const invCpp = `
struct Invoice {
  uint32_t customer_id;
  float    amount;
  bool     isPaid;
};
`;
const invSchema = SchemaParser.parseCppStruct(invCpp, 'invs');
const invTblPath = path.join(SAMPLE_DIR, 'invs.tbl');
MicroDBEngine.createTable(invTblPath, invSchema.recordSize);
fs.writeFileSync(path.join(SAMPLE_DIR, 'invs.schema.json'), JSON.stringify(invSchema, null, 2));

MicroDBEngine.insertRecord(invTblPath, { customer_id: cid1, amount: 1500.0, isPaid: true }, invSchema);
MicroDBEngine.insertRecord(invTblPath, { customer_id: cid1, amount: 320.5, isPaid: false }, invSchema);
MicroDBEngine.insertRecord(invTblPath, { customer_id: cid2, amount: 4890.0, isPaid: true }, invSchema);
MicroDBEngine.insertRecord(invTblPath, { customer_id: cid3, amount: 8900.25, isPaid: true }, invSchema);

console.log('✓ Base de datos de prueba creada exitosamente en sample_db!');
