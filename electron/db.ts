import { createRequire } from 'node:module';
import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SqlJsStatic, Database } from 'sql.js';

const _require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type SqlValue = string | number | null | Uint8Array;
function sv(v: unknown): SqlValue {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (v instanceof Uint8Array) return v;
  return String(v);
}

let db: Database;
let SQL: SqlJsStatic;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function dbFilePath(): string {
  return path.join(app.getPath('userData'), 'hodd.db');
}

function dataFilePath(name: string): string {
  const devPath = path.join(__dirname, '../public/data', name);
  if (existsSync(devPath)) return devPath;
  return path.join(__dirname, '../dist/data', name);
}

async function readDataJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(dataFilePath(name), 'utf8'));
}

export function scheduleWrite(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const dir = path.dirname(dbFilePath());
      mkdirSync(dir, { recursive: true });
      writeFileSync(dbFilePath(), Buffer.from(db.export()));
    } catch (e) {
      console.error('[HODD DB] write error:', e);
    }
    saveTimer = null;
  }, 400);
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS catalog (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    sub TEXT,
    year INTEGER,
    type TEXT,
    color TEXT,
    series TEXT,
    region TEXT
  );

  CREATE TABLE IF NOT EXISTS holdings (
    item_id TEXT PRIMARY KEY,
    format TEXT,
    completeness TEXT,
    grade TEXT,
    pressing TEXT,
    edition TEXT,
    condition_val TEXT,
    acquired TEXT,
    watched INTEGER,
    custom TEXT
  );

  CREATE TABLE IF NOT EXISTS catalog_overrides (
    item_id TEXT PRIMARY KEY,
    title TEXT,
    sub TEXT,
    year INTEGER,
    type TEXT
  );

  CREATE TABLE IF NOT EXISTS stories (
    item_id TEXT PRIMARY KEY,
    paragraphs TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS base_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    accent TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other',
    accent TEXT NOT NULL,
    template TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS user_items (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    sub TEXT,
    year INTEGER,
    type TEXT,
    color TEXT,
    owned INTEGER NOT NULL DEFAULT 1,
    format TEXT,
    completeness TEXT,
    grade TEXT,
    pressing TEXT,
    edition TEXT,
    condition_val TEXT,
    acquired TEXT,
    watched INTEGER,
    custom TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favorites (
    item_id TEXT PRIMARY KEY
  );
`;

// Items beyond catalog.json — replaces the old FALLBACK mock data
const EXTRA_CATALOG = [
  // Movies
  { id: "movie-dune21",    collectionId: "movies", title: "Dune: Part One",            type: "movie", sub: "Denis Villeneuve",  year: 2021, color: "#C77A2E" },
  { id: "movie-enemy",     collectionId: "movies", title: "Enemy",                      type: "movie", sub: "Denis Villeneuve",  year: 2013, color: "#3A2E2A" },
  { id: "movie-inter",     collectionId: "movies", title: "Interstellar",               type: "movie", sub: "Christopher Nolan", year: 2014, color: "#3A4A66" },
  { id: "movie-northman",  collectionId: "movies", title: "The Northman",               type: "movie", sub: "Robert Eggers",     year: 2022, color: "#2A2A2A" },
  { id: "movie-drive",     collectionId: "movies", title: "Drive",                      type: "movie", sub: "Nicolas W. Refn",   year: 2011, color: "#CF6B5A" },
  { id: "movie-annihil",   collectionId: "movies", title: "Annihilation",               type: "movie", sub: "Alex Garland",      year: 2018, color: "#3B9C6D" },
  // Games
  { id: "game-metroid2",   collectionId: "games",  title: "Metroid II",                 type: "game",  sub: "Game Boy",          year: 1991, color: "#7A2E2A" },
  { id: "game-tetris",     collectionId: "games",  title: "Tetris",                     type: "game",  sub: "Game Boy",          year: 1989, color: "#C77A2E" },
  { id: "game-warioland",  collectionId: "games",  title: "Wario Land",                 type: "game",  sub: "Game Boy",          year: 1994, color: "#D4A02A" },
  { id: "game-kirby",      collectionId: "games",  title: "Kirby's Dream Land",         type: "game",  sub: "Game Boy",          year: 1992, color: "#CF6B5A" },
  { id: "game-dkgb",       collectionId: "games",  title: "Donkey Kong",                type: "game",  sub: "Game Boy",          year: 1994, color: "#9B7BD4" },
  { id: "game-sml",        collectionId: "games",  title: "Super Mario Land",           type: "game",  sub: "Game Boy",          year: 1989, color: "#C77A2E" },
  { id: "game-castlegb",   collectionId: "games",  title: "Castlevania Adventure",      type: "game",  sub: "Game Boy",          year: 1989, color: "#7A2E2A" },
  // Coins
  { id: "coin-mercdime",   collectionId: "coins",  title: "Mercury Dime 1942",          type: "coin",  sub: "Philadelphia Mint",  year: 1942, color: "#B0AFA8" },
  { id: "coin-buffnick",   collectionId: "coins",  title: "Buffalo Nickel 1936",        type: "coin",  sub: "Denver Mint",        year: 1936, color: "#A9A8A2" },
  { id: "coin-indianhead", collectionId: "coins",  title: "Indian Head Penny",          type: "coin",  sub: "Philadelphia Mint",  year: 1907, color: "#C9A24C" },
  { id: "coin-barhalf",    collectionId: "coins",  title: "Barber Half Dollar",         type: "coin",  sub: "San Francisco Mint", year: 1899, color: "#A9A8A2" },
  { id: "coin-standlib",   collectionId: "coins",  title: "Standing Liberty Quarter",   type: "coin",  sub: "Denver Mint",        year: 1917, color: "#B0AFA8" },
  // Comics — entirely new
  { id: "comic-saga1",     collectionId: "comics", title: "Saga #1",                    type: "comic", sub: "Image Comics",       year: 2012, color: "#CF6B5A" },
  { id: "comic-sandman1",  collectionId: "comics", title: "Sandman #1",                 type: "comic", sub: "DC / Vertigo",       year: 1989, color: "#2E3440" },
  { id: "comic-watchmen",  collectionId: "comics", title: "Watchmen #1",                type: "comic", sub: "DC Comics",          year: 1986, color: "#7A5A3A" },
  { id: "comic-daytripper",collectionId: "comics", title: "Daytripper",                 type: "comic", sub: "DC / Vertigo",       year: 2010, color: "#5BA47A" },
  { id: "comic-hellboy",   collectionId: "comics", title: "Hellboy Vol. 1",             type: "comic", sub: "Dark Horse",         year: 1994, color: "#C0392B" },
  { id: "comic-bone",      collectionId: "comics", title: "Bone Vol. 1",                type: "comic", sub: "Cartoon Books",      year: 1991, color: "#C9A24C" },
  { id: "comic-lockekey",  collectionId: "comics", title: "Locke & Key Vol. 1",         type: "comic", sub: "IDW",               year: 2008, color: "#5C8AD6" },
  { id: "comic-papergirls",collectionId: "comics", title: "Paper Girls Vol. 1",         type: "comic", sub: "Image Comics",       year: 2015, color: "#CF6B5A" },
  // Vinyl extras
  { id: "vinyl-rumours",   collectionId: "vinyl",  title: "Rumours",                    type: "vinyl", sub: "Fleetwood Mac",      year: 1977, color: "#C9A24C" },
  { id: "vinyl-okcomputer",collectionId: "vinyl",  title: "OK Computer",                type: "vinyl", sub: "Radiohead",          year: 1997, color: "#5C8AD6" },
  { id: "vinyl-inrainbows",collectionId: "vinyl",  title: "In Rainbows",                type: "vinyl", sub: "Radiohead",          year: 2007, color: "#CF6B5A" },
  { id: "vinyl-ram",       collectionId: "vinyl",  title: "Random Access Memories",     type: "vinyl", sub: "Daft Punk",          year: 2013, color: "#C9A24C" },
  { id: "vinyl-discovery", collectionId: "vinyl",  title: "Discovery",                  type: "vinyl", sub: "Daft Punk",          year: 2001, color: "#C77A2E" },
  { id: "vinyl-currents",  collectionId: "vinyl",  title: "Currents",                   type: "vinyl", sub: "Tame Impala",        year: 2015, color: "#5BA47A" },
  // Book extras
  { id: "book-hyperion",   collectionId: "books",  title: "Hyperion",                   type: "book",  sub: "Dan Simmons",        year: 1989, color: "#7A5A3A" },
  { id: "book-neuro",      collectionId: "books",  title: "Neuromancer",                type: "book",  sub: "William Gibson",     year: 1984, color: "#2E3440" },
  { id: "book-snowcrash",  collectionId: "books",  title: "Snow Crash",                 type: "book",  sub: "Neal Stephenson",    year: 1992, color: "#5C8AD6" },
  { id: "book-lefthand",   collectionId: "books",  title: "The Left Hand of Darkness",  type: "book",  sub: "Ursula K. Le Guin",  year: 1969, color: "#3B9C6D" },
  { id: "book-solaris",    collectionId: "books",  title: "Solaris",                    type: "book",  sub: "Stanisław Lem",      year: 1961, color: "#A9A8A2" },
];

// Seed holdings for extra catalog items (partial, realistic coverage)
const EXTRA_HOLDINGS: Record<string, Record<string, unknown>> = {
  "movie-inter":    { format: "4K Blu-ray", watched: 1 },
  "movie-drive":    { format: "Blu-ray",    watched: 0 },
  "movie-dune21":   { format: "4K Blu-ray", watched: 0 },
  "movie-enemy":    { format: "Blu-ray",    watched: 1 },
  "game-metroid2":  { format: "Cartridge",  completeness: "Loose" },
  "game-sml":       { format: "Cartridge",  completeness: "Complete in box" },
  "coin-mercdime":  { grade: "MS-63" },
  "coin-buffnick":  { grade: "MS-62" },
  "comic-sandman1": { condition_val: "Very Fine" },
  "comic-watchmen": { condition_val: "Near Mint" },
  "vinyl-rumours":  { format: "Vinyl LP",   pressing: "180g" },
  "vinyl-okcomputer":{ format: "Vinyl LP",  pressing: "Standard" },
  "book-hyperion":  { format: "Paperback" },
  "book-snowcrash": { format: "Hardcover" },
};

const BASE_COLLECTIONS = [
  { id: "pokemon", name: "Pokémon Games", type: "game",  accent: "#B23A36", display_order: 0 },
  { id: "books",   name: "Books",         type: "book",  accent: "#5BA47A", display_order: 1 },
  { id: "movies",  name: "Movies",        type: "movie", accent: "#5C8AD6", display_order: 2 },
  { id: "games",   name: "Games",         type: "game",  accent: "#9B7BD4", display_order: 3 },
  { id: "coins",   name: "Coins",         type: "coin",  accent: "#C9A24C", display_order: 4 },
  { id: "comics",  name: "Comics",        type: "comic", accent: "#CF6B5A", display_order: 5 },
  { id: "vinyl",   name: "Vinyl",         type: "vinyl", accent: "#7FB0C4", display_order: 6 },
];

export async function initDb(): Promise<void> {
  const initSqlJs = _require('sql.js/dist/sql-asm.js') as () => Promise<SqlJsStatic>;
  SQL = await initSqlJs();

  const fp = dbFilePath();
  if (existsSync(fp)) {
    db = new SQL.Database(readFileSync(fp));
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA);

  // Migrations — safe to run on every boot (ALTER TABLE fails silently if column exists)
  for (const col of ['series TEXT', 'region TEXT']) {
    try { db.run(`ALTER TABLE catalog_overrides ADD COLUMN ${col}`); } catch (_) {}
    try { db.run(`ALTER TABLE user_items ADD COLUMN ${col}`); } catch (_) {}
  }

  // Check if seeded
  const seeded = db.exec("SELECT value FROM meta WHERE key = 'seeded'");
  if (!seeded.length || !seeded[0].values.length) {
    await seedFromJson();
    db.run("INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', '1')");
    scheduleWrite();
  }
}

async function seedFromJson(): Promise<void> {
  // Seed base collections
  const insertColl = db.prepare(
    'INSERT OR IGNORE INTO base_collections (id, name, type, accent, display_order) VALUES (?, ?, ?, ?, ?)'
  );
  for (const c of BASE_COLLECTIONS) {
    insertColl.run([c.id, c.name, c.type, c.accent, c.display_order]);
  }
  insertColl.free();

  // Seed catalog from catalog.json
  const catalogData = (await readDataJson('catalog.json') as { data: Record<string, unknown>[] }).data;
  const insertCat = db.prepare(
    'INSERT OR IGNORE INTO catalog (id, collection_id, title, sub, year, type, color, series, region) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const item of catalogData) {
    insertCat.run([
      item.id as string,
      item.collectionId as string,
      item.title as string,
      (item.sub as string) ?? null,
      (item.year as number) ?? null,
      (item.type as string) ?? null,
      (item.color as string) ?? null,
      (item.series as string) ?? null,
      (item.region as string) ?? null,
    ]);
  }
  // Seed extra catalog items
  for (const item of EXTRA_CATALOG) {
    insertCat.run([
      item.id, item.collectionId, item.title,
      item.sub ?? null, item.year ?? null, item.type ?? null,
      item.color ?? null, null, null,
    ]);
  }
  insertCat.free();

  // Seed holdings from holdings.json
  const holdingsData = (await readDataJson('holdings.json') as { data: Record<string, Record<string, unknown>> }).data;
  const insertHolding = db.prepare(
    'INSERT OR IGNORE INTO holdings (item_id, format, completeness, grade, pressing, edition, condition_val, acquired, watched, custom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const [id, h] of Object.entries(holdingsData)) {
    insertHolding.run([
      id,
      (h.format as string) ?? null,
      (h.completeness as string) ?? null,
      (h.grade as string) ?? null,
      (h.pressing as string) ?? null,
      (h.edition as string) ?? null,
      (h.condition as string) ?? null,
      (h.acquired as string) ?? null,
      h.watched == null ? null : (h.watched ? 1 : 0),
      h.custom ? JSON.stringify(h.custom) : null,
    ]);
  }
  // Seed extra holdings
  for (const [id, h] of Object.entries(EXTRA_HOLDINGS)) {
    insertHolding.run([
      id,
      (h.format as string) ?? null,
      (h.completeness as string) ?? null,
      (h.grade as string) ?? null,
      (h.pressing as string) ?? null,
      (h.edition as string) ?? null,
      (h.condition_val as string) ?? null,
      (h.acquired as string) ?? null,
      h.watched == null ? null : (h.watched ? 1 : 0),
      h.custom ? JSON.stringify(h.custom) : null,
    ]);
  }
  insertHolding.free();

  // Seed stories from stories.json
  try {
    const storiesData = (await readDataJson('stories.json') as { data: Record<string, string[]> }).data;
    const insertStory = db.prepare('INSERT OR IGNORE INTO stories (item_id, paragraphs) VALUES (?, ?)');
    for (const [id, paragraphs] of Object.entries(storiesData)) {
      insertStory.run([id, JSON.stringify(paragraphs)]);
    }
    insertStory.free();
  } catch (_) { /* stories.json optional */ }

  // Seed user profile in settings
  try {
    const userData = (await readDataJson('user.json') as { data: Record<string, string> }).data;
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run(['user.id',     userData.id ?? 'local']);
    insertSetting.run(['user.name',   userData.name ?? 'Collector']);
    insertSetting.run(['user.joined', userData.joined ?? String(new Date().getFullYear())]);
    insertSetting.free();
  } catch (_) { /* user.json optional */ }
}

// ─── READ OPERATIONS ───────────────────────────────────────────────────────

export function getCatalog(): Record<string, unknown>[] {
  const res = db.exec('SELECT id, collection_id, title, sub, year, type, color, series, region FROM catalog ORDER BY collection_id, year');
  if (!res.length) return [];
  const [{ columns, values }] = res;
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      // map snake_case → camelCase for collectionId
      const key = col === 'collection_id' ? 'collectionId' : col;
      obj[key] = row[i];
    });
    return obj;
  });
}

export function getHoldings(): Record<string, Record<string, unknown>> {
  const res = db.exec('SELECT item_id, format, completeness, grade, pressing, edition, condition_val, acquired, watched, custom FROM holdings');
  if (!res.length) return {};
  const [{ columns, values }] = res;
  const map: Record<string, Record<string, unknown>> = {};
  for (const row of values) {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      const key = col === 'condition_val' ? 'condition' : col;
      obj[key] = row[i];
    });
    const id = obj.item_id as string;
    delete obj.item_id;
    if (obj.watched !== null) obj.watched = obj.watched === 1;
    if (obj.custom) { try { obj.custom = JSON.parse(obj.custom as string); } catch (_) {} }
    map[id] = obj;
  }
  return map;
}

export function getCatalogOverrides(): Record<string, Record<string, unknown>> {
  const res = db.exec('SELECT item_id, title, sub, year, type, series, region FROM catalog_overrides');
  if (!res.length) return {};
  const [{ columns, values }] = res;
  const map: Record<string, Record<string, unknown>> = {};
  for (const row of values) {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    const id = obj.item_id as string;
    delete obj.item_id;
    map[id] = obj;
  }
  return map;
}

export function getStory(itemId: string): string[] | null {
  const res = db.exec('SELECT paragraphs FROM stories WHERE item_id = ?', [itemId]);
  if (!res.length || !res[0].values.length) return null;
  try { return JSON.parse(res[0].values[0][0] as string) as string[]; } catch (_) { return null; }
}

export function getUserCollections(): Record<string, unknown>[] {
  const res = db.exec('SELECT id, name, type, accent, template, created_at FROM user_collections ORDER BY created_at');
  if (!res.length) return [];
  const [{ columns, values }] = res;
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    try { obj.template = JSON.parse(obj.template as string); } catch (_) { obj.template = []; }
    obj.user = true;
    return obj;
  });
}

export function getUserItems(): Record<string, Record<string, unknown>[]> {
  const res = db.exec('SELECT id, collection_id, title, sub, year, type, color, owned, format, completeness, grade, pressing, edition, condition_val, acquired, watched, custom, series, region FROM user_items ORDER BY collection_id, created_at');
  if (!res.length) return {};
  const [{ columns, values }] = res;
  const map: Record<string, Record<string, unknown>[]> = {};
  for (const row of values) {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      const key = col === 'condition_val' ? 'condition' : col === 'collection_id' ? 'collectionId' : col;
      obj[key] = row[i];
    });
    obj.owned = obj.owned === 1;
    if (obj.watched !== null) obj.watched = obj.watched === 1;
    if (obj.custom) { try { obj.custom = JSON.parse(obj.custom as string); } catch (_) {} }
    delete obj.created_at;
    const collId = obj.collectionId as string;
    if (!map[collId]) map[collId] = [];
    map[collId].push(obj);
  }
  return map;
}

export function getBaseCollections(): Record<string, unknown>[] {
  const res = db.exec('SELECT id, name, type, accent FROM base_collections ORDER BY display_order');
  if (!res.length) return [];
  const [{ columns, values }] = res;
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

export function getSettings(): Record<string, string> {
  const res = db.exec('SELECT key, value FROM settings');
  if (!res.length) return {};
  return Object.fromEntries(res[0].values.map(row => [row[0] as string, row[1] as string]));
}

// ─── WRITE OPERATIONS ──────────────────────────────────────────────────────

export function saveHolding(itemId: string, patch: Record<string, unknown>): void {
  const existing = db.exec('SELECT * FROM holdings WHERE item_id = ?', [itemId]);
  if (existing.length && existing[0].values.length) {
    // Map column names to current values
    const cols = existing[0].columns;
    const vals = existing[0].values[0];
    const cur: Record<string, unknown> = {};
    cols.forEach((c, i) => { cur[c] = vals[i]; });
    const merged = { ...cur, ...Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k === 'condition' ? 'condition_val' : k, v])
    )};
    if (merged.watched !== null && merged.watched !== undefined) {
      merged.watched = merged.watched ? 1 : 0;
    }
    if (merged.custom && typeof merged.custom !== 'string') merged.custom = JSON.stringify(merged.custom);
    db.run(`UPDATE holdings SET format=?, completeness=?, grade=?, pressing=?, edition=?,
      condition_val=?, acquired=?, watched=?, custom=? WHERE item_id=?`, [
      sv(merged.format), sv(merged.completeness), sv(merged.grade),
      sv(merged.pressing), sv(merged.edition), sv(merged.condition_val),
      sv(merged.acquired), sv(merged.watched), sv(merged.custom), itemId,
    ]);
  } else {
    const w = patch.watched;
    db.run(`INSERT INTO holdings (item_id, format, completeness, grade, pressing, edition,
      condition_val, acquired, watched, custom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      itemId,
      sv(patch.format), sv(patch.completeness), sv(patch.grade),
      sv(patch.pressing), sv(patch.edition), sv(patch.condition),
      sv(patch.acquired),
      w == null ? null : (w ? 1 : 0),
      patch.custom ? JSON.stringify(patch.custom) : null,
    ]);
  }
  scheduleWrite();
}

