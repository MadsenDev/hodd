import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function dataFilePath(name: string): string {
  const devPath = path.join(__dirname, '../public/data', name);
  if (existsSync(devPath)) return devPath;
  return path.join(__dirname, '../dist/data', name);
}

async function readDataJson(name: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(dataFilePath(name), 'utf8'));
}

// ─── Ollama proxy ──────────────────────────────────────────────────────────

const OLLAMA_BASE = 'http://127.0.0.1:11434';

async function ollamaFetch(path: string, body?: unknown): Promise<unknown> {
  const opts: RequestInit = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' };
  const res = await fetch(OLLAMA_BASE + path, opts);
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  return res.json();
}

async function ollamaStatus(): Promise<{ running: boolean; models: string[] }> {
  try {
    const data = await ollamaFetch('/api/tags') as { models?: { name: string }[] };
    const models = (data.models ?? []).map(m => m.name);
    return { running: true, models };
  } catch (_) {
    return { running: false, models: [] };
  }
}

async function ollamaChat(model: string, messages: { role: string; content: string }[]): Promise<string> {
  const data = await ollamaFetch('/api/chat', { model, messages, stream: false }) as {
    message?: { content: string };
  };
  return data.message?.content ?? '';
}

async function ollamaGenerate(model: string, prompt: string, system?: string): Promise<string> {
  const data = await ollamaFetch('/api/generate', { model, prompt, system, stream: false }) as {
    response?: string;
  };
  return data.response ?? '';
}

// ─── Window ────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function titleBarOverlay(dark: boolean) {
  return {
    color:       dark ? '#121216' : '#f6f5f1',
    symbolColor: dark ? '#8b8893' : '#5d5a6f',
    height: 32,
  };
}

function createWindow() {
  const dark = nativeTheme.shouldUseDarkColors;
  const window = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : titleBarOverlay(dark),
    backgroundColor: dark ? '#0e0e11' : '#f6f5f1',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(path.join(__dirname, '../dist/index.html'));
}

// ─── IPC handlers ──────────────────────────────────────────────────────────

