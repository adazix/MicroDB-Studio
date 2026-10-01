// ============================================================================
// MICRODB STUDIO - NATIVE DIALOG HELPER (ELECTRON / POWERSHELL FALLBACK)
// ============================================================================

import { exec } from 'node:child_process';
import util from 'node:util';
import path from 'node:path';

const execAsync = util.promisify(exec);

export async function showNativeFolderDialog(
  title: string = 'Seleccionar carpeta',
  initialPath?: string | null
): Promise<string | null> {
  const normalizedInitial = initialPath && typeof initialPath === 'string' && initialPath.trim()
    ? path.normalize(initialPath.trim())
    : null;

  // 1. Si estamos ejecutando dentro de Electron
  if (process.versions.electron) {
    try {
      const electron = await import('electron');
      const dialog = electron.dialog || (electron as any).default?.dialog;
      const BrowserWindow = electron.BrowserWindow || (electron as any).default?.BrowserWindow;
      const win = BrowserWindow ? BrowserWindow.getFocusedWindow() : null;
      if (dialog && typeof dialog.showOpenDialog === 'function') {
        const dialogOpts: any = {
          title,
          properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
        };
        if (normalizedInitial) {
          dialogOpts.defaultPath = normalizedInitial;
        }
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
      const initialPathCmd = normalizedInitial
        ? `$dialog.SelectedPath = '${normalizedInitial.replace(/'/g, "''")}'`
        : '';

      // Usar script de PowerShell con STA (Single Thread Apartment) y ventana modal
      const psScript = `
[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${title.replace(/'/g, "''")}'
$dialog.ShowNewFolderButton = $true
$dialog.RootFolder = [System.Environment+SpecialFolder]::MyComputer
${initialPathCmd}

$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen

if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $dialog.SelectedPath
}
$form.Dispose()
$dialog.Dispose()
`;
      const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
      const { stdout } = await execAsync(`powershell.exe -NoProfile -Sta -EncodedCommand ${encodedCommand}`);
      const lines = stdout.trim().split(/\r?\n/).filter((l) => !l.startsWith('#<') && !l.startsWith('<'));
      const chosen = lines[lines.length - 1]?.trim();
      return chosen ? path.normalize(chosen) : null;
    } catch (e) {
      console.warn('Error en fallback PowerShell FolderBrowserDialog:', e);
    }
  }

  return null;
}