export function removeHolding(itemId: string): void {
  db.run('DELETE FROM holdings WHERE item_id = ?', [itemId]);
  scheduleWrite();
}

export function saveCatalogOverride(itemId: string, patch: Record<string, unknown>): void {
  const existing = db.exec('SELECT * FROM catalog_overrides WHERE item_id = ?', [itemId]);
  if (existing.length && existing[0].values.length) {
    const cols = existing[0].columns;
    const vals = existing[0].values[0];
    const cur: Record<string, unknown> = {};
    cols.forEach((c, i) => { cur[c] = vals[i]; });
    const merged = { ...cur, ...patch };
    db.run('UPDATE catalog_overrides SET title=?, sub=?, year=?, type=?, series=?, region=? WHERE item_id=?', [
      sv(merged.title), sv(merged.sub), sv(merged.year), sv(merged.type),
      sv(merged.series), sv(merged.region), itemId,
    ]);
  } else {
    db.run('INSERT INTO catalog_overrides (item_id, title, sub, year, type, series, region) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      itemId, sv(patch.title), sv(patch.sub), sv(patch.year), sv(patch.type),
      sv(patch.series), sv(patch.region),
    ]);
  }
  scheduleWrite();
}

export function saveStory(itemId: string, paragraphs: string[]): void {
  db.run('INSERT OR REPLACE INTO stories (item_id, paragraphs) VALUES (?, ?)', [itemId, JSON.stringify(paragraphs)]);
  scheduleWrite();
}

