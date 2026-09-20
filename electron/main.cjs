// ============================================================================
// MICRODB STUDIO - ELECTRON DESKTOP RUNTIME & WINDOW LIFECYCLE
// ============================================================================

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = 3001;

// Iniciar el servidor backend en segundo plano
function startBackendServer() {
  const serverScript = path.join(__dirname, '../dist-server/index.js');
  
  try {
    serverProcess = fork(serverScript, [], {
      env: { ...process.env, PORT: SERVER_PORT, NODE_ENV: 'production' },
      stdio: 'inherit'
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron Backend Error]:', err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`[Electron Backend] Servidor finalizado con código: ${code}`);
    });
  } catch (err) {
    console.error('Error lanzando backend:', err);
  }
}

// Esperar a que el servidor Express esté escuchando en el puerto 3001
function waitForServer(retries = 30, delay = 200) {
  return new Promise((resolve, reject) => {
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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0d1117',
    title: 'MicroDB Studio - SD & Embedded Database Manager',
    icon: path.join(__dirname, '../public/icon.png'),
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

  // Cargar URL del servidor local
  await waitForServer();
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicialización de la aplicación
app.whenReady().then(async () => {
  startBackendServer();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Limpieza al cerrar la aplicación
app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
