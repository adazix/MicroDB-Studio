// ============================================================================
// MICRODB STUDIO - NATIVE DIALOG HELPER (ELECTRON / POWERSHELL FALLBACK)
// ============================================================================

import { exec } from 'node:child_process';
import util from 'node:util';
import path from 'node:path';

const execAsync = util.promisify(exec);

export async function showNativeFolderDialog(title: string = 'Seleccionar carpeta'): Promise<string | null> {
  // 1. Si estamos ejecutando dentro de Electron
  if (process.versions.electron) {
    try {
      const electron = await import('electron');
      const dialog = electron.dialog || (electron as any).default?.dialog;
      const BrowserWindow = electron.BrowserWindow || (electron as any).default?.BrowserWindow;
      const win = BrowserWindow ? BrowserWindow.getFocusedWindow() : null;
      if (dialog && typeof dialog.showOpenDialog === 'function') {
        const dialogOpts = {
          title,
          properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
        };
        const result = win
          ? await dialog.showOpenDialog(win, dialogOpts)
          : await dialog.showOpenDialog(dialogOpts);
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          return path.normalize(result.filePaths[0]);
        }
        return null;
      }
    } catch (e) {
      console.warn('Error llamando dialog de Electron, usando fallback PowerShell:', e);
    }
  }

  // 2. Fallback de PowerShell en Windows
  if (process.platform === 'win32') {
    try {
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${title.replace(/'/g, "''")}'
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $dialog.SelectedPath
}
`;
      const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
      const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`);
      const lines = stdout.trim().split(/\r?\n/).filter((l) => !l.startsWith('#<') && !l.startsWith('<'));
      const chosen = lines[lines.length - 1]?.trim();
      return chosen ? path.normalize(chosen) : null;
    } catch (e) {
      console.warn('Error en fallback PowerShell FolderBrowserDialog:', e);
    }
  }

  return null;
}
