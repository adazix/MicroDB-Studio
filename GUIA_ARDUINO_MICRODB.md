# Guía de Integración: Arduino / ESP32 con MicroDB y MicroDB Studio

Esta guía explica cómo escribir y leer tablas de base de datos en tarjetas SD desde **Arduino IDE / PlatformIO** utilizando la librería C++ **`MicroDB`**, garantizando **100% de compatibilidad binaria bidireccional y transparencia total** con el software de escritorio **MicroDB Studio**.

---

## 1. Regla de Oro: Alineación de Structs (`#pragma pack`)

Los microcontroladores de 32 bits (ESP32, ARM Cortex-M, STM32, Teensy) por defecto alinean las variables en múltiplos de 4 bytes (padding). Para asegurar que los datos binarios sean idénticos en cualquier arquitectura (AVR de 8 bits, ESP32 de 32 bits y Windows/Node.js de 64 bits), **siempre define tus structs con `#pragma pack(push, 1)`**:

```cpp
#pragma pack(push, 1)
struct Cliente {
    char     nombre[32];      // 32 bytes
    char     telefono[16];    // 16 bytes
    uint32_t puntos;          // 4 bytes
    bool     activo;          // 1 byte
};

struct Factura {
    uint32_t clienteId;       // 4 bytes (Clave Foránea hacia Cliente)
    float    total;           // 4 bytes
    uint32_t timestamp;       // 4 bytes
};
#pragma pack(pop)
```

---

## 2. Ejemplo Completo: Creación, Inserción con FK, Unicidad y Exportación de Esquema

Guarda este sketch como `MicroDB_Relational_Demo.ino`:

```cpp
#include <SPI.h>
#include <SD.h>
#include <MicroDB.h>

// Pin CS para el lector de MicroSD (Cambiar según tu placa, ej: 5 para ESP32, 10 para Uno/Mega)
const int SD_CS_PIN = 5;

// ============================================================================
// 1. DEFINICIÓN DE ESTRUCTURAS DE DATOS (STRUCTS)
// ============================================================================
#pragma pack(push, 1)
struct Cliente {
    char     cedula[16];      // Documento único
    char     nombre[32];      // Nombre completo
    char     telefono[16];    // Teléfono
    uint32_t puntos;          // Puntos acumulados
    bool     activo;          // Estado
};

struct Venta {
    uint32_t clienteId;       // Clave Foránea (FK) -> Ref: Cliente._recordId
    float    montoTotal;      // Monto de la factura
    uint32_t fechaEpoch;      // Timestamp Unix
    uint8_t  metodoPago;      // 1: Efectivo, 2: Tarjeta, 3: Transferencia
};
#pragma pack(pop)

// Instancias de las tablas en la SD
Table<Cliente> tblClientes;
Table<Venta>   tblVentas;

void setup() {
    Serial.begin(115200);
    while (!Serial && millis() < 3000);

    Serial.println(F("\n=============================================="));
    Serial.println(F("🚀 INICIANDO MICRODB - DEMO RELACIONAL & SD"));
    Serial.println(F("=============================================="));

    // Inicializar tarjeta SD
    if (!SD.begin(SD_CS_PIN)) {
        Serial.println(F("❌ Error: No se pudo inicializar la tarjeta SD."));
        return;
    }
    Serial.println(F("✅ Tarjeta SD montada correctamente."));

    // Crear o abrir tablas en la carpeta "DB" de la SD
    SD.mkdir("DB");
    
    if (!tblClientes.open("DB", "clientes")) {
        Serial.println(F("❌ Error al abrir tabla 'clientes'"));
        return;
    }
    
    if (!tblVentas.open("DB", "ventas")) {
        Serial.println(F("❌ Error al abrir tabla 'ventas'"));
        return;
    }

    // ========================================================================
    // 2. AUTO-DESCUBRIMIENTO DE ESQUEMAS PARA MICRODB STUDIO
    // ========================================================================
    // Al registrar las columnas y exportar el catálogo JSON, MicroDB Studio
    // sabrá los nombres y tipos de columnas automáticamente al abrir la SD.
    
    tblClientes.addColumn("cedula",   TYPE_STRING, offsetof(Cliente, cedula),   sizeof(Cliente::cedula))
               .addColumn("nombre",   TYPE_STRING, offsetof(Cliente, nombre),   sizeof(Cliente::nombre))
               .addColumn("telefono", TYPE_STRING, offsetof(Cliente, telefono), sizeof(Cliente::telefono))
               .addColumn("puntos",   TYPE_UINT32, offsetof(Cliente, puntos),   sizeof(Cliente::puntos))
               .addColumn("activo",   TYPE_UINT8,  offsetof(Cliente, activo),   sizeof(Cliente::activo))
               .saveSchema(); // Genera DB/clientes.json y DB/clientes.sch

    tblVentas.addColumn("clienteId",   TYPE_UINT32, offsetof(Venta, clienteId),   sizeof(Venta::clienteId))
             .addColumn("montoTotal",  TYPE_FLOAT,  offsetof(Venta, montoTotal),  sizeof(Venta::montoTotal))
             .addColumn("fechaEpoch",  TYPE_UINT32, offsetof(Venta, fechaEpoch),  sizeof(Venta::fechaEpoch))
             .addColumn("metodoPago",  TYPE_UINT8,  offsetof(Venta, metodoPago),  sizeof(Venta::metodoPago))
             .saveSchema(); // Genera DB/ventas.json y DB/ventas.sch

    Serial.println(F("✅ Esquemas exportados a la SD para MicroDB Studio."));

    // ========================================================================
    // 3. INSERCIÓN CON VALIDACIÓN DE VALOR ÚNICO (insertUniqueString)
    // ========================================================================
    Cliente c1;
    strncpy(c1.cedula, "1020304050", sizeof(c1.cedula));
    strncpy(c1.nombre, "Juan Perez", sizeof(c1.nombre));
    strncpy(c1.telefono, "+57 300 1234567", sizeof(c1.telefono));
    c1.puntos = 150;
    c1.activo = true;

    // insertUniqueString valida que la cédula no esté duplicada antes de escribir
    uint32_t idCliente1 = tblClientes.insertUniqueString(c1, [](const Cliente& c) {
        return c.cedula;
    });

    if (idCliente1 > 0) {
        Serial.print(F("✅ Cliente registrado con ID #"));
        Serial.println(idCliente1);
    } else {
        Serial.println(F("⚠️ Cliente ya existía (Violación de unicidad rechazada)"));
    }

    // ========================================================================
    // 4. INSERCIÓN CON VALIDACIÓN DE CLAVE FORÁNEA (insertWithFK)
    // ========================================================================
    Venta v1;
    v1.clienteId = idCliente1 > 0 ? idCliente1 : 1;
    v1.montoTotal = 89.95;
    v1.fechaEpoch = 1726840000;
    v1.metodoPago = 2; // Tarjeta

    // insertWithFK valida que el clienteId exista en tblClientes antes de guardar la venta
    uint32_t idVenta1 = tblVentas.insertWithFK(v1, tblClientes, v1.clienteId);

    if (idVenta1 > 0) {
        Serial.print(F("✅ Venta registrada con ID #"));
        Serial.println(idVenta1);
    } else {
        Serial.println(F("❌ Error: Venta rechazada porque el cliente no existe en la base de datos."));
    }

    // ========================================================================
    // 5. CONSULTA Y RECORRIDO EN STREAMING (O(1) RAM)
    // ========================================================================
    Serial.println(F("\n--- LISTADO DE CLIENTES EN LA SD ---"));
    tblClientes.forEach([](uint32_t id, const Cliente& c) {
        Serial.print(F("ID: ")); Serial.print(id);
        Serial.print(F(" | Cédula: ")); Serial.print(c.cedula);
        Serial.print(F(" | Nombre: ")); Serial.print(c.nombre);
        Serial.print(F(" | Puntos: ")); Serial.println(c.puntos);
    });

    Serial.println(F("\n--- LISTADO DE VENTAS RELACIONADAS ---"));
    tblVentas.forEach([&](uint32_t idVenta, const Venta& v) {
        Cliente c;
        if (tblClientes.getById(v.clienteId, c)) {
            Serial.print(F("Factura #")); Serial.print(idVenta);
            Serial.print(F(" | Total: $")); Serial.print(v.montoTotal);
            Serial.print(F(" | Comprador: ")); Serial.println(c.nombre);
        }
    });
}

void loop() {
    // Tu lógica de sensores o servidor aquí
    delay(5000);
}
```