export function createCollection(def: { name: string; type: string; accent: string; template: string[] }): Record<string, unknown> {
  const existing = getUserCollections();
  const taken = new Set(existing.map(c => c.id as string));
  const base = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'coll';
  let id = 'u-' + base; let n = 2;
  while (taken.has(id)) { id = 'u-' + base + '-' + n; n++; }
  const name = (def.name || '').trim() || 'Untitled collection';
  const template = JSON.stringify((def.template || []).map(s => String(s).trim()).filter(Boolean));
  db.run('INSERT INTO user_collections (id, name, type, accent, template) VALUES (?, ?, ?, ?, ?)', [
    id, name, def.type || 'other', def.accent || '#6366f1', template,
  ]);
  scheduleWrite();
  return { id, name, type: def.type || 'other', accent: def.accent || '#6366f1', template: JSON.parse(template), user: true };
}

export function deleteUserCollection(collectionId: string): void {
  // Cascade: gather all item IDs first
  const rows = db.exec('SELECT id FROM user_items WHERE collection_id = ?', [collectionId]);
  const ids: string[] = rows.length ? rows[0].values.map(r => r[0] as string) : [];
  for (const id of ids) {
    db.run('DELETE FROM holdings WHERE item_id = ?', [id]);
    db.run('DELETE FROM stories WHERE item_id = ?', [id]);
    db.run('DELETE FROM favorites WHERE item_id = ?', [id]);
    db.run('DELETE FROM catalog_overrides WHERE item_id = ?', [id]);
  }
  db.run('DELETE FROM user_items WHERE collection_id = ?', [collectionId]);
  db.run('DELETE FROM user_collections WHERE id = ?', [collectionId]);
  scheduleWrite();
}

