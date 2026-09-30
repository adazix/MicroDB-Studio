# Changelog
Todas las modificaciones notables realizadas en este proyecto serán documentadas en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.1.1] - 2026-09-30

### 🛡️ Corrección de Errores y Validaciones
- **Detección Estricta de Bases de Datos:** Se corrigió el problema por el cual carpetas del sistema u otros subdirectorios no relacionados (como fotos, backups o descargas) eran detectados erróneamente como bases de datos con 0 tablas. Ahora el motor valida la presencia de artefactos legítimos de MicroDB (`.tbl`, `.jsn`, `.schema.json`, `.sch`, `.idx` o el archivo de marca `.microdb`).
- **Filtrado de Directorios del Sistema:** Se ignoran sistemáticamente carpetas protegidas y de sistema de Windows (`System Volume Information`, `$RECYCLE.BIN`, `Windows`, `Program Files`, `ProgramData`, `.git`, `node_modules`, etc.).
- **Manejo de Estado Vacío:** La interfaz lateral y el selector de bases de datos ahora indican claramente cuando un directorio no contiene bases de datos en lugar de mostrar registros vacíos o erróneos.

### 🚀 Nuevas Funcionalidades
- **Priorización Automática de Tarjetas SD:** Al abrir el diálogo de creación de nueva base de datos (*Nueva BD*), el sistema prioriza y preselecciona automáticamente la unidad de tarjeta SD detectada (`E:\`, etc.).
- **Selector / Explorador Nativo de Directorios ("Examinar..."):** Se integró un botón de exploración de carpetas nativo de Windows (mediante diálogos del sistema) tanto en el modal de nueva base de datos como en el selector de unidades manuales. Permite al usuario seleccionar cualquier carpeta en el disco sin tener que escribir la ruta a mano.
- **Creación Inmediata con Marcador `.microdb`:** Al crear una base de datos nueva vacía, se inicializa con un archivo de firma `.microdb`, permitiendo que sea reconocida instantáneamente por el explorador antes de crear la primera tabla.

---

## [1.1.0] - 2026-09-24

### 🚀 Añadido
- **Acceso directo a Vacuum en la grilla de datos:** Nuevo botón **`Vacuum / Compactar`** en la barra superior de `DataGridView` con badge en tiempo real indicando la cantidad de registros borrados pendientes de purga en la Free-List.
- **Banner interactivo de purga:** Al filtrar la tabla por la pestaña **`Borrados`**, se despliega una barra de notificación contextual que permite ejecutar el proceso de Vacuum con un solo clic.
- **Acceso rápido en la barra lateral:** Se integró un botón de acceso directo con icono de rayo ⚡ en la cabecera de cada tarjeta de tabla dentro de `TableExplorer`.
- **Visibilidad total de Vacuum:** Eliminación de la restricción que ocultaba el botón cuando la fragmentación era menor al 20%. Ahora el enlace `VACUUM` se habilita siempre que existan registros borrados (`deletedRecords > 0` o `frag > 0`).
- **Modal de Desfragmentación mejorado:** Diagnóstico previo en `DefragModal` que detalla los registros exactos a eliminar antes de iniciar el proceso.
- **Reconstrucción de Índices Secundarios (`.idx`):** `TableDefragmenter` ahora remapea automáticamente las entradas de los índices secundarios para apuntar a las nuevas posiciones físicas compactadas y descarta las referencias a registros eliminados.
- **Preservación binaria byte a byte:** El motor de compactación conserva íntegramente los buffers originales (`_rawHex`) de los registros activos para garantizar máxima fidelidad y compatibilidad con Arduino.
- **Cierre de directorio / SD:** Capacidad de desconectar la tarjeta SD o carpeta activa y retornar limpiamente a la pantalla de bienvenida.
- **Plantillas de GitHub Issues:** Configuración estandarizada para reportes de bugs, solicitudes de mejoras y compatibilidad de structs en Arduino / ESP32.

### 🔧 Mejoras
- Refresco sincronizado de tablas y bases de datos (`loadDatabases`) al culminar operaciones de compactación.
- Detección optimizada de unidades del sistema operativo y rutas con espacios o caracteres especiales.
- Mejora de contraste y alertas en el sistema de notificaciones Toast.

---

## [1.0.0] - 2026-09-24

### 🌟 Lanzamiento Inicial
- **Entorno de Escritorio Nativo:** Aplicación de alto rendimiento construida sobre Electron, React 18, TypeScript y Tailwind CSS.
- **Soporte Multibase de Datos y Tarjetas SD:** Detección de particiones FAT32 / SD y navegación por carpetas de bases de datos.
- **Consola SQL Relacional:** Soporte para sentencias `SELECT`, `WHERE`, `JOIN`, `GROUP BY`, `ORDER BY` y agregaciones mediante motor embebido.
- **DBeaver Live Bridge:** Puente SQLite (`microdb_live.sqlite`) con sincronización automática en tiempo real para clientes de bases de datos profesionales.
- **Data Grid CRUD:** Visualizador y editor de registros en disco, soporte de Free-List $O(1)$, visor hexadecimal (HEX) y navegación por claves foráneas.
- **Mapa Físico de Sectores:** Diagnóstico visual de la distribución de slots, tombstones y fragmentación en disco.
- **Exportación Multiformato:** Descargas directas a formatos Excel (`.xlsx`), CSV, JSON y volcados SQL DDL/DML.
- **Live SD Watcher:** Detección y notificación en tiempo real de escrituras en la SD a través de WebSockets.