---

## 3. Métodos Principales de la Librería `MicroDB` en C++

| Método en C++ | Propósito | Equivalente en MicroDB Studio |
|---|---|---|
| `tbl.open("DB", "nombre")` | Abre o crea la tabla binaria `.tbl` | Abrir SD o Crear Tabla |
| `tbl.insert(registro)` | Inserta un registro ($O(1)$ con Free-List) | Botón *"Insertar Registro"* |
| `tbl.insertUnique(reg, getKey)` | Inserta validando unicidad numérica | Columna con badge `🛡️ UQ` |
| `tbl.insertUniqueString(reg, getStr)` | Inserta validando unicidad de texto | Columna con badge `🛡️ UQ` |
| `tbl.insertWithFK(reg, parentTbl, fkId)` | Inserta validando que el padre exista | Selector inteligente `🔗 FK` |
| `tbl.update(id, nuevoReg)` | Modifica un registro in-place | Botón *"Editar"* (Lápiz) |
| `tbl.remove(id)` | Borra lógicamente (Tombstone $O(1)$) | Botón *"Eliminar Slot"* (Papelera) |
| `tbl.removeRestrict(id, childTbl, getFk)`| Impide borrar si tiene hijos en otra tabla | Validación relacional |
| `tbl.removeCascade(id, childTbl, getFk)` | Borra el padre y todos sus hijos en cascada | Borrado en cascada |
| `tbl.vacuum()` | Desfragmenta y compacta la tabla | Botón *"Vacuum / Desfragmentar"* |
| `tbl.forEach(callback)` | Itera todos los registros activos ($O(1)$ RAM) | Vista Grilla de Datos |
| `tbl.where(filtro, callback)` | Consulta con filtro personalizado | Filtros y Búsqueda en Vivo |

---

## 4. Transparencia Total Bidireccional

1. **Grabado en Arduino $\rightarrow$ Visto en PC:**
   - Tan pronto como tu Arduino llama a `tbl.insert()` en la SD, MicroDB Studio detecta la escritura en milisegundos mediante el **Live SD Watcher (WebSocket)** y actualiza la grilla y la base de datos SQLite automáticamente.
2. **Editado en PC $\rightarrow$ Leído en Arduino:**
   - Si insertas, modificas o eliminas un registro desde MicroDB Studio, los bytes en la SD se actualizan con la cabecera `SlotHeader` exacta y la Free-List correcta. Cuando tu Arduino ejecute `tbl.getById()` o `tbl.forEach()`, leerá los cambios al instante sin inconsistencias.