export function addUserItem(collectionId: string, draft: Record<string, unknown>): Record<string, unknown> {
  const id = 'i-' + Math.random().toString(36).slice(2, 9);
  const w = draft.watched;
  db.run(`INSERT INTO user_items (id, collection_id, title, sub, year, type, color, owned,
    format, completeness, grade, pressing, edition, condition_val, acquired, watched, custom, series, region)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, collectionId,
    sv(draft.title) ?? '', sv(draft.sub), sv(draft.year),
    sv(draft.type), sv(draft.color),
    draft.owned !== false ? 1 : 0,
    sv(draft.format), sv(draft.completeness), sv(draft.grade),
    sv(draft.pressing), sv(draft.edition), sv(draft.condition),
    sv(draft.acquired),
    w == null ? null : (w ? 1 : 0),
    draft.custom ? JSON.stringify(draft.custom) : null,
    sv(draft.series), sv(draft.region),
  ]);
  scheduleWrite();
  return { ...draft, id, collectionId, owned: draft.owned !== false };
}

export function setUserItemOwned(id: string, owned: boolean): void {
  db.run('UPDATE user_items SET owned = ? WHERE id = ?', [owned ? 1 : 0, id]);
  scheduleWrite();
}

export function updateUserItemFields(id: string, fields: Record<string, unknown>): void {
  const allowed: Record<string, 'text' | 'int'> = {
    title: 'text', sub: 'text', year: 'int', type: 'text',
    series: 'text', region: 'text', color: 'text',
  };
  const cols = Object.keys(fields).filter(k => k in allowed);
  if (!cols.length) return;
  const vals = cols.map(c => {
    const v = fields[c];
    if (v == null || v === '') return null;
    return allowed[c] === 'int' ? Number(v) : String(v);
  });
  db.run(`UPDATE user_items SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...vals, id]);
  // Remove any legacy catalog_override for this user item so it can't override direct fields
  db.run('DELETE FROM catalog_overrides WHERE item_id = ?', [id]);
  scheduleWrite();
}

