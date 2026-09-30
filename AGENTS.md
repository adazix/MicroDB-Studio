# Instrucciones del Proyecto & Agentes - MicroDB Studio

Este archivo define las directivas y el comportamiento para los asistentes de inteligencia artificial (Antigravity / Gemini) que interactúan con el repositorio **MicroDB Studio** (desarrollado por Adazix Systems S.A.S).

---

## 🛠️ Tecnologías y Arquitectura

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons.
- **Backend Servidor:** Node.js, Express, TypeScript, WebSocket (`ws`), Chokidar.
- **Empaquetado de Escritorio:** Electron + `electron-builder` (Instalador NSIS y versión Portable para Windows x64).
- **Motores de Datos:**
  - MicroDB Binary Engine: Formatos `.tbl` con cabecera binaria, tabla de registros de longitud fija y Free-List para reciclaje $O(1)$ de slots borrados.
  - Esquemas JSON `.jsn` y Esquemas Binarios `.sch`.
  - SQLite WASM Bridge (`sql.js` / Alasql) para sincronización con DBeaver (`microdb_live.sqlite`).

---

## 🚀 Agente de Versiones y Protocolo de Release

Cuando el usuario solicite crear una nueva versión, preparar un release, subir una mejora o actualizar la versión de MicroDB Studio, **DEBES SEGUIR OBLIGATORIAMENTE ESTE PROTOCOLO**:

### 1. Verificación Inicial de Compilación (Salud del Proyecto)
- Ejecuta primero `pnpm.cmd build` (o `node scripts/release.mjs check`).
- **NUNCA continúes si la compilación falla.** Si hay errores de tipos TypeScript o de Vite, deten el proceso e informa al usuario.

### 2. Análisis de Cambios en Git & Documentación
- Revisa los cambios con `git status` y `git log $(git describe --tags --abbrev=0)..HEAD --oneline`.
- Determina qué componentes o servicios cambiaron.
- Si los cambios impactan la arquitectura, actualiza [DOCUMENTACION_SOFTWARE.md](file:///d:/Emprendimiento/Adazix%20Systems%20S.A.S/Desarrollos/MicroDB-Studio/DOCUMENTACION_SOFTWARE.md).
- Si alteran el formato binario de Arduino, actualiza [GUIA_ARDUINO_MICRODB.md](file:///d:/Emprendimiento/Adazix%20Systems%20S.A.S/Desarrollos/MicroDB-Studio/GUIA_ARDUINO_MICRODB.md).

### 3. Incremento de Versión Semántica (SemVer)
- Utiliza `patch` para correcciones y ajustes menores, `minor` para nuevas características y `major` para cambios no retrocompatibles.
- Ejecuta `node scripts/release.mjs bump <patch|minor|major>`. Esto actualizará:
  - `"version"` en `package.json`.
  - Referencias de instaladores en [README.md](file:///d:/Emprendimiento/Adazix%20Systems%20S.A.S/Desarrollos/MicroDB-Studio/README.md).

### 4. Actualización de CHANGELOG.md
- Agrega una nueva sección en [CHANGELOG.md](file:///d:/Emprendimiento/Adazix%20Systems%20S.A.S/Desarrollos/MicroDB-Studio/CHANGELOG.md) con la fecha actual y clasifica los cambios en:
  - `### 🚀 Añadido`
  - `### 🔧 Mejoras`
  - `### 🐛 Correcciones`

### 5. Compilación de Ejecutables
- Ejecuta `pnpm.cmd dist:win` (o `node scripts/release.mjs dist`).
- Comprueba que en `dist-electron/` se hayan generado:
  - `MicroDB Studio Setup X.Y.Z.exe`
  - `MicroDB Studio X.Y.Z.exe`

### 6. Git Commit y Git Tag
- Realiza el commit: `git add package.json README.md CHANGELOG.md DOCUMENTACION_SOFTWARE.md && git commit -m "chore(release): vX.Y.Z - <resumen>"`
- Crea el tag anotado: `git tag -a vX.Y.Z -m "Release vX.Y.Z: <resumen>"`

### 7. Formato Listo para GitHub Releases
- Proporciona al usuario el título y el Markdown completo para copiar y pegar en GitHub Releases:
  - **Título del Release:** `MicroDB Studio vX.Y.Z - <Título Impactante>`
  - **Tag:** `vX.Y.Z`
  - **Descripción en Markdown:** Con resumen de la versión, changelog clasificado, tabla de ejecutables generados y notas de compatibilidad.
  - Comando recordatorio para publicar: `git push origin main --tags`.
