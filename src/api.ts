// Electron IPC data layer. All reads go through an in-memory cache; writes
// update the cache immediately so the UI never waits on IPC, then persist async.

import { toaster } from './toaster';

// ── IPC interface types ───────────────────────────────────────────────────────

interface HoddApi {
  getCatalog(): Promise<CatalogItem[]>;
  getHoldings(): Promise<Record<string, HoldingRecord>>;
  getCatalogOverrides(): Promise<Record<string, Partial<CatalogItem>>>;
  getUserCollections(): Promise<UserCollection[]>;
  getUserItems(): Promise<Record<string, UserItem[]>>;
  getBaseCollections(): Promise<BaseCollection[]>;
  saveHolding(id: string, patch: Partial<HoldingRecord>): Promise<void>;
  removeHolding(id: string): Promise<void>;
  deleteItem(id: string): Promise<void>;
  setItemOwned(id: string, owned: boolean): Promise<void>;
  updateUserItem(id: string, patch: Record<string, unknown>): Promise<void>;
  saveCatalog(id: string, patch: Record<string, unknown>): Promise<void>;
  saveStory(id: string, paragraphs: string[]): Promise<void>;
  saveSetting(key: string, value: unknown): Promise<void>;
  getFavorites(): Promise<string[]>;
  removeFavorite(id: string): Promise<void>;
  addFavorite(id: string): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  createCollection(def: CollectionDef): Promise<{ id: string }>;
  addItem(collectionId: string, draft: Record<string, unknown>): Promise<{ id: string }>;
  getUser(): Promise<UserRecord>;
  getStatsConfig(): Promise<StatsConfig | null>;
  getGrowth(): Promise<GrowthEntry[]>;
  getHomeConfig(): Promise<HomeConfig | null>;
  getHomeDynamic(): Promise<HomeDynamic | null>;
  getTimeline(): Promise<TimelineEntry[]>;
  getStory(id: string): Promise<string[] | null>;
  getSettings(): Promise<Record<string, string>>;
  lookup(type: string, query: string): Promise<unknown>;
  getAllStories(): Promise<Record<string, string[]>>;
  resetAll(): Promise<void>;
  getSuggestions(collectionId: string): Promise<unknown[]>;
  fetchSuggestions(collectionId: string, type: string, ownedItems: OwnedItem[]): Promise<unknown[]>;
}

interface CatalogItem {
  id: string;
  collectionId: string;
  title: string;
  year?: number | null;
  sub?: string | null;
  type?: string;
  region?: string | null;
  series?: string | null;
  color?: string | null;
  rating?: number | null;
  [key: string]: unknown;
}

interface HoldingRecord {
  ownership?: string | null;
  notes?: string | null;
  loan_from?: string | null;
  loan_date?: string | null;
  loan_to?: string | null;
  loan_to_date?: string | null;
  format?: string | null;
  completeness?: string | null;
  grade?: string | null;
  pressing?: string | null;
  edition?: string | null;
  condition?: string | null;
  acquired?: string | null;
  watched?: boolean;
  completed?: boolean;
  custom?: unknown;
  purchase_price?: number | null;
  purchase_currency?: string;
  current_value?: number | null;
  rating?: number | null;
  [key: string]: unknown;
}

interface UserCollection {
  id: string;
  name: string;
  type: string;
  accent: string;
  template: string[];
  user: boolean;
}

interface UserItem {
  id: string;
  collectionId: string;
  owned?: boolean;
  color?: string;
  title?: string;
  year?: number | null;
  sub?: string | null;
  type?: string;
  rating?: number | null;
  watched?: boolean;
  [key: string]: unknown;
}

interface BaseCollection {
  id: string;
  name: string;
  type: string;
  accent?: string;
}

interface CollectionDef {
  name?: string;
  type?: string;
  accent?: string;
  template?: unknown[];
}

interface UserRecord {
  id: string;
  name: string;
  joined: string;
}

interface StatsConfig {
  growth: GrowthEntry[];
  [key: string]: unknown;
}

interface GrowthEntry {
  [key: string]: unknown;
}

interface HomeConfig {
  featured?: unknown;
  recent?: unknown[];
  recentIds?: string[];
  headlineStats?: HeadlineStat[];
  wishlist?: { itemIds?: string[]; items?: unknown[] };
  rediscover?: unknown;
  [key: string]: unknown;
}

interface HomeDynamic {
  recent?: unknown[];
  addedThisMonth?: number;
  rediscover?: unknown;
  [key: string]: unknown;
}

interface HeadlineStat {
  id?: string;
  icon?: string;
  value?: string | number;
  label?: string;
  ring?: number | null;
  unit?: string;
  [key: string]: unknown;
}

interface TimelineEntry {
  [key: string]: unknown;
}

