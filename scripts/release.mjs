#!/usr/bin/env node
/**
 * scripts/release.mjs
 * 
 * Release Manager Utility for MicroDB Studio
 * Desarrollado para Adazix Systems S.A.S
 * 
 * Uso:
 *   node scripts/release.mjs check                  # Verifica compilación previa y estado de Git
 *   node scripts/release.mjs bump <patch|minor|major|x.y.z>  # Incrementa versión en package.json y README.md
 *   node scripts/release.mjs dist                   # Compila los ejecutables para Windows (dist:win)
 *   node scripts/release.mjs notes [version]        # Genera el título y descripción para GitHub Releases
 *   node scripts/release.mjs tag <version> <title>  # Crea el commit y tag en Git
 *   node scripts/release.mjs status                 # Muestra versión actual, último tag y cambios recientes
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const README_PATH = path.join(ROOT_DIR, 'README.md');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');
const DIST_ELECTRON_PATH = path.join(ROOT_DIR, 'dist-electron');

const isWin = process.platform === 'win32';
const pnpmCmd = isWin ? 'pnpm.cmd' : 'pnpm';

// Helpers para consola
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function log(msg) { console.log(msg); }
function logInfo(msg) { console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`); }
function logSuccess(msg) { console.log(`${colors.green}✔ ${msg}${colors.reset}`); }
function logWarn(msg) { console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`); }
function logError(msg) { console.error(`${colors.red}✖ ${msg}${colors.reset}`); }

function run(command, options = {}) {
  try {
    return execSync(command, {
      cwd: ROOT_DIR,
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      ...options
    });
  } catch (error) {
    if (!options.allowFailure) {
      throw error;
    }
    return null;
  }
}

function getPackageJson() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
}

function getLatestGitTag() {
  try {
    return execSync('git describe --tags --abbrev=0', { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function checkCompilation() {
  logInfo(`Iniciando prueba de compilación en frío (${pnpmCmd} build)...`);
  try {
    run(`${pnpmCmd} build`);
    logSuccess('Compilación inicial completada con ÉXITO (0 errores en Vite y TypeScript).');
    return true;
  } catch (err) {
    logError('La compilación INICIAL FALLÓ. Detén el release y corrige los errores antes de continuar.');
    process.exit(1);
  }
}

function checkGitStatus() {
  logInfo('Analizando estado del repositorio Git...');
  const status = run('git status --short', { silent: true }).trim();
  const latestTag = getLatestGitTag() || 'Inicio';
  log(`  ${colors.bold}Último tag detectado:${colors.reset} ${latestTag}`);
  
  if (latestTag !== 'Inicio') {
    log(`  ${colors.bold}Commits desde ${latestTag}:${colors.reset}`);
    const commits = run(`git log ${latestTag}..HEAD --oneline`, { silent: true }).trim();
    if (commits) {
      log(commits.split('\n').map(l => `    • ${l}`).join('\n'));
    } else {
      log('    (Sin commits nuevos desde el tag)');
    }
  }

  if (status) {
    log(`\n  ${colors.bold}Archivos modificados / no versionados:${colors.reset}`);
    log(status.split('\n').map(l => `    ${l}`).join('\n'));
  } else {
    log('  (Árbol de trabajo limpio)');
  }
}

function bumpVersion(typeOrVersion) {
  const pkg = getPackageJson();
  const oldVersion = pkg.version;
  let newVersion = '';

  const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;
  const match = oldVersion.match(semverRegex);
  if (!match) {
    logError(`Versión actual inválida en package.json: ${oldVersion}`);
    process.exit(1);
  }

  let [_, major, minor, patch] = match.map(Number);

  if (typeOrVersion === 'patch') {
    patch += 1;
    newVersion = `${major}.${minor}.${patch}`;
  } else if (typeOrVersion === 'minor') {
    minor += 1;
    patch = 0;
    newVersion = `${major}.${minor}.${patch}`;
  } else if (typeOrVersion === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
    newVersion = `${major}.${minor}.${patch}`;
  } else if (semverRegex.test(typeOrVersion)) {
    newVersion = typeOrVersion;
  } else {
    logError(`Tipo de versión desconocido: "${typeOrVersion}". Usa patch, minor, major o x.y.z`);
    process.exit(1);
  }

  logInfo(`Incrementando versión de ${colors.yellow}${oldVersion}${colors.reset} a ${colors.green}${newVersion}${colors.reset}...`);

  // Actualizar package.json
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  logSuccess(`Actualizado package.json -> version: "${newVersion}"`);

  // Actualizar README.md si existen referencias al ejecutable
  if (fs.existsSync(README_PATH)) {
    let readme = fs.readFileSync(README_PATH, 'utf-8');
    const updatedReadme = readme
      .replace(/MicroDB Studio Setup \d+\.\d+\.\d+\.exe/g, `MicroDB Studio Setup ${newVersion}.exe`)
      .replace(/MicroDB Studio \d+\.\d+\.\d+\.exe/g, `MicroDB Studio ${newVersion}.exe`);
    
    if (updatedReadme !== readme) {
      fs.writeFileSync(README_PATH, updatedReadme, 'utf-8');
      logSuccess(`Actualizado README.md con referencias a ${newVersion}`);
    }
  }

  return newVersion;
}

function buildDistribution() {
  logInfo(`Generando instaladores de Windows con ${pnpmCmd} dist:win...`);
  run(`${pnpmCmd} dist:win`);

  const pkg = getPackageJson();
  const version = pkg.version;
  const nsisName = `MicroDB Studio Setup ${version}.exe`;
  const portableName = `MicroDB Studio ${version}.exe`;

  const nsisPath = path.join(DIST_ELECTRON_PATH, nsisName);
  const portablePath = path.join(DIST_ELECTRON_PATH, portableName);

  logSuccess('¡Empaquetado completado!');
  if (fs.existsSync(nsisPath)) {
    const sizeMb = (fs.statSync(nsisPath).size / (1024 * 1024)).toFixed(2);
    log(`  📦 ${colors.bold}Instalador NSIS:${colors.reset} ${nsisName} (${sizeMb} MB)`);
  } else {
    logWarn(`No se encontró el instalador esperado: ${nsisPath}`);
  }

  if (fs.existsSync(portablePath)) {
    const sizeMb = (fs.statSync(portablePath).size / (1024 * 1024)).toFixed(2);
    log(`  💼 ${colors.bold}Versión Portable:${colors.reset} ${portableName} (${sizeMb} MB)`);
  } else {
    logWarn(`No se encontró el portable esperado: ${portablePath}`);
  }
}

function getChangelogSection(targetVersion) {
  if (!fs.existsSync(CHANGELOG_PATH)) return null;
  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  const sectionHeaderRegex = new RegExp(`## \\[${targetVersion.replace(/\./g, '\\.')}\\][^\n]*\n([\\s\\S]*?)(?=\n## \\[|$)`);
  const match = changelog.match(sectionHeaderRegex);
  return match ? match[1].trim() : null;
}

function generateGitHubNotes(versionOverride, titleOverride) {
  const pkg = getPackageJson();
  const version = versionOverride || pkg.version;
  const releaseTitle = titleOverride || `MicroDB Studio v${version} - Nuevas Mejoras y Optimizaciones`;
  const changelogBody = getChangelogSection(version) || 'Consulte CHANGELOG.md para más detalles.';

  const nsisName = `MicroDB Studio Setup ${version}.exe`;
  const portableName = `MicroDB Studio ${version}.exe`;
  const nsisPath = path.join(DIST_ELECTRON_PATH, nsisName);
  const portablePath = path.join(DIST_ELECTRON_PATH, portableName);

  const nsisSize = fs.existsSync(nsisPath) ? ` (${(fs.statSync(nsisPath).size / (1024 * 1024)).toFixed(2)} MB)` : '';
  const portableSize = fs.existsSync(portablePath) ? ` (${(fs.statSync(portablePath).size / (1024 * 1024)).toFixed(2)} MB)` : '';

  const output = `
================================================================================
📋 COPIAR Y PEGAR EN GITHUB RELEASES
================================================================================

📌 Tag version: v${version}
🎯 Target branch: main
🏷️ Release title: ${releaseTitle}

--- DESCRIPCIÓN DEL RELEASE (MARKDOWN) ---

# MicroDB Studio v${version} 🚀

Suite de escritorio visual y de alto rendimiento para bases de datos binarias embebidas en tarjetas SD (MicroDB / Arduino / ESP32) con compatibilidad DBeaver.

---

${changelogBody}

---

### 📦 Archivos Binarios de Esta Versión (Windows 10/11 x64)

| Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| **\`${nsisName}\`**${nsisSize} | 💻 Instalador Oficial NSIS | Crea accesos directos, asistente guiado y desinstalador limpio. |
| **\`${portableName}\`**${portableSize} | 💼 Versión Portable Single-File | Ejecutable autónomo sin instalación ni permisos de administrador. |

---

### 🔌 Requisitos y Compatibilidad
- **Sistemas Operativos:** Windows 10 / Windows 11 (64-bit).
- **Librería MicroDB:** Compatible con versiones Arduino MicroDB v1.0.0+ (estructuras binarias \`.tbl\`, esquemas \`.jsn\` y logs WAL \`.wal\`).
- **Clientes SQL Externos:** DBeaver, TablePlus, SQLite Studio (mediante live-bridge SQLite WASM).

================================================================================
`;

  console.log(output);
  return output;
}

function createGitTag(versionOverride, releaseTitle) {
  const pkg = getPackageJson();
  const version = versionOverride || pkg.version;
  const title = releaseTitle || `Versión v${version}`;

  logInfo(`Creando commit y tag para v${version}...`);

  // Asegurar que archivos clave están en el stage
  run('git add package.json README.md CHANGELOG.md');
  if (fs.existsSync(path.join(ROOT_DIR, 'DOCUMENTACION_SOFTWARE.md'))) {
    run('git add DOCUMENTACION_SOFTWARE.md', { allowFailure: true });
  }

  const commitMsg = `chore(release): v${version} - ${title}`;
  run(`git commit -m "${commitMsg}"`, { allowFailure: true });
  logSuccess(`Commit creado: "${commitMsg}"`);

  const tagMsg = `Release v${version}: ${title}`;
  run(`git tag -a v${version} -m "${tagMsg}"`);
  logSuccess(`Git tag creado: v${version}`);
  logInfo(`Para publicar a GitHub ejecuta: git push origin main --tags`);
}

// Enrutador de comandos CLI
const [,, command, ...args] = process.argv;

switch (command) {
  case 'check':
    checkCompilation();
    checkGitStatus();
    break;
  case 'bump':
    if (!args[0]) {
      logError('Debes especificar el tipo de incremento: patch, minor, major o x.y.z');
      process.exit(1);
    }
    bumpVersion(args[0]);
    break;
  case 'dist':
    buildDistribution();
    break;
  case 'notes':
    generateGitHubNotes(args[0], args.slice(1).join(' '));
    break;
  case 'tag':
    createGitTag(args[0], args.slice(1).join(' '));
    break;
  case 'status':
    checkGitStatus();
    break;
  default:
    log(`
${colors.bold}${colors.cyan}MicroDB Studio - Release Manager Utility${colors.reset}

Uso:
  node scripts/release.mjs check                  Verifica compilación sin fallos y estado de Git
  node scripts/release.mjs status                 Muestra versión actual, tags y commits recientes
  node scripts/release.mjs bump <patch|minor|major|x.y.z>  Incrementa versión en package.json y README.md
  node scripts/release.mjs dist                   Compila ejecutables Windows (NSIS + Portable)
  node scripts/release.mjs tag <version> [title]  Genera git commit y tag anotado
  node scripts/release.mjs notes [version] [title] Genera título y texto para GitHub Releases
`);
    break;
}