export function deleteUserItem(id: string): void {
  db.run('DELETE FROM user_items WHERE id = ?', [id]);
  db.run('DELETE FROM holdings WHERE item_id = ?', [id]);
  db.run('DELETE FROM catalog_overrides WHERE item_id = ?', [id]);
  db.run('DELETE FROM stories WHERE item_id = ?', [id]);
  db.run('DELETE FROM favorites WHERE item_id = ?', [id]);
  scheduleWrite();
}

export function saveSetting(key: string, value: string): void {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  scheduleWrite();
}

export function getFavorites(): string[] {
  const res = db.exec('SELECT item_id FROM favorites');
  if (!res.length) return [];
  return res[0].values.map(row => row[0] as string);
}

export function addFavorite(itemId: string): void {
  db.run('INSERT OR IGNORE INTO favorites (item_id) VALUES (?)', [itemId]);
  scheduleWrite();
}

export function removeFavorite(itemId: string): void {
  db.run('DELETE FROM favorites WHERE item_id = ?', [itemId]);
  scheduleWrite();
}

export function importArchive(payload: Record<string, unknown>): { imported: number } {
  // Replace all user-generated data with the archive contents
  db.run('DELETE FROM user_items');
  db.run('DELETE FROM user_collections');
  db.run('DELETE FROM holdings');
  db.run('DELETE FROM catalog_overrides');

  let count = 0;

  // User collections
  const cols = (payload.userCollections as Record<string, unknown>[]) || [];
  for (const c of cols) {
    const tmpl = Array.isArray(c.template) ? JSON.stringify(c.template) : (typeof c.template === 'string' ? c.template : '[]');
    db.run(
      'INSERT OR REPLACE INTO user_collections (id, name, type, accent, template, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sv(c.id), sv(c.name) ?? 'Collection', sv(c.type) ?? 'other', sv(c.accent) ?? '#6366f1', tmpl, sv(c.created_at) ?? new Date().toISOString()]
    );
  }

  // User items (created_at omitted — SQLite DEFAULT applies)
  const items = (payload.userItems as Record<string, Record<string, unknown>[]>) || {};
  for (const [collId, collItems] of Object.entries(items)) {
    for (const it of (collItems || [])) {
      const w = it.watched;
      db.run(`INSERT OR REPLACE INTO user_items
        (id, collection_id, title, sub, year, type, color, owned,
         format, completeness, grade, pressing, edition, condition_val,
         acquired, watched, custom, series, region)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        sv(it.id), collId,
        sv(it.title) ?? '', sv(it.sub), sv(it.year), sv(it.type), sv(it.color),
        it.owned !== false ? 1 : 0,
        sv(it.format), sv(it.completeness), sv(it.grade),
        sv(it.pressing), sv(it.edition), sv(it.condition),
        sv(it.acquired),
        w == null ? null : (w ? 1 : 0),
        it.custom ? JSON.stringify(it.custom) : null,
        sv(it.series), sv(it.region),
      ]);
      count++;
    }
  }

  // Holdings (catalog items + any user items that had separate holding edits)
  const holdings = (payload.holdings as Record<string, Record<string, unknown>>) || {};
  for (const [id, h] of Object.entries(holdings)) {
    const w = h.watched;
    db.run(`INSERT OR REPLACE INTO holdings
      (item_id, format, completeness, grade, pressing, edition,
       condition_val, acquired, watched, custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id,
      sv(h.format), sv(h.completeness), sv(h.grade),
      sv(h.pressing), sv(h.edition), sv(h.condition),
      sv(h.acquired),
      w == null ? null : (w ? 1 : 0),
      h.custom ? JSON.stringify(h.custom) : null,
    ]);
  }

  // Catalog overrides
  const overrides = (payload.catalogOverrides as Record<string, Record<string, unknown>>) || {};
  for (const [id, patch] of Object.entries(overrides)) {
    db.run('INSERT OR REPLACE INTO catalog_overrides (item_id, title, sub, year, type, series, region) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      id, sv(patch.title), sv(patch.sub), sv(patch.year), sv(patch.type),
      sv(patch.series), sv(patch.region),
    ]);
  }

  // Stories (only restore if the archive includes them, to protect against old-format imports)
  const stories = payload.stories as Record<string, unknown> | undefined;
  if (stories && Object.keys(stories).length > 0) {
    db.run('DELETE FROM stories');
    for (const [id, paragraphs] of Object.entries(stories)) {
      if (Array.isArray(paragraphs)) {
        db.run('INSERT OR REPLACE INTO stories (item_id, paragraphs) VALUES (?, ?)', [id, JSON.stringify(paragraphs)]);
      }
    }
  }

  // User profile settings
  const user = payload.user as Record<string, unknown> | undefined;
  if (user?.name)   db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['user.name',   sv(user.name)]);
  if (user?.joined) db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['user.joined', sv(user.joined)]);

  scheduleWrite();
  return { imported: count };
}