interface OwnedItem {
  title: string;
  series?: string | null;
  sub?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLL_NAME: Record<string, string> = { books: "Books", movies: "Movies", games: "Games", coins: "Coins", comics: "Comics", vinyl: "Vinyl" };
export const HOLDING_FIELDS = ["ownership", "notes", "loan_from", "loan_date", "loan_to", "loan_to_date", "format", "completeness", "grade", "pressing", "edition", "condition", "acquired", "watched", "custom", "purchase_price", "purchase_currency", "current_value"];
const USER_HUES = ["#6366f1", "#5BA47A", "#5C8AD6", "#C9A24C", "#CF6B5A", "#7FB0C4", "#9B7BD4", "#C0392B"];

let _catalog:   CatalogItem[] | null = null;
let _holdings:  Record<string, HoldingRecord> | null = null;
let _catOv:     Record<string, Partial<CatalogItem>> | null = null;
let _userColls: UserCollection[] | null = null;
let _userItems: Record<string, UserItem[]> | null = null;
let _baseCols:  BaseCollection[] | null = null;

function ipc(): HoddApi | undefined { return (window as unknown as { hoddDesktop?: { api?: HoddApi } }).hoddDesktop?.api; }

async function ensureCache(): Promise<void> {
  if (_catalog && _holdings && _catOv && _userColls && _userItems && _baseCols) return;
  const a = ipc();
  if (!a) {
    _catalog = []; _holdings = {}; _catOv = {}; _userColls = []; _userItems = {}; _baseCols = [];
    return;
  }
  const [cat, h, co, uc, ui, bc] = await Promise.all([
    _catalog   || a.getCatalog(),
    _holdings  || a.getHoldings(),
    _catOv     || a.getCatalogOverrides(),
    _userColls || a.getUserCollections(),
    _userItems || a.getUserItems(),
    _baseCols  || a.getBaseCollections(),
  ]);
  _catalog = cat; _holdings = h; _catOv = co; _userColls = uc; _userItems = ui; _baseCols = bc;
}

// Fix 2: _catalog added to invalidateCache
export function invalidateCache(): void { _catalog = null; _holdings = null; _catOv = null; _userColls = null; _userItems = null; _favorites = null; _searchIndex = null; }

export async function resetAllData(): Promise<void> {
  const a = ipc(); if (a) await a.resetAll();
  invalidateCache();
}

export async function getOnboarded(): Promise<boolean> {
  const settings = await getSettings();
  return settings['onboarded'] === '1';
}

// Fix 13: readOverrides was a misleading name — it reads holdings, not overrides. Renamed to readHoldings.
function readHoldings():   Record<string, HoldingRecord> { return _holdings  || {}; }
function readCatalogOv():  Record<string, Partial<CatalogItem>> { return _catOv     || {}; }
function readUserColls():  UserCollection[] { return _userColls || []; }
function readUserItems():  Record<string, UserItem[]> { return _userItems || {}; }

// ── Prompt injection sanitizer ────────────────────────────────────────────────

// Fix 10: sanitize user-supplied strings before embedding in Ollama prompts
function sanitizeForPrompt(s: string, maxLen = 200): string {
  return String(s).replace(/[\n\r`]/g, ' ').slice(0, maxLen);
}

// ── Write operations ─────────────────────────────────────────────────────────

export function saveHolding(id: string, patch: Partial<HoldingRecord>): void {
  const prev = _holdings && _holdings[id] ? { ..._holdings[id] } : undefined;
  if (!_holdings) _holdings = {};
  _holdings[id] = Object.assign({}, _holdings[id] || {}, patch);
  _searchIndex = null;
  const a = ipc();
  if (a) a.saveHolding(id, patch).catch(() => {
    if (_holdings) { if (prev === undefined) delete _holdings[id]; else _holdings[id] = prev; }
    _searchIndex = null;
    toaster.error("Couldn't save changes — please try again.");
  });
}
export function saveRating(id: string, rating: number | null): void {
  _searchIndex = null;
  if (String(id).startsWith("i-")) {
    saveCatalog(id, { rating });
  } else {
    saveHolding(id, { rating });
  }
}
export function removeHolding(id: string): void {
  const prev = _holdings && _holdings[id] ? { ..._holdings[id] } : undefined;
  if (_holdings) delete _holdings[id];
  _searchIndex = null;
  const a = ipc();
  if (a) a.removeHolding(id).catch(() => {
    if (prev !== undefined) { if (!_holdings) _holdings = {}; _holdings[id] = prev; }
    toaster.error("Couldn't remove holding — please try again.");
  });
}

export function removeItem(id: string): void {
  _searchIndex = null;
  const prevItems = _userItems ? JSON.parse(JSON.stringify(_userItems)) as Record<string, UserItem[]> : undefined;
  const prevHolding = _holdings && _holdings[id] ? { ..._holdings[id] } : undefined;
  const prevCatOv = _catOv && _catOv[id] ? { ..._catOv[id] } : undefined;
  const prevFavs = _favorites ? [..._favorites] : undefined;

  if (_userItems) {
    for (const collId of Object.keys(_userItems)) {
      _userItems[collId] = (_userItems[collId] || []).filter(i => i.id !== id);
    }
  }
  if (_holdings) delete _holdings[id];
  if (_catOv) delete _catOv[id];
  if (_favorites) _favorites = _favorites.filter(f => f !== id);
  const a = ipc();
  if (a) a.deleteItem(id).catch(() => {
    if (prevItems !== undefined) _userItems = prevItems;
    if (prevHolding !== undefined) { if (!_holdings) _holdings = {}; _holdings[id] = prevHolding; }
    if (prevCatOv !== undefined) { if (!_catOv) _catOv = {}; _catOv[id] = prevCatOv; }
    if (prevFavs !== undefined) _favorites = prevFavs;
    toaster.error("Couldn't delete item — please try again.");
  });
}

export function setItemOwned(id: string, owned: boolean): void {
  _searchIndex = null;
  const prevOwned = _userItems
    ? Object.values(_userItems).flat().find(i => i.id === id)?.owned
    : undefined;
  if (_userItems) {
    for (const collId of Object.keys(_userItems)) {
      _userItems[collId] = (_userItems[collId] || []).map(i => i.id === id ? { ...i, owned } : i);
    }
  }
  const a = ipc();
  if (a) a.setItemOwned(id, owned).catch(() => {
    if (prevOwned !== undefined && _userItems) {
      for (const collId of Object.keys(_userItems)) {
        _userItems[collId] = (_userItems[collId] || []).map(i => i.id === id ? { ...i, owned: prevOwned } : i);
      }
    }
    toaster.error("Couldn't update item — please try again.");
  });
}
export function saveCatalog(id: string, patch: Record<string, unknown>): void {
  _searchIndex = null;
  if (String(id).startsWith("i-")) {
    const prevItem = _userItems
      ? Object.values(_userItems).flat().find(i => i.id === id)
      : undefined;
    const prevSnap = prevItem ? { ...prevItem } : undefined;
    if (_userItems) {
      for (const collId of Object.keys(_userItems)) {
        _userItems[collId] = (_userItems[collId] || []).map(i => i.id === id ? { ...i, ...patch } : i);
      }
    }
    if (_catOv) delete _catOv[id];
    const a = ipc();
    if (a) a.updateUserItem(id, patch).catch(() => {
      if (prevSnap !== undefined && _userItems) {
        for (const collId of Object.keys(_userItems)) {
          _userItems[collId] = (_userItems[collId] || []).map(i => i.id === id ? prevSnap as UserItem : i);
        }
      }
      toaster.error("Couldn't save item — please try again.");
    });
  } else {
    const prev = _catOv && _catOv[id] ? { ..._catOv[id] } : undefined;
    if (!_catOv) _catOv = {};
    _catOv[id] = Object.assign({}, _catOv[id] || {}, patch);
    const a = ipc();
    if (a) a.saveCatalog(id, patch).catch(() => {
      if (!_catOv) return;
      if (prev === undefined) delete _catOv[id]; else _catOv[id] = prev;
      toaster.error("Couldn't save item — please try again.");
    });
  }
}

// Fix 3: saveStory returns a Promise with error handling
export function saveStory(id: string, paragraphs: string[]): Promise<void> {
  const a = ipc();
  if (!a) return Promise.resolve();
  return a.saveStory(id, paragraphs).catch((err: unknown) => {
    console.error('[api] saveStory failed:', err);
    toaster.error("Couldn't save story — please try again.");
  });
}

let _favorites: string[] | null = null;
let _searchIndex: unknown[] | null = null;

export async function getFavorites(): Promise<string[]> {
  if (_favorites) return _favorites;
  const a = ipc();
  _favorites = a ? await a.getFavorites() : [];
  return _favorites;
}

export async function isFavorite(id: string): Promise<boolean> {
  const favs = await getFavorites();
  return favs.includes(id);
}

// Fix 6: toggleFavorite saves previous state and rolls back on error
export function toggleFavorite(id: string, currentlyFav: boolean): void {
  if (!_favorites) _favorites = [];
  const prevFavs = [..._favorites];
  if (currentlyFav) {
    _favorites = _favorites.filter(f => f !== id);
    const a = ipc();
    if (a) a.removeFavorite(id).catch((err: unknown) => {
      console.error('[api] removeFavorite failed:', err);
      _favorites = prevFavs;
      toaster.error("Couldn't update favorites — please try again.");
    });
  } else {
    if (!_favorites.includes(id)) _favorites.push(id);
    const a = ipc();
    if (a) a.addFavorite(id).catch((err: unknown) => {
      console.error('[api] addFavorite failed:', err);
      _favorites = prevFavs;
      toaster.error("Couldn't update favorites — please try again.");
    });
  }
}

// Fix 5: deleteCollection saves previous state and rolls back on error
export function deleteCollection(id: string): void {
  const prevColls = _userColls ? [..._userColls] : null;
  const prevItems = _userItems ? { ..._userItems } : null;
  if (_userColls) _userColls = _userColls.filter(c => c.id !== id);
  if (_userItems) delete _userItems[id];
  const a = ipc();
  if (a) a.deleteCollection(id).catch((err: unknown) => {
    console.error('[api] deleteCollection failed:', err);
    _userColls = prevColls;
    _userItems = prevItems;
    toaster.error("Couldn't delete collection — please try again.");
  });
}

// Fix 7: createCollection rolls back optimistic add on error
export function createCollection(def: CollectionDef): UserCollection {
  const colls = readUserColls();
  const base = (def.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "coll";
  let id = "u-" + base; let n = 2;
  const taken = colls.map(c => c.id);
  while (taken.indexOf(id) !== -1) { id = "u-" + base + "-" + n; n++; }
  const rec: UserCollection = {
    id,
    name: (def.name || "").trim() || "Untitled collection",
    type: def.type || "other",
    accent: def.accent || USER_HUES[colls.length % USER_HUES.length],
    template: (def.template || []).map(s => String(s).trim()).filter(Boolean),
    user: true,
  };
  if (!_userColls) _userColls = [];
  _userColls.push(rec);
  const a = ipc();
  if (a) a.createCollection(def).then(p => {
    if (p && p.id && p.id !== rec.id) rec.id = p.id;
  }).catch((err: unknown) => {
    console.error('[api] createCollection failed:', err);
    if (_userColls) _userColls = _userColls.filter(c => c !== rec);
    toaster.error("Couldn't create collection — please try again.");
  });
  return rec;
}

// Fix 8: addItem rolls back optimistic add on error
export function addItem(collectionId: string, draft: Record<string, unknown>): UserItem {
  _searchIndex = null;
  const id = "i-" + Math.random().toString(36).slice(2, 9);
  if (!_userItems) _userItems = {};
  if (!_userItems[collectionId]) _userItems[collectionId] = [];
  const list = _userItems[collectionId];
  const rec: UserItem = Object.assign({ id, collectionId, owned: true,
    color: draft.color as string || USER_HUES[list.length % USER_HUES.length] }, draft);
  list.push(rec);
  const a = ipc();
  if (a) a.addItem(collectionId, draft).then(p => {
    if (p && p.id && p.id !== rec.id) rec.id = p.id;
  }).catch((err: unknown) => {
    console.error('[api] addItem failed:', err);
    if (_userItems && _userItems[collectionId]) {
      _userItems[collectionId] = _userItems[collectionId].filter(i => i !== rec);
    }
    _searchIndex = null;
    toaster.error("Couldn't add item — please try again.");
  });
  return rec;
}

// Fix 4: saveSetting returns a Promise with error handling
export function saveSetting(key: string, value: unknown): Promise<void> {
  const a = ipc();
  if (!a) return Promise.resolve();
  return a.saveSetting(key, value).catch((err: unknown) => {
    console.error('[api] saveSetting failed:', err);
    toaster.error("Couldn't save setting — please try again.");
  });
}

// ── JOIN helpers ──────────────────────────────────────────────────────────────

function applyCatalogOv(cat: CatalogItem): CatalogItem {
  const o = readCatalogOv()[cat.id];
  return o ? Object.assign({}, cat, o) : cat;
}

function applyEdits(it: UserItem): UserItem {
  const hv = readHoldings()[it.id];
  if (hv) it = Object.assign({}, it, hv, { owned: true });
  const cv = readCatalogOv()[it.id];
  if (cv) it = Object.assign({}, it, cv);
  return it;
}

function userItemsFor(collectionId: string): UserItem[] {
  return ((_userItems && _userItems[collectionId]) || []).map(applyEdits);
}

function joinHolding(cat: CatalogItem, h: HoldingRecord | undefined): CatalogItem & HoldingRecord & { owned: boolean } {
  cat = applyCatalogOv(cat);
  return Object.assign({}, cat, {
    owned: !!h,
    format:       (h && h.format)       || "—",
    completeness: (h && h.completeness) || null,
    grade:        (h && h.grade)        || null,
    pressing:     (h && h.pressing)     || null,
    edition:      (h && h.edition)      || null,
    condition:    (h && h.condition)    || null,
    acquired:     (h && h.acquired)     || null,
    watched:      h ? h.watched : undefined,
    completed:    h ? h.completed : undefined,
    custom:       (h && h.custom)       || null,
    notes:        (h && h.notes)        || null,
    ownership:    (h && h.ownership)    || null,
    loan_from:        (h && h.loan_from)        || null,
    loan_date:        (h && h.loan_date)        || null,
    loan_to:          (h && h.loan_to)          || null,
    loan_to_date:     (h && h.loan_to_date)     || null,
    purchase_price:   (h && h.purchase_price)   ?? null,
    purchase_currency:(h && h.purchase_currency) || 'USD',
    current_value:    (h && h.current_value)    ?? null,
    rating:           (h && h.rating != null) ? h.rating : null,
  });
}

// ── Read endpoints ────────────────────────────────────────────────────────────

export function getUser(): Promise<UserRecord> {
  const a = ipc();
  return a ? a.getUser() : Promise.resolve({ id: "local", name: "Collector", joined: "2019" });
}

export async function getCatalog(): Promise<CatalogItem[]> {
  await ensureCache(); return _catalog!;
}

export async function getHoldings(): Promise<Record<string, HoldingRecord>> {
  await ensureCache(); return _holdings!;
}

export async function getItem(id: string): Promise<(CatalogItem & HoldingRecord & { owned: boolean }) | null> {
  await ensureCache();
  const row = (_catalog || []).find(c => c.id === id);
  if (!row) return null;
  return joinHolding(row, _holdings ? _holdings[id] : undefined);
}

export async function getItems(ids: string[]): Promise<(CatalogItem & HoldingRecord & { owned: boolean })[]> {
  const out: (CatalogItem & HoldingRecord & { owned: boolean })[] = [];
  for (const id of ids) { const it = await getItem(id); if (it) out.push(it); }
  return out;
}

export async function getCollectionItems(collectionId: string): Promise<(CatalogItem & HoldingRecord & { owned: boolean })[]> {
  await ensureCache();
  return (_catalog || [])
    .filter(c => c.collectionId === collectionId)
    .map(c => joinHolding(c, _holdings ? _holdings[c.id] : undefined));
}

// Returns catalog items related to the owned items: same series or same sub (platform/author/etc.)

export async function getCollections(): Promise<unknown[]> {
  await ensureCache();
  const cat = _catalog || [], h = _holdings || {}, ui = _userItems || {};

  const built = (_baseCols || []).map(coll => {
    // Only count items the user has explicitly interacted with (has a holding record)
    const explicit = cat.filter(c => c.collectionId === coll.id && !!h[c.id]).map(c => joinHolding(c, h[c.id]));
    const extra    = (ui[coll.id] || []).map(applyEdits);
    const all      = explicit.concat(extra);
    const owned    = all.filter(i => i.owned !== false).length;
    const missing  = all.filter(i => i.owned === false).length;
    return Object.assign({}, coll, { owned, missing, pct: all.length ? Math.round(owned / all.length * 100) : 0 });
  }).filter(c => c.owned > 0 || c.missing > 0);

  const made = (_userColls || []).map(rc => {
    const its     = (ui[rc.id] || []).map(applyEdits);
    const owned   = its.filter(i => i.owned !== false).length;
    const missing = its.filter(i => i.owned === false).length;
    return { id: rc.id, name: rc.name, type: rc.type, accent: rc.accent,
      owned, missing, pct: its.length ? Math.round(owned / its.length * 100) : 0,
      user: true, template: rc.template };
  });

  return built.concat(made);
}

export async function getStats(): Promise<StatsConfig> {
  const a = ipc();
  if (!a) return { growth: [] };
  const [conf, growth] = await Promise.all([
    a.getStatsConfig(),
    a.getGrowth().catch(() => null),
  ]);
  const base: StatsConfig = conf || { growth: [] };
  if (growth?.length) base.growth = growth;
  return base;
}

export async function getCollection(id: string): Promise<unknown> {
  await ensureCache();
  // Fix 11: resolveId was a no-op identity function — inlined id directly
  const made  = (_userColls || []).find(c => c.id === id);
  const extra = userItemsFor(id);

  if (made) {
    const ownedN  = extra.filter(i => i.owned !== false).length;
    const missingN = extra.length - ownedN;
    return { id: made.id, name: made.name, type: made.type, accent: made.accent,
      user: true, template: made.template, owned: ownedN, missing: missingN,
      pct: extra.length ? Math.round(ownedN / extra.length * 100) : 0,
      sub: ownedN + (ownedN === 1 ? " item" : " items"), items: extra };
  }

  const cat = _catalog || [], h = _holdings || {};
  const explicit = cat.filter(c => c.collectionId === id && !!h[c.id]).map(c => joinHolding(c, h[c.id]));
  const items    = explicit.concat(extra);
  const owned    = items.filter(i => i.owned !== false).length;
  const missing  = items.filter(i => i.owned === false).length;
  const pct      = items.length ? Math.round(owned / items.length * 100) : 0;

  const meta = (_baseCols || []).find(c => c.id === id)
    || { id, name: id, type: "game", accent: "#6366f1" };

  return Object.assign({}, meta, { owned, missing, pct,
    sub: owned + " owned · " + missing + " missing", items });
}

export async function getCollectionsExpanded(): Promise<unknown[]> {
  const list = await getCollections(), out: unknown[] = [];
  for (const c of list as Array<{ id: string; [key: string]: unknown }>) {
    const full = await getCollection(c.id) as { items?: unknown[] };
    out.push(Object.assign({}, c, { items: full.items || [] }));
  }
  return out;
}

export async function getHome(): Promise<HomeConfig | null> {
  const a = ipc();
  if (!a) return null;
  const [homeConf, dynamic] = await Promise.all([
    a.getHomeConfig(),
    a.getHomeDynamic().catch(() => null),
  ]);
  if (!homeConf) return null;
  const home: HomeConfig = Object.assign({}, homeConf);
  // Pick the collection with the most owned items; fall back to home.json config if none
  const allColls = await getCollections() as Array<{ id: string; owned: number }>;
  const bestColl = allColls.length
    ? allColls.reduce((best, c) => (c.owned > best.owned ? c : best), allColls[0])
    : null;
  home.featured = bestColl ? await getCollection(bestColl.id) : null;

  home.recent = dynamic?.recent?.length
    ? dynamic.recent
    : await getItems(home.recentIds || []);

  if (home.headlineStats) {
    const stats = [...home.headlineStats];

    // Patch the "added this month" stat with live data
    if (dynamic?.addedThisMonth !== undefined) {
      const idx = stats.findIndex((s: HeadlineStat) => s.id === 'added');
      if (idx >= 0) stats[idx] = { ...stats[idx], value: dynamic.addedThisMonth };
      else stats.unshift({ id: 'added', icon: 'plus', value: dynamic.addedThisMonth, label: 'added\nthis month' });
    }

    // Patch collection-completion stats with live data (ensureCache already ran)
    if (_catalog && _holdings && _baseCols) {
      const h = _holdings;
      const liveColls = (_baseCols as BaseCollection[]).map(bc => {
        const catItems = (_catalog as CatalogItem[]).filter(c => c.collectionId === bc.id);
        const ownedN = catItems.filter(c => !!h[c.id]).length;
        const totalN = catItems.length;
        const pct = totalN ? Math.round(ownedN / totalN * 100) : 0;
        return { id: bc.id, type: bc.type as string, owned: ownedN, total: totalN, pct };
      });
      stats.forEach((s: HeadlineStat, i: number) => {
        const typeMatch = liveColls.find(c => s.id === c.id || (s.id && s.id === c.type + 's') || (s.id && c.id === s.id));
        if (typeMatch && (s.ring != null || s.unit === '%')) {
          stats[i] = { ...s, value: String(typeMatch.pct), ring: typeMatch.pct };
        }
      });

      // Patch "unread books" stat from live holdings
      const unreadIdx = stats.findIndex((s: HeadlineStat) => s.id === 'unread');
      if (unreadIdx >= 0) {
        const catUnread = (_catalog as CatalogItem[]).filter(c => c.type === 'book' && (_holdings as Record<string, HoldingRecord>)[c.id] && !(_holdings as Record<string, HoldingRecord>)[c.id].watched).length;
        const userUnread = Object.values(_userItems as Record<string, UserItem[]> || {}).flat()
          .filter((i: UserItem) => i.type === 'book' && i.owned !== false && !i.watched).length;
        stats[unreadIdx] = { ...stats[unreadIdx], value: String(catUnread + userUnread) };
      }
    }

    home.headlineStats = stats;
  }

  if (home.wishlist?.itemIds) {
    home.wishlist = Object.assign({}, home.wishlist, { items: await getItems(home.wishlist.itemIds) });
  }

  home.rediscover = dynamic?.rediscover || null;
  return home;
}

export async function getTimeline(): Promise<TimelineEntry[]> {
  const a = ipc();
  return a ? a.getTimeline() : [];
}

export async function getStory(id: string | null | undefined): Promise<string[] | null> {
  if (!id) return null;
  const a = ipc(); return a ? a.getStory(id) : null;
}

export async function getSettings(): Promise<Record<string, string>> {
  const a = ipc(); return a ? a.getSettings() : {};
}

export async function lookupMetadata(type: string, query: string): Promise<unknown> {
  const a = ipc(); return a ? a.lookup(type, query) : null;
}

export async function importData(): Promise<unknown> {
  const fn = (window as unknown as { hoddDesktop?: { importArchive?: () => Promise<{ canceled?: boolean }> } }).hoddDesktop?.importArchive;
  if (!fn) return null;
  const result = await fn();
  if (result && !result.canceled) {
    _catalog = null;
    invalidateCache();
  }
  return result;
}

export async function exportData(): Promise<unknown> {
  await ensureCache();
  const fn = (window as unknown as { hoddDesktop?: { exportArchive?: (payload: unknown) => Promise<unknown> } }).hoddDesktop?.exportArchive;
  if (!fn) return null;
  const a = ipc();
  const [user, stories] = await Promise.all([
    getUser(),
    a ? a.getAllStories().catch(() => ({})) : Promise.resolve({}),
  ]);
  const payload = {
    version: 1,
    exported: new Date().toISOString(),
    user,
    userCollections: _userColls || [],
    userItems: _userItems || {},
    holdings: _holdings || {},
    catalogOverrides: _catOv || {},
    stories: stories || {},
  };
  return fn(payload);
}

export async function getSearchIndex(): Promise<unknown[]> {
  if (_searchIndex) return _searchIndex;
  await ensureCache();
  const cat = _catalog || [], h = _holdings || {};
  const bcMap = Object.fromEntries((_baseCols || []).map(c => [c.id as string, c.name as string]));
  // Only index catalog items from collections where the user owns at least one item
  const activeBaseCollIds = new Set(
    (_baseCols || [])
      .map(bc => bc.id as string)
      .filter(id => cat.some(c => c.collectionId === id && !!(h as Record<string, HoldingRecord>)[c.id]))
  );
  const catIdx = cat.filter(c => activeBaseCollIds.has(c.collectionId)).map(c => {
    const item = joinHolding(c, h[c.id]) as Record<string, unknown>;
    item.coll = bcMap[c.collectionId] || COLL_NAME[c.collectionId] || "Hoard";
    if (c.type === "game")  item.platform = c.sub;
    if (c.type === "book")  item.author   = c.sub;
    if (c.type === "vinyl") item.artist   = c.sub;
    if (c.type === "movie") item.director = c.sub;
    return item;
  });
  const ui = _userItems || {}, uc = _userColls || [], bc = _baseCols || [], userIdx: Record<string, unknown>[] = [];
  Object.keys(ui).forEach(collId => {
    const coll = uc.find(c => c.id === collId) || bc.find(c => c.id === collId);
    (ui[collId] || []).forEach(it => {
      const item = applyEdits(it) as Record<string, unknown>;
      item.coll = coll ? (coll.name as string) : "My Collection";
      if (item.type === "game")  item.platform = item.sub;
      if (item.type === "book")  item.author   = item.sub;
      if (item.type === "vinyl") item.artist   = item.sub;
      if (item.type === "movie") item.director = item.sub;
      userIdx.push(item);
    });
  });
  _searchIndex = catIdx.concat(userIdx);
  return _searchIndex;
}

// Fix 12: use ipc() helper instead of accessing hoddDesktop.api directly
export async function getCachedSuggestions(collectionId: string): Promise<unknown[]> {
  const api = ipc();
  if (!api?.getSuggestions) return [];
  try { return await api.getSuggestions(collectionId); } catch { return []; }
}

export async function fetchSuggestions(
  collectionId: string,
  type: string,
  ownedItems: OwnedItem[]
): Promise<unknown[]> {
  const api = ipc();
  if (!api?.fetchSuggestions) return [];
  try {
    return await api.fetchSuggestions(collectionId, type, ownedItems);
  } catch (e) {
    console.warn('[HODD] fetchSuggestions failed', e);
    return [];
  }
}

// ── Ollama local AI client ────────────────────────────────────────────────────

interface OllamaStatus {
  running: boolean;
  models: string[];
}

interface OllamaApi {
  status(): Promise<OllamaStatus>;
  generate(model: string, prompt: string, system?: string): Promise<string>;
  chat(model: string, messages: unknown[]): Promise<unknown>;
}

let _ollamaStatus: OllamaStatus | null = null;

async function checkOllamaStatus(): Promise<OllamaStatus> {
  if (_ollamaStatus) return _ollamaStatus;
  const o = (window as unknown as { hoddDesktop?: { ollama?: OllamaApi } }).hoddDesktop?.ollama;
  _ollamaStatus = o ? (await o.status()) : { running: false, models: [] };
  return _ollamaStatus;
}

async function ollamaGenerate(model: string, prompt: string, system?: string): Promise<string> {
  const o = (window as unknown as { hoddDesktop?: { ollama?: OllamaApi } }).hoddDesktop?.ollama;
  if (!o) throw new Error("Ollama not available");
  return o.generate(model, prompt, system);
}

// Fix 9: allowlist for keys that may be merged from LLM output
const ALLOWED_ENRICH_KEYS = new Set(['title', 'year', 'sub', 'type', 'region', 'series', 'color']);

export const OllamaClient = {
  invalidateStatus(): void { _ollamaStatus = null; },
  async isRunning(): Promise<boolean> { return (await checkOllamaStatus()).running; },
  async getModels(): Promise<string[]> { return (await checkOllamaStatus()).models; },

  async chat(model: string, messages: unknown[]): Promise<unknown> {
    const o = (window as unknown as { hoddDesktop?: { ollama?: OllamaApi } }).hoddDesktop?.ollama;
    if (!o) throw new Error("Ollama not available");
    return o.chat(model, messages);
  },

  generate: ollamaGenerate,

  async ollamaSearch(query: string, idx: Record<string, unknown>[], model: string): Promise<unknown> {
    const systemPrompt = [
      "You are a query parser for HODD, a personal collection management app.",
      "The collection may contain: games, books, movies, coins, comics, vinyl records.",
      "Parse the user's query and respond with ONLY valid JSON (no markdown):",
      '{ "type": "game|book|movie|coin|comic|vinyl|null",',
      '  "status": "owned|missing|null (null unless the user explicitly says owned/have/my or missing/want/looking for)",',
      '  "watched": "yes|no|null",',
      '  "completed": "yes|no|null",',
      '  "yearFrom": number_or_null,',
      '  "yearTo": number_or_null,',
      '  "keywords": ["word1", "word2"] }',
    ].join(" ");

    try {
      // Fix 10: sanitize user-supplied query before embedding in prompt
      const safeQuery = sanitizeForPrompt(query);
      const raw = await ollamaGenerate(model, safeQuery, systemPrompt);
      const filters = JSON.parse(raw.trim().replace(/^```json\s*/, "").replace(/```$/, "")) as {
        type?: string;
        status?: string;
        watched?: string;
        completed?: string;
        yearFrom?: number;
        yearTo?: number;
        keywords?: string[];
      };
      const results = idx.filter(i => {
        if (filters.type && i.type !== filters.type) return false;
        if (filters.status === "owned"   && i.owned === false) return false;
        if (filters.status === "missing" && i.owned !== false) return false;
        if (filters.watched === "no"     && (i.owned === false || i.watched !== false)) return false;
        if (filters.watched === "yes"    && !i.watched) return false;
        if (filters.completed === "no"   && (i.owned === false || i.completed !== false)) return false;
        if (filters.completed === "yes"  && !i.completed) return false;
        if (filters.yearFrom && (i.year as number) < filters.yearFrom) return false;
        if (filters.yearTo   && (i.year as number) > filters.yearTo)   return false;
        if (filters.keywords && filters.keywords.length) {
          const haystack = ((i.title || "") + " " + (i.sub || "") + " " + (i.coll || "")).toLowerCase();
          return filters.keywords.some(kw => haystack.includes(kw.toLowerCase()));
        }
        return true;
      });
      const snippet = results.slice(0, 8).map(i =>
        i.title + (i.year ? " (" + i.year + ")" : "") + " — " + (i.owned ? "owned" : "not owned")
      ).join("; ");
      const answerPrompt = [
        'The user asked: "' + safeQuery + '".',
        results.length
          ? "Found " + results.length + " matching items: " + snippet + "."
          : "No matching items found.",
        "Write a short, friendly answer (1-2 sentences) about what was found. Be specific.",
      ].join(" ");
      const answer = await ollamaGenerate(model, answerPrompt,
        "You are a helpful assistant for a personal collection app. Be concise and warm.");
      const tokens: [string, string][] = [];
      if (filters.type)              tokens.push(["Type",      filters.type.charAt(0).toUpperCase() + filters.type.slice(1)]);
      if (filters.status)            tokens.push(["Status",    filters.status === "owned" ? "Owned" : "Missing"]);
      if (filters.watched === "yes") tokens.push(["Watched",   "Yes"]);
      if (filters.watched === "no")  tokens.push(["Watched",   "No"]);
      if (filters.completed === "yes") tokens.push(["Completed", "Yes"]);
      if (filters.completed === "no")  tokens.push(["Completed", "No"]);
      if (filters.yearFrom || filters.yearTo) tokens.push(["Year", [filters.yearFrom, filters.yearTo].filter(Boolean).join("–")]);
      if (filters.keywords?.length)  tokens.push(["Keywords",  filters.keywords.join(", ")]);
      return { tokens, results: results.slice(0, 24), total: results.length, summary: (answer as string).trim(), q: query, aiPowered: true };
    } catch (e) {
      console.warn("[HODD Ollama] search failed, falling back to heuristic:", (e as Error).message);
      return null;
    }
  },

  async enrichItem(rawText: string, type: string, model: string): Promise<Record<string, unknown> | null> {
    // Fix 10: sanitize user-supplied rawText before embedding in prompt
    const safeRawText = sanitizeForPrompt(rawText);
    const prompts: Record<string, string> = {
      game:  `Input: "${safeRawText}"\nType: game\nReturn JSON only: {"title":"clean game title only — no platform name, no year, no edition (e.g. 'Cyberpunk 2077' not 'Cyberpunk 2077 PS4')","year":REAL_RELEASE_YEAR_NOT_FROM_TITLE,"platform":"Game Boy|SNES|GBA|NES|N64|PS1|PS2|PS3|PS4|PS5|Xbox|Xbox 360|Xbox One|PC|Switch|etc","completeness":"CIB|Loose|Sealed|null (null unless explicitly stated)","condition":"Mint|Near Mint|Very Good|Good|Fair|Poor|null (null unless explicitly stated)","series":"franchise/series name or null (e.g. The Legend of Zelda, Mario, Halo)"}`,
      book:  `Input: "${safeRawText}"\nType: book\nReturn JSON only: {"title":"exact title","year":YYYY,"author":"Full Name","edition":"First Edition|Paperback|Hardcover|Mass Market|null","series":"book series name or null (e.g. Harry Potter, Dune, The Expanse)"}`,
      movie: `Input: "${safeRawText}"\nType: movie\nReturn JSON only: {"title":"exact title","year":YYYY,"director":"Full Name or null","format":"4K Blu-ray|Blu-ray|DVD|Digital|VHS|null","series":"film series/franchise or null (e.g. Marvel Cinematic Universe, James Bond, Star Wars)"}`,
      vinyl: `Input: "${safeRawText}"\nType: vinyl\nReturn JSON only: {"title":"exact title","year":YYYY,"artist":"Full Name","pressing":"180g|Original Press|Limited|null","series":"album series or box set name or null"}`,
      coin:  `Input: "${safeRawText}"\nType: coin\nReturn JSON only: {"title":"coin name","year":YYYY,"mint":"Philadelphia|Denver|San Francisco|New Orleans|Carson City|null","grade":"MS-63|MS-64|etc or null","series":"coin series or program or null (e.g. State Quarters, Walking Liberty, Morgan Dollar)"}`,
      comic: `Input: "${safeRawText}"\nType: comic\nReturn JSON only: {"title":"exact title","year":YYYY,"publisher":"Marvel|DC|Image|Dark Horse|etc","format":"Single Issue|TPB|Hardcover|Omnibus|null","series":"comic series name or null (e.g. Amazing Spider-Man, Batman, Saga)"}`,
    };
    const prompt = prompts[type] || `Input: "${safeRawText}"\nReturn JSON only: {"title":"exact title","year":YYYY,"series":"series or franchise name or null"}`;
    try {
      const raw = await ollamaGenerate(model, prompt,
        "You are a collectibles database. Return ONLY valid JSON. No markdown, no explanations. Use null for unknown fields.");
      const cleaned = (raw as string).trim().replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "");
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      // Fix 9: filter LLM output through an allowlist before merging
      const safePatch = Object.fromEntries(
        Object.entries(parsed).filter(([k]) => ALLOWED_ENRICH_KEYS.has(k))
      );
      return safePatch;
    } catch (_) { return null; }
  },

  async generateStory(item: { title?: string; year?: number | null; sub?: string | null; type?: string; format?: string | null; edition?: string | null; grade?: string | null; acquired?: string | null }, model: string): Promise<string[]> {
    const subLabel = item.type === "book" ? "Author" : item.type === "game" ? "Platform"
      : item.type === "coin" ? "Mint" : item.type === "vinyl" ? "Artist"
      : item.type === "movie" ? "Director" : item.type === "comic" ? "Publisher" : "Detail";
    // Fix 10: sanitize user-supplied item fields before embedding in prompt
    const safeTitle = sanitizeForPrompt(item.title || '');
    const safeSub   = item.sub ? sanitizeForPrompt(item.sub) : null;
    const details = [
      "Title: " + safeTitle,
      item.year    ? "Year: "    + item.year         : null,
      safeSub      ? subLabel + ": " + safeSub        : null,
      item.format  ? "Format: "  + item.format       : null,
      item.edition ? "Edition: " + item.edition      : null,
      item.grade   ? "Grade: "   + item.grade        : null,
      item.acquired? "Acquired: "+ item.acquired      : null,
    ].filter(Boolean).join("; ");

    const prompt = [
      "Write a 2–3 paragraph provenance story for this collectible item owned by a collector.",
      "Details: " + details + ".",
      "Write in second person (\"you\"). Be evocative, specific, and collector-appropriate.",
      "Don't be generic. Reference the real history, era, or cultural context of this item.",
    ].join(" ");

    const text = await ollamaGenerate(model, prompt,
      "You are a writer helping collectors tell the stories of their treasured items. Write warmly and with depth.");
    return (text as string).trim().split(/\n{2,}/).filter(p => p.trim());
  },
};
