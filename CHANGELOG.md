# Changelog
Todas las modificaciones notables realizadas en este proyecto serán documentadas en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