export function getRecentUserItems(limit = 6): Record<string, unknown>[] {
  const res = db.exec(
    'SELECT id, collection_id, title, sub, year, type, color, owned, acquired, series, region, created_at FROM user_items ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  if (!res.length) return [];
  const [{ columns, values }] = res;
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      const key = col === 'collection_id' ? 'collectionId' : col;
      obj[key] = row[i];
    });
    obj.owned = obj.owned === 1;
    return obj;
  });
}

export function getAllStories(): Record<string, string[]> {
  const res = db.exec('SELECT item_id, paragraphs FROM stories');
  if (!res.length) return {};
  const map: Record<string, string[]> = {};
  for (const row of res[0].values) {
    try { map[row[0] as string] = JSON.parse(row[1] as string) as string[]; } catch (_) {}
  }
  return map;
}

export function getAllUserItemsWithTimestamps(): Record<string, unknown>[] {
  const res = db.exec(
    'SELECT id, collection_id, title, sub, year, type, color, owned, format, acquired, series, region, created_at FROM user_items ORDER BY created_at DESC'
  );
  if (!res.length) return [];
  const [{ columns, values }] = res;
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      const key = col === 'collection_id' ? 'collectionId' : col;
      obj[key] = row[i];
    });
    obj.owned = obj.owned === 1;
    return obj;
  });
}
