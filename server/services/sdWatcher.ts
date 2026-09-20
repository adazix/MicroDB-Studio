// ============================================================================
// MICRODB STUDIO - OBSERVADOR EN TIEMPO REAL DE ARCHIVOS SD (CHOKIDAR + WEBSOCKETS)
// ============================================================================

import chokidar, { FSWatcher } from 'chokidar';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

export class SDWatcherService {
  private watcher: FSWatcher | null = null;
  private currentPath: string | null = null;
  private wss: WebSocketServer | null = null;
  private onTableChangedCallback?: (tableName: string, eventType: string) => void;

  constructor(wss?: WebSocketServer) {
    this.wss = wss || null;
  }

  public setWebSocketServer(wss: WebSocketServer): void {
    this.wss = wss;
  }

  public setOnTableChanged(callback: (tableName: string, eventType: string) => void): void {
    this.onTableChangedCallback = callback;
  }

  /**
   * Empieza a observar un directorio de base de datos
   */
  public watchDirectory(dirPath: string): void {
    if (this.currentPath === dirPath && this.watcher) {
      return;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.currentPath = dirPath;
    console.log(`[SDWatcher] Iniciando observación en tiempo real de: ${dirPath}`);

    this.watcher = chokidar.watch(dirPath, {
      ignored: /(^|[/\\])\..|microdb_live\.sqlite.*|\.tmp_vacuum/, // Ignorar archivos ocultos y base de datos sqlite temporal
      persistent: true,
      depth: 1,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath) => this.handleFileEvent('add', filePath))
      .on('change', (filePath) => this.handleFileEvent('change', filePath))
      .on('unlink', (filePath) => this.handleFileEvent('unlink', filePath))
      .on('error', (error) => console.error('[SDWatcher] Error:', error));
  }

  private handleFileEvent(eventType: 'add' | 'change' | 'unlink', filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.tbl' || ext === '.idx' || ext === '.json') {
      const tableName = path.basename(filePath, ext);
      console.log(`[SDWatcher] Evento detectado (${eventType}): ${filePath}`);

      // Notificar callback interno
      if (this.onTableChangedCallback) {
        this.onTableChangedCallback(tableName, eventType);
      }

      // Notificar por WebSocket a clientes de UI
      this.broadcast({
        type: 'SD_FILE_CHANGE',
        data: {
          eventType,
          filePath,
          tableName,
          extension: ext,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  public broadcast(message: { type: string; data: any }): void {
    if (!this.wss) return;

    const payload = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.currentPath = null;
    }
  }
}
