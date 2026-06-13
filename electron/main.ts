import { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, protocol, shell } from 'electron';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Must run before app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'hodd-img', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true } },
]);
import { spawn, ChildProcess } from 'node:child_process';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let activeInstallProc: ChildProcess | null = null;
let activeServeProc: ChildProcess | null = null;
let appManagedServe = false;

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
      sandbox: false,
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
  // Serve user-uploaded images via hodd-img:// protocol
  protocol.handle('hodd-img', (req) => {
    const filename = path.basename(decodeURIComponent(req.url.slice('hodd-img://'.length)));
    const imagePath = path.join(app.getPath('userData'), 'images', filename);
    return net.fetch(pathToFileURL(imagePath).toString());
  });

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
  ipcMain.handle('hodd:collection:delete', (_e, id: string) => db.deleteUserCollection(id));
  ipcMain.handle('hodd:item:add',        (_e, collId: string, draft: Record<string, unknown>) => db.addUserItem(collId, draft));
  ipcMain.handle('hodd:item:delete', async (_e, id: string) => {
    const { cover_url, gallery } = db.getItemImages(id);
    db.deleteUserItem(id);
    const imagesDir = path.join(app.getPath('userData'), 'images');
    const toDelete = new Set([...gallery]);
    if (cover_url) toDelete.add(cover_url);
    for (const filename of toDelete) {
      try { await fs.unlink(path.join(imagesDir, path.basename(filename))); } catch (_) {}
    }
  });
  ipcMain.handle('hodd:item:set-owned',    (_e, id: string, owned: boolean)                       => db.setUserItemOwned(id, owned));
  ipcMain.handle('hodd:item:update-fields',(_e, id: string, fields: Record<string, unknown>)      => db.updateUserItemFields(id, fields));
  ipcMain.handle('hodd:setting:save',    (_e, key: string, value: string)                 => db.saveSetting(key, value));
  ipcMain.handle('hodd:favorites',                                                          () => db.getFavorites());
  ipcMain.handle('hodd:favorite:add',    (_e, id: string)                                  => db.addFavorite(id));
  ipcMain.handle('hodd:favorite:remove', (_e, id: string)                                  => db.removeFavorite(id));

  // Image pick — copies chosen file(s) to userData/images/, returns filenames
  ipcMain.handle('hodd:image:pick', async (_e, multi = false) => {
    const result = await dialog.showOpenDialog({
      title: 'Choose photo',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'avif'] }],
      properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true, files: [] };
    const imagesDir = path.join(app.getPath('userData'), 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    const saved: string[] = [];
    for (const src of result.filePaths) {
      const ext = path.extname(src).toLowerCase() || '.jpg';
      const name = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      await fs.copyFile(src, path.join(imagesDir, name));
      saved.push(name);
    }
    return { canceled: false, files: saved };
  });

  // Image delete — removes a single image file from userData/images/
  ipcMain.handle('hodd:image:delete', async (_e, filename: string) => {
    const safeName = path.basename(filename);
    if (!safeName) return { ok: false };
    try {
      await fs.unlink(path.join(app.getPath('userData'), 'images', safeName));
      return { ok: true };
    } catch (_) { return { ok: false }; }
  });

  // Title bar theme (Windows only — keeps overlay in sync with in-app dark mode)
  ipcMain.handle('hodd:titlebar:set-theme', (_e, theme: 'light' | 'dark') => {
    if (process.platform === 'darwin' || !mainWindow) return;
    mainWindow.setTitleBarOverlay(titleBarOverlay(theme === 'dark'));
  });

  // Archive export — bundles referenced images as base64 under an `images` key
  ipcMain.handle('hodd:archive:export', async (_event, payload: Record<string, unknown>) => {
    const result = await dialog.showSaveDialog({
      title: 'Export HODD archive',
      defaultPath: `hodd-archive-${new Date().toISOString().slice(0, 10)}.hodd`,
      filters: [{ name: 'HODD archive', extensions: ['hodd', 'json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };

    // Collect all image filenames referenced anywhere in the payload
    const filenames = new Set<string>();
    const items = (payload.userItems ?? {}) as Record<string, { cover_url?: string; gallery?: string[] }[]>;
    for (const collItems of Object.values(items)) {
      for (const it of collItems ?? []) {
        if (it.cover_url) filenames.add(path.basename(it.cover_url));
        if (Array.isArray(it.gallery)) it.gallery.forEach(f => filenames.add(path.basename(f)));
      }
    }
    const overrides = (payload.catalogOverrides ?? {}) as Record<string, { cover_url?: string; gallery?: string[] }>;
    for (const patch of Object.values(overrides)) {
      if (patch.cover_url) filenames.add(path.basename(patch.cover_url));
      if (Array.isArray(patch.gallery)) patch.gallery.forEach(f => filenames.add(path.basename(f)));
    }

    const imagesDir = path.join(app.getPath('userData'), 'images');
    const images: Record<string, string> = {};
    for (const name of filenames) {
      try {
        const data = await fs.readFile(path.join(imagesDir, name));
        images[name] = data.toString('base64');
      } catch (_) { /* file may have been deleted, skip */ }
    }

    const enriched = { ...payload, version: 2, images };
    await fs.writeFile(result.filePath, JSON.stringify(enriched, null, 2), 'utf8');
    return { canceled: false, path: result.filePath, imageCount: Object.keys(images).length };
  });

  // Archive import — restores images from base64 bundle if present
  ipcMain.handle('hodd:archive:import', async (_event) => {
    const open = await dialog.showOpenDialog({
      title: 'Import HODD archive',
      filters: [{ name: 'HODD archive', extensions: ['hodd', 'json'] }],
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

    // Restore bundled images (v2 archives)
    const images = payload.images as Record<string, string> | undefined;
    if (images && typeof images === 'object') {
      const imagesDir = path.join(app.getPath('userData'), 'images');
      await fs.mkdir(imagesDir, { recursive: true });
      for (const [name, b64] of Object.entries(images)) {
        try {
          const safeName = path.basename(name);
          await fs.writeFile(path.join(imagesDir, safeName), Buffer.from(b64, 'base64'));
        } catch (_) {}
      }
    }

    const { images: _stripped, ...dbPayload } = payload;
    const outcome = db.importArchive(dbPayload as Record<string, unknown>);
    return { canceled: false, imported: outcome.imported, imageCount: images ? Object.keys(images).length : 0 };
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
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
        const candidates = owned.filter(i => !i.created_at || (i.created_at as string) < ninetyDaysAgo);
        const pool = candidates.length ? candidates : owned;
        const pick = pool[Math.floor(Math.random() * pool.length)];
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

  ipcMain.handle('hodd:ollama:check-installed', () => {
    return new Promise<{ installed: boolean }>(resolve => {
      const proc = spawn('ollama', ['--version'], { shell: false });
      proc.on('close', code => resolve({ installed: code === 0 }));
      proc.on('error', () => resolve({ installed: false }));
    });
  });

  ipcMain.handle('hodd:ollama:install', (event, password?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const send = (type: string, data: string) =>
      win?.webContents.send('hodd:ollama:stream', { type, data });

    let cmd: string;
    let args: string[];
    if (process.platform === 'linux') {
      if (password) {
        cmd = 'sudo';
        args = ['-S', 'sh', '-c', 'curl -fsSL https://ollama.com/install.sh | sh'];
      } else {
        cmd = 'sh';
        args = ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'];
      }
    } else if (process.platform === 'darwin') {
      cmd = 'sh';
      args = ['-c', 'which brew >/dev/null 2>&1 && brew install ollama || echo "__NO_BREW__"'];
    } else {
      send('error', 'Automatic install is not supported on Windows. Please download Ollama from ollama.com/download');
      return;
    }

    const proc = spawn(cmd, args, { shell: false });
    activeInstallProc = proc;

    if (password && proc.stdin) {
      proc.stdin.write(password + '\n');
      proc.stdin.end();
    }

    proc.stdout.on('data', (d: Buffer) => send('stdout', d.toString()));
    proc.stderr.on('data', (d: Buffer) => {
      const s = d.toString();
      // sudo writes its password prompt to stderr — suppress it, surface real errors
      if (s.includes('[sudo]') || s.startsWith('\r') || !s.trim()) return;
      // Wrong password
      if (s.toLowerCase().includes('incorrect password') || s.toLowerCase().includes('sorry, try again')) {
        send('auth-error', 'Incorrect password. Please try again.');
        return;
      }
      send('stderr', s);
    });
    proc.on('close', code => {
      activeInstallProc = null;
      if (code === 0) send('done', '');
      else send('error', `Process exited with code ${code}`);
    });
    proc.on('error', e => {
      activeInstallProc = null;
      send('error', e.message);
    });
  });

  ipcMain.handle('hodd:ollama:cancel-install', () => {
    if (activeInstallProc) {
      activeInstallProc.kill('SIGTERM');
      activeInstallProc = null;
    }
  });

  ipcMain.handle('hodd:ollama:start', async () => {
    // Don't double-start
    if (activeServeProc) return { ok: true };

    const proc = spawn('ollama', ['serve'], { shell: false });
    activeServeProc = proc;
    appManagedServe = true;

    proc.on('error', () => { activeServeProc = null; });
    proc.on('close', () => { activeServeProc = null; });

    // Poll until /api/tags responds
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 600));
      try {
        const res = await fetch('http://127.0.0.1:11434/api/tags');
        if (res.ok) return { ok: true };
      } catch {}
    }
    proc.kill();
    activeServeProc = null;
    appManagedServe = false;
    return { ok: false, error: 'Timed out waiting for Ollama to start (15 s)' };
  });

  ipcMain.handle('hodd:ollama:pull', (event, model: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    return new Promise<{ ok: boolean; error?: string }>(resolve => {
      const proc = spawn('ollama', ['pull', model], { shell: false });

      let buf = '';
      proc.stdout.on('data', (d: Buffer) => {
        buf += d.toString();
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line) as {
              status?: string;
              total?: number;
              completed?: number;
            };
            const pct = (obj.total && obj.completed)
              ? Math.round((obj.completed / obj.total) * 100)
              : null;
            win?.webContents.send('hodd:ollama:pull-progress', {
              status: obj.status ?? '',
              pct,
            });
          } catch {
            win?.webContents.send('hodd:ollama:pull-progress', { status: line, pct: null });
          }
        }
      });

      proc.stderr.on('data', (d: Buffer) => {
        win?.webContents.send('hodd:ollama:pull-progress', { status: d.toString().trim(), pct: null });
      });

      proc.on('close', code => resolve(code === 0 ? { ok: true } : { ok: false, error: `ollama pull exited with code ${code}` }));
      proc.on('error', e => resolve({ ok: false, error: e.message }));
    });
  });

  ipcMain.handle('hodd:ollama:stop', () => {
    if (appManagedServe && activeServeProc) {
      activeServeProc.kill('SIGTERM');
      activeServeProc = null;
      appManagedServe = false;
    }
  });

  ipcMain.handle('hodd:reset-all', () => db.clearUserData());

  // Online metadata lookup — free APIs (books/vinyl) + optional key-gated APIs (games/movies)
  ipcMain.handle('hodd:lookup', async (_e, type: string, query: string) => {
    const settings = db.getSettings();
    try {
      if (type === 'book') {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=title,author_name,first_publish_year,cover_i`);
        const data = await res.json() as { docs?: { title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }[] };
        return (data.docs ?? []).slice(0, 3).map(d => ({
          title:     d.title ?? query,
          year:      d.first_publish_year ?? null,
          sub:       d.author_name?.[0] ?? null,
          cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
        }));
      }
      if (type === 'vinyl') {
        const res = await fetch(
          `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=3`,
          { headers: { 'User-Agent': 'HODD-Desktop/1.0 (hodd-app)' } }
        );
        const data = await res.json() as { releases?: { title?: string; date?: string; 'artist-credit'?: { artist?: { name?: string } }[]; id?: string }[] };
        return (data.releases ?? []).slice(0, 3).map(d => ({
          title:     d.title ?? query,
          year:      d.date ? parseInt(d.date.slice(0, 4)) : null,
          sub:       d['artist-credit']?.[0]?.artist?.name ?? null,
          cover_url: d.id ? `https://coverartarchive.org/release/${d.id}/front-250` : null,
        }));
      }
      if (type === 'game' && settings['api.rawg']) {
        const res = await fetch(`https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&page_size=3&key=${settings['api.rawg']}`);
        const data = await res.json() as { results?: { name?: string; released?: string; background_image?: string; platforms?: { platform?: { name?: string } }[] }[] };
        return (data.results ?? []).slice(0, 3).map(d => ({
          title:     d.name ?? query,
          year:      d.released ? parseInt(d.released.slice(0, 4)) : null,
          sub:       d.platforms?.[0]?.platform?.name ?? null,
          cover_url: d.background_image ?? null,
        }));
      }
      if (type === 'movie' && settings['api.omdb']) {
        const res = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${settings['api.omdb']}&type=movie`);
        const data = await res.json() as { Search?: { Title?: string; Year?: string; Poster?: string }[] };
        return (data.Search ?? []).slice(0, 3).map(d => ({
          title:     d.Title ?? query,
          year:      d.Year ? parseInt(d.Year) : null,
          sub:       null,
          cover_url: d.Poster && d.Poster !== 'N/A' ? d.Poster : null,
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

app.on('before-quit', () => {
  if (appManagedServe && activeServeProc) {
    activeServeProc.kill('SIGTERM');
  }
});
