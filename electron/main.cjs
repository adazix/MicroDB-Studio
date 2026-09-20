// ============================================================================
// MICRODB STUDIO - ELECTRON DESKTOP RUNTIME & IN-PROCESS BACKEND
// ============================================================================

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
const SERVER_PORT = 3001;

// Iniciar el servidor backend directamente dentro del runtime de Electron
async function startBackendServer() {
  process.env.PORT = String(SERVER_PORT);
  process.env.NODE_ENV = 'production';

  const possiblePaths = [
    path.join(__dirname, '../dist-server/index.js'),
    path.join(__dirname, 'dist-server/index.js'),
    path.join(process.resourcesPath || '', 'app.asar/dist-server/index.js'),
    path.join(process.resourcesPath || '', 'app/dist-server/index.js'),
    path.join(process.cwd(), 'dist-server/index.js')
  ];

  const serverScript = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0];

  try {
    const fileUrl = pathToFileURL(serverScript).href;
    console.log('[Electron Main] Iniciando Backend REST & WebSocket in-process desde:', fileUrl);
    await import(fileUrl);
    console.log('[Electron Main] Backend Express + WebSockets iniciado exitosamente.');
  } catch (err) {
    console.error('[Electron Main] Error crítico al iniciar backend in-process:', err);
  }
}

// Esperar a que el servidor Express esté escuchando en el puerto local
function waitForServer(retries = 40, delay = 150) {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.get(`http://localhost:${SERVER_PORT}/api/databases`, (res) => {
        clearInterval(interval);
        resolve(true);
      });

      req.on('error', () => {
        if (attempts >= retries) {
          clearInterval(interval);
          resolve(false); // Continuar de todos modos
        }
      });

      req.end();
    }, delay);
  });
}

async function createWindow() {
  // Resolver ícono para la ventana
  const possibleIcons = [
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, 'public/icon.png'),
    path.join(process.resourcesPath || '', 'app.asar/public/icon.png'),
    path.join(process.cwd(), 'public/icon.png')
  ];
  const appIcon = possibleIcons.find((p) => fs.existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0d1117',
    title: 'MicroDB Studio - SD & Embedded Database Manager',
    icon: appIcon,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Abrir enlaces externos en el navegador predeterminado del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Mostrar ventana suavemente cuando el contenido esté listo
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Esperar a que el backend inicie y cargar URL del servidor local
  await waitForServer();
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicialización de la aplicación Electron
app.whenReady().then(async () => {
  await startBackendServer();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Limpieza al cerrar la aplicación
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
