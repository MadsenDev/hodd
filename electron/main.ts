import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stateFile = () => path.join(app.getPath('userData'), 'hodd-state.json');

async function readState(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(stateFile(), 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Unable to read HODD state', error);
    return {};
  }
}

async function writeState(state: Record<string, unknown>) {
  const savedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(stateFile()), { recursive: true });
  await fs.writeFile(stateFile(), JSON.stringify({ ...state, savedAt }, null, 2), 'utf8');
  return { savedAt };
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : {
      color: '#f6f5f1',
      symbolColor: '#5d5a6f',
      height: 32,
    },
    backgroundColor: '#f6f5f1',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('hodd:state:get', readState);
  ipcMain.handle('hodd:state:save', (_event, state: Record<string, unknown>) => writeState(state));
  ipcMain.handle('hodd:archive:export', async (_event, payload: Record<string, unknown>) => {
    const result = await dialog.showSaveDialog({
      title: 'Export HODD archive',
      defaultPath: `hodd-archive-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'HODD archive', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { canceled: false, path: result.filePath };
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