function registerIpc(): void {
  // Data reads
  ipcMain.handle('hodd:catalog',            () => db.getCatalog());
  ipcMain.handle('hodd:holdings',           () => db.getHoldings());
  ipcMain.handle('hodd:catalog-overrides',  () => db.getCatalogOverrides());
  ipcMain.handle('hodd:user-collections',   () => db.getUserCollections());
  ipcMain.handle('hodd:user-items',         () => db.getUserItems());
  ipcMain.handle('hodd:base-collections',   () => db.getBaseCollections());
  ipcMain.handle('hodd:settings',           () => db.getSettings());
  ipcMain.handle('hodd:story:get', (_e, id: string) => db.getStory(id));

  // Static config files (home/stats served from JSON, still seeded once)
  ipcMain.handle('hodd:home-config', async () => {
    try {
      return ((await readDataJson('home.json')) as { data: unknown }).data;
    } catch (_) { return null; }
  });
  ipcMain.handle('hodd:stats-config', async () => {
    try {
      return ((await readDataJson('stats.json')) as { data: unknown }).data;
    } catch (_) { return { growth: [] }; }
  });
  ipcMain.handle('hodd:user', () => {
    const s = db.getSettings();
    return { id: s['user.id'] ?? 'local', name: s['user.name'] ?? 'Collector', joined: s['user.joined'] ?? '2019' };
  });

  // Writes
  ipcMain.handle('hodd:holding:save',    (_e, id: string, patch: Record<string, unknown>) => db.saveHolding(id, patch));
  ipcMain.handle('hodd:holding:remove',  (_e, id: string)                                 => db.removeHolding(id));
  ipcMain.handle('hodd:catalog:save',    (_e, id: string, patch: Record<string, unknown>) => db.saveCatalogOverride(id, patch));
  ipcMain.handle('hodd:story:save',      (_e, id: string, paragraphs: string[])           => db.saveStory(id, paragraphs));
  ipcMain.handle('hodd:stories:all',     ()                                                 => db.getAllStories());
  ipcMain.handle('hodd:collection:create', (_e, def: { name: string; type: string; accent: string; template: string[] }) => db.createCollection(def));
  ipcMain.handle('hodd:item:add',        (_e, collId: string, draft: Record<string, unknown>) => db.addUserItem(collId, draft));
  ipcMain.handle('hodd:item:delete',     (_e, id: string)                                      => db.deleteUserItem(id));
  ipcMain.handle('hodd:item:set-owned',    (_e, id: string, owned: boolean)                       => db.setUserItemOwned(id, owned));
  ipcMain.handle('hodd:item:update-fields',(_e, id: string, fields: Record<string, unknown>)      => db.updateUserItemFields(id, fields));
  ipcMain.handle('hodd:setting:save',    (_e, key: string, value: string)                 => db.saveSetting(key, value));
  ipcMain.handle('hodd:favorites',                                                          () => db.getFavorites());
  ipcMain.handle('hodd:favorite:add',    (_e, id: string)                                  => db.addFavorite(id));
  ipcMain.handle('hodd:favorite:remove', (_e, id: string)                                  => db.removeFavorite(id));

  // Title bar theme (Windows only — keeps overlay in sync with in-app dark mode)
  ipcMain.handle('hodd:titlebar:set-theme', (_e, theme: 'light' | 'dark') => {
    if (process.platform === 'darwin' || !mainWindow) return;
    mainWindow.setTitleBarOverlay(titleBarOverlay(theme === 'dark'));
  });

  // Archive export
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

  // Archive import
  ipcMain.handle('hodd:archive:import', async (_event) => {
    const open = await dialog.showOpenDialog({
      title: 'Import HODD archive',
      filters: [{ name: 'HODD archive', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (open.canceled || !open.filePaths[0]) return { canceled: true };

    const confirm = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Import', 'Cancel'],
      defaultId: 1,
      title: 'Replace all data?',
      message: 'Importing will replace all your current items, collections, holdings, and settings with those from the archive.',
      detail: 'This cannot be undone.',
    });
    if (confirm.response !== 0) return { canceled: true };

    const content = await fs.readFile(open.filePaths[0], 'utf8');
    const payload = JSON.parse(content) as Record<string, unknown>;
    const outcome = db.importArchive(payload);
    return { canceled: false, imported: outcome.imported };
  });

  // Dynamic home data — real user items for recent/rediscover
  ipcMain.handle('hodd:home-dynamic', () => {
    try {
      const recent = db.getRecentUserItems(6);
      const baseCols = db.getBaseCollections() as Record<string, unknown>[];
      const userCols = db.getUserCollections() as Record<string, unknown>[];
      const allCols = [...baseCols, ...userCols];

      function collInfo(collectionId: unknown) {
        return allCols.find(c => c.id === collectionId) as Record<string, unknown> | undefined;
      }
      function timeSince(dateStr: string): string {
        try {
          const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
          if (days < 1) return 'today';
          if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
          if (days < 31) { const w = Math.floor(days / 7); return `${w} week${w === 1 ? '' : 's'} ago`; }
          const m = Math.floor(days / 30);
          if (m < 12) return `${m} month${m === 1 ? '' : 's'} ago`;
          const y = Math.floor(m / 12); return `${y} year${y === 1 ? '' : 's'} ago`;
        } catch (_) { return 'recently'; }
      }

      const enriched = recent.map(item => {
        const c = collInfo(item.collectionId);
        return { ...item, collName: c?.name ?? 'Collection', collAccent: c?.accent ?? '#6366f1', collType: c?.type };
      });

      const all = db.getAllUserItemsWithTimestamps();
      const owned = all.filter(i => i.owned !== false);

      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const addedThisMonth = all.filter(i => (i.created_at as string) > monthAgo).length;
      let rediscover: Record<string, unknown> | null = null;
      if (owned.length) {
        const pick = owned[Math.floor(Math.random() * owned.length)];
        const c = collInfo(pick.collectionId);
        rediscover = {
          ...pick,
          collName: c?.name ?? 'Collection',
          acquired: pick.acquired as string || timeSince(pick.created_at as string),
          note: 'Take a moment to revisit this one.',
        };
      }

      return { recent: enriched, rediscover, totalOwned: owned.length, totalMissing: all.filter(i => i.owned === false).length, addedThisMonth };
    } catch (e) {
      console.warn('[HODD home-dynamic]', (e as Error).message);
      return null;
    }
  });

  // Growth stats — monthly acquisition counts for the Statistics view
  ipcMain.handle('hodd:growth', () => {
    try {
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const items = db.getAllUserItemsWithTimestamps();
      const now = new Date();
      const result = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear(), mo = d.getMonth();
        const count = items.filter(it => {
          if (!it.created_at) return false;
          try {
            const dt = new Date(it.created_at as string);
            return dt.getFullYear() === y && dt.getMonth() === mo;
          } catch (_) { return false; }
        }).length;
        result.push({ m: MONTHS[mo], n: count });
      }
      return result;
    } catch (_) { return []; }
  });

  // Timeline — all user items with timestamps for the Timeline view
  ipcMain.handle('hodd:timeline', () => {
    try {
      const items = db.getAllUserItemsWithTimestamps();
      const baseCols = db.getBaseCollections() as Record<string, unknown>[];
      const userCols = db.getUserCollections() as Record<string, unknown>[];
      const allCols = [...baseCols, ...userCols];
      return items.map(item => {
        const c = allCols.find(col => col.id === item.collectionId) as Record<string, unknown> | undefined;
        return { ...item, collName: c?.name ?? 'Collection', collAccent: c?.accent ?? '#6366f1' };
      });
    } catch (e) {
      console.warn('[HODD timeline]', (e as Error).message);
      return [];
    }
  });

  // Ollama
  ipcMain.handle('hodd:ollama:status', () => ollamaStatus());
  ipcMain.handle('hodd:ollama:chat',   (_e, model: string, messages: { role: string; content: string }[]) => ollamaChat(model, messages));
  ipcMain.handle('hodd:ollama:generate', (_e, model: string, prompt: string, system?: string) => ollamaGenerate(model, prompt, system));

  // Online metadata lookup — free APIs (books/vinyl) + optional key-gated APIs (games/movies)
  ipcMain.handle('hodd:lookup', async (_e, type: string, query: string) => {
    const settings = db.getSettings();
    try {
      if (type === 'book') {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=title,author_name,first_publish_year`);
        const data = await res.json() as { docs?: { title?: string; author_name?: string[]; first_publish_year?: number }[] };
        return (data.docs ?? []).slice(0, 3).map(d => ({
          title: d.title ?? query,
          year:  d.first_publish_year ?? null,
          sub:   d.author_name?.[0] ?? null,
        }));
      }
      if (type === 'vinyl') {
        const res = await fetch(
          `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=3`,
          { headers: { 'User-Agent': 'HODD-Desktop/1.0 (hodd-app)' } }
        );
        const data = await res.json() as { releases?: { title?: string; date?: string; 'artist-credit'?: { artist?: { name?: string } }[] }[] };
        return (data.releases ?? []).slice(0, 3).map(d => ({
          title: d.title ?? query,
          year:  d.date ? parseInt(d.date.slice(0, 4)) : null,
          sub:   d['artist-credit']?.[0]?.artist?.name ?? null,
        }));
      }
      if (type === 'game' && settings['api.rawg']) {
        const res = await fetch(`https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&page_size=3&key=${settings['api.rawg']}`);
        const data = await res.json() as { results?: { name?: string; released?: string; platforms?: { platform?: { name?: string } }[] }[] };
        return (data.results ?? []).slice(0, 3).map(d => ({
          title: d.name ?? query,
          year:  d.released ? parseInt(d.released.slice(0, 4)) : null,
          sub:   d.platforms?.[0]?.platform?.name ?? null,
        }));
      }
      if (type === 'movie' && settings['api.omdb']) {
        const res = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${settings['api.omdb']}&type=movie`);
        const data = await res.json() as { Search?: { Title?: string; Year?: string }[] };
        return (data.Search ?? []).slice(0, 3).map(d => ({
          title: d.Title ?? query,
          year:  d.Year ? parseInt(d.Year) : null,
          sub:   null,
        }));
      }
      return null;
    } catch (e) {
      console.warn('[HODD lookup]', type, (e as Error).message);
      return null;
    }
  });
}

// ─── Boot ──────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await db.initDb();
    console.log('[HODD] Database ready');
  } catch (e) {
    console.error('[HODD] Database init failed:', e);
  }

  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
