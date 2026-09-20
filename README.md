# 🗄️ MicroDB Studio

**MicroDB Studio** es una suite de software de escritorio moderna, visual y de alto rendimiento desarrollada por **Adazix Systems S.A.S** para explorar, monitorear en tiempo real, editar, depurar y exportar bases de datos binarias creadas con la librería **MicroDB** en tarjetas SD (Arduino, ESP32, STM32, RP2040) o discos locales, con integración directa y compatibilidad con **DBeaver**.

---

## 🚀 Inicio Rápido

### Opción 1: Con doble clic en Windows
Simplemente ejecuta el archivo:
```bat
start.bat
```

### Opción 2: Desde terminal
```bash
# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Iniciar servidor y frontend en modo desarrollo
npm run dev
```

La aplicación abrirá la interfaz en tu navegador en:
👉 **[http://localhost:5173](http://localhost:5173)** (o `http://localhost:3001` en producción).

---

## ✨ Características Principales

### 1. 🖴 Soporte Híbrido: Tarjetas SD y Carpetas Locales
- **Detección Automática de Unidades**: Detecta tarjetas SD / unidades extraíbles conectadas a Windows (ej: `E:\`, `F:\`) y localiza carpetas `DB`.
- **Ruta Local de PC**: Puedes ingresar cualquier carpeta de tu disco local (ej. `D:\Datos\DB` o `C:\Arduino\MicroDB\sample_db`).
- **Live SD Watcher (Tiempo Real)**: Mediante WebSockets y monitorización de disco a bajo nivel, si tu microcontrolador Arduino/ESP32 escribe nuevos registros en la SD, la interfaz se actualiza instantáneamente con animaciones de pulso.

### 2. ⚡ Consola SQL Interactiva y Relacional
- Ejecuta consultas SQL estándar completas (`SELECT`, `WHERE`, `INNER JOIN`, `GROUP BY`, `ORDER BY`, `COUNT`, `AVG`, `SUM`, `MAX`, `MIN`).
- Muestra el tiempo de ejecución en milisegundos (`ms`).
- Exporta los resultados de cualquier consulta a CSV, Excel o copia a JSON con un clic.

### 3. 🔌 Puente Directo con DBeaver (SQLite Live Bridge)
- MicroDB Studio mantiene sincronizado automáticamente un archivo SQLite estructurado (`microdb_live.sqlite`) con tipos de datos nativos SQL y claves primarias.
- **Cómo conectar en DBeaver**:
  1. En DBeaver, haz clic en **Nueva Conexión ➔ SQLite**.
  2. Pega la ruta del archivo copiada desde el modal de MicroDB Studio (`.../microdb_live.sqlite`).
  3. Haz clic en **Finalizar**. ¡Listo! Puedes ver diagramas de entidad-relación (ERD), diseñar consultas visuales y graficar datos.

### 4. 🧬 Importador Automático de Structs C++
- Pega directamente la definición del `struct` de tu sketch Arduino (ej: `struct SensorData { ... }`).
- El analizador sintáctico extrae automáticamente tipos (`bool`, `uint8_t`, `int16_t`, `float`, `double`, `char[]`, `uint8_t[]` BLOBs, JSON, rutas multimedia), calcula tamaños exactos en bytes y verifica la coincidencia con la cabecera `.tbl`.

### 5. 📊 Data Grid & Operaciones CRUD en Disco
- Visualiza todos los slots físicos en disco: registros **Activos** y registros **Borrados (Tombstones)**.
- **Inserción $O(1)$**: Reutiliza automáticamente slots eliminados a través de la lista libre (*Free-List*).
- **Edición in-place**: Modifica valores directamente en disco sin reescribir el archivo.
- **Borrado lógico**: Marca slots con tombstone y actualiza el puntero de reciclaje.
- **Visor Hexadecimal (HEX)**: Inspecciona los bytes crudos y la representación ASCII de cada slot.

### 6. 🩺 Mapa Físico de Sectores & Desfragmentador (Vacuum)
- Visualización gráfica estilo desfragmentador de disco de todos los bloques de la SD.
- Identifica la fragmentación del archivo `.tbl`.
- Herramienta **Vacuum / Compactar**: Elimina permanentemente los tombstones, compacta el archivo contiguamente y reconstruye los índices secundarios `.idx`.

### 7. 📤 Suite de Exportación Multiformato
- **Microsoft Excel (.xlsx)**
- **CSV (.csv)**
- **JSON (.json)**
- **Script SQL Dump (.sql)** (`CREATE TABLE` + `INSERT INTO`)

---

## 🏗️ Estructura del Proyecto

```
MicroDB-Studio/
├── package.json               # Configuración de dependencias y scripts
├── tsconfig.json              # Configuración de TypeScript
├── vite.config.ts             # Bundler Vite con proxy hacia backend
├── tailwind.config.js         # Estilos Tailwind CSS Dark Theme
├── start.bat                  # Script de inicio rápido con doble clic
├── sample_db/                 # Base de datos de ejemplo con tablas de prueba
│   ├── alldata.tbl            # Tabla con todos los tipos de datos de MicroDB
│   ├── alldata.schema.json
│   ├── custs.tbl              # Tabla relacional de Clientes
│   ├── custs.schema.json
│   ├── invs.tbl               # Tabla relacional de Facturas
│   └── invs.schema.json
├── server/                    # Backend Node.js & Motor Binario
│   ├── index.ts               # Servidor API REST + WebSockets
│   ├── seedSampleDb.ts        # Generador de tablas binarias de prueba
│   ├── core/
│   │   ├── binaryEngine.ts    # Motor binario MTB1 y MID1 (100% MicroDB C++)
│   │   ├── microdbTypes.ts    # Tipos, headers y constantes
│   │   ├── schemaParser.ts    # C++ Struct Parser & AST
│   │   ├── sqliteBridge.ts    # Puente SQLite en tiempo real para DBeaver
│   │   ├── exporter.ts        # Exportador a CSV, XLSX, JSON, SQL Dump
│   │   ├── defrag.ts          # Compactador / Vacuum de tablas
│   │   └── fnv1a.ts           # Hash FNV-1a para índices secundarios
│   └── services/
│       ├── diskDetector.ts    # Detector de unidades SD y discos
│       └── sdWatcher.ts       # Observador de archivos en tiempo real
└── src/                       # Frontend React + TypeScript
    ├── main.tsx               # Punto de entrada React
    ├── App.tsx                # Aplicación principal y gestión de estado
    ├── index.css              # Estilos globales y animaciones de registros
    ├── types/                 # Interfaces TypeScript
    ├── utils/                 # Cliente API REST y WebSockets
    └── components/            # Componentes de la interfaz
        ├── Navbar.tsx
        ├── TableExplorer.tsx
        ├── DataGridView.tsx
        ├── SqlConsole.tsx
        ├── SchemaEditor.tsx
        ├── DiskBlockMap.tsx
        ├── DriveSelectorModal.tsx
        ├── DBeaverBridgeModal.tsx
        ├── ExportModal.tsx
        ├── RecordEditModal.tsx
        ├── HexInspectorModal.tsx
        ├── DefragModal.tsx
        └── NewTableModal.tsx
```

---

## 📜 Licencia y Créditos
- **Desarrollado para:** MicroDB Embedded Database
- **Ubicación del Proyecto:** `D:\Emprendimiento\Adazix Systems S.A.S\Desarrollos\MicroDB-Studio`
- **Autor:** Adazix Systems S.A.S / Jairo Antonio Rohatan Zapata
