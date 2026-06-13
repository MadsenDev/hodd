// @ts-nocheck
// Electron IPC data layer. All reads go through an in-memory cache; writes
// update the cache immediately so the UI never waits on IPC, then persist async.

import { toaster } from './toaster';

const COLL_NAME = { pokemon: "Pokémon Games", books: "Books", movies: "Movies", games: "Games", coins: "Coins", comics: "Comics", vinyl: "Vinyl" };
export const HOLDING_FIELDS = ["ownership", "notes", "loan_from", "loan_date", "format", "completeness", "grade", "pressing", "edition", "condition", "acquired", "watched", "custom"];
const USER_HUES = ["#6366f1", "#5BA47A", "#5C8AD6", "#C9A24C", "#CF6B5A", "#7FB0C4", "#9B7BD4", "#C0392B"];

let _catalog   = null;
let _holdings  = null;
let _catOv     = null;
let _userColls = null;
let _userItems = null;
let _baseCols  = null;

function resolveId(id) { return id === "featured" ? "pokemon" : id; }
function ipc() { return (window as any).hoddDesktop?.api; }

async function ensureCache() {
  if (_catalog && _holdings && _catOv && _userColls && _userItems && _baseCols) return;
  const a = ipc();
  if (!a) throw new Error("Electron IPC not available");
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

export function invalidateCache() { _holdings = null; _catOv = null; _userColls = null; _userItems = null; _favorites = null; _searchIndex = null; }

export async function resetAllData() {
  const a = ipc(); if (a) await a.resetAll();
  invalidateCache();
}

export async function getOnboarded(): Promise<boolean> {
  const settings = await getSettings();
  return settings['onboarded'] === '1';
}

function readOverrides()  { return _holdings  || {}; }
function readCatalogOv()  { return _catOv     || {}; }
function readUserColls()  { return _userColls || []; }
function readUserItems()  { return _userItems || {}; }

// ── Write operations ─────────────────────────────────────────────────────────

export function saveHolding(id, patch) {
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
export function removeHolding(id) {
  const prev = _holdings && _holdings[id] ? { ..._holdings[id] } : undefined;
  if (_holdings) delete _holdings[id];
  _searchIndex = null;
  const a = ipc();
  if (a) a.removeHolding(id).catch(() => {
    if (prev !== undefined) { if (!_holdings) _holdings = {}; _holdings[id] = prev; }
    toaster.error("Couldn't remove holding — please try again.");
  });
}

export function removeItem(id) {
  _searchIndex = null;
  const prevItems = _userItems ? JSON.parse(JSON.stringify(_userItems)) : undefined;
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

export function setItemOwned(id, owned) {
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
export function saveCatalog(id, patch) {
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
          _userItems[collId] = (_userItems[collId] || []).map(i => i.id === id ? prevSnap : i);
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
export function saveStory(id, paragraphs) {
  const a = ipc(); if (a) a.saveStory(id, paragraphs);
}

let _favorites: string[] | null = null;
let _searchIndex: any[] | null = null;

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

export function toggleFavorite(id: string, currentlyFav: boolean): void {
  if (!_favorites) _favorites = [];
  if (currentlyFav) {
    _favorites = _favorites.filter(f => f !== id);
    const a = ipc(); if (a) a.removeFavorite(id);
  } else {
    if (!_favorites.includes(id)) _favorites.push(id);
    const a = ipc(); if (a) a.addFavorite(id);
  }
}

export function deleteCollection(id) {
  if (_userColls) _userColls = _userColls.filter(c => c.id !== id);
  if (_userItems) delete _userItems[id];
  const a = ipc(); if (a) a.deleteCollection(id);
}

export function createCollection(def) {
  const colls = readUserColls();
  const base = (def.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "coll";
  let id = "u-" + base; let n = 2;
  const taken = colls.map(c => c.id);
  while (taken.indexOf(id) !== -1) { id = "u-" + base + "-" + n; n++; }
  const rec = {
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
  if (a) a.createCollection(def).then(p => { if (p && p.id && p.id !== rec.id) rec.id = p.id; });
  return rec;
}

export function addItem(collectionId, draft) {
  _searchIndex = null;
  const id = "i-" + Math.random().toString(36).slice(2, 9);
  if (!_userItems) _userItems = {};
  if (!_userItems[collectionId]) _userItems[collectionId] = [];
  const list = _userItems[collectionId];
  const rec = Object.assign({ id, collectionId, owned: true,
    color: draft.color || USER_HUES[list.length % USER_HUES.length] }, draft);
  list.push(rec);
  const a = ipc(); if (a) a.addItem(collectionId, draft);
  return rec;
}

// ── JOIN helpers ──────────────────────────────────────────────────────────────

function applyCatalogOv(cat) {
  const o = readCatalogOv()[cat.id];
  return o ? Object.assign({}, cat, o) : cat;
}

function applyEdits(it) {
  const hv = readOverrides()[it.id];
  if (hv) it = Object.assign({}, it, hv, { owned: true });
  const cv = readCatalogOv()[it.id];
  if (cv) it = Object.assign({}, it, cv);
  return it;
}

function userItemsFor(collectionId) {
  return ((_userItems && _userItems[collectionId]) || []).map(applyEdits);
}

function joinHolding(cat, h) {
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
    loan_from:    (h && h.loan_from)    || null,
    loan_date:    (h && h.loan_date)    || null,
  });
}

// ── Read endpoints ────────────────────────────────────────────────────────────

export function getUser() {
  const a = ipc();
  return a ? a.getUser() : Promise.resolve({ id: "local", name: "Collector", joined: "2019" });
}

export async function getCatalog() {
  await ensureCache(); return _catalog;
}

export async function getHoldings() {
  await ensureCache(); return _holdings;
}

export async function getItem(id) {
  await ensureCache();
  const row = (_catalog || []).find(c => c.id === id);
  if (!row) return null;
  return joinHolding(row, _holdings && _holdings[id]);
}

export async function getItems(ids) {
  const out = [];
  for (const id of ids) { const it = await getItem(id); if (it) out.push(it); }
  return out;
}

export async function getCollectionItems(collectionId) {
  await ensureCache();
  return (_catalog || [])
    .filter(c => c.collectionId === collectionId)
    .map(c => joinHolding(c, _holdings && _holdings[c.id]));
}

export async function getCollections() {
  await ensureCache();
  const cat = _catalog || [], h = _holdings || {}, ui = _userItems || {};

  const built = (_baseCols || []).map(coll => {
    const catItems = cat.filter(c => c.collectionId === coll.id);
    const extra    = (ui[coll.id] || []).map(applyEdits);
    const all      = catItems.map(c => joinHolding(c, h[c.id])).concat(extra);
    const owned    = all.filter(i => i.owned !== false).length;
    const total    = all.length;
    return Object.assign({}, coll, { owned, missing: total - owned, pct: total ? Math.round(owned / total * 100) : 0 });
  });

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

export async function getStats() {
  const a = ipc();
  if (!a) return { growth: [] };
  const [conf, growth] = await Promise.all([
    a.getStatsConfig(),
    a.getGrowth().catch(() => null),
  ]);
  const base = conf || { growth: [] };
  if (growth?.length) base.growth = growth;
  return base;
}

export async function getCollection(id) {
  await ensureCache();
  const resolved = resolveId(id);
  const made  = (_userColls || []).find(c => c.id === resolved);
  const extra = userItemsFor(resolved);

  if (made) {
    const ownedN  = extra.filter(i => i.owned !== false).length;
    const missingN = extra.length - ownedN;
    return { id: made.id, name: made.name, type: made.type, accent: made.accent,
      user: true, template: made.template, owned: ownedN, missing: missingN,
      pct: extra.length ? Math.round(ownedN / extra.length * 100) : 0,
      sub: ownedN + (ownedN === 1 ? " item" : " items"), items: extra };
  }

  const cat      = _catalog || [], h = _holdings || {};
  const catItems = cat.filter(c => c.collectionId === resolved)
    .map(c => joinHolding(c, h[c.id]));
  const all      = catItems.concat(extra);
  const owned    = all.filter(i => i.owned !== false).length;
  const total    = all.length;
  const pct      = total ? Math.round(owned / total * 100) : 0;

  const meta = (_baseCols || []).find(c => c.id === resolved)
    || { id: resolved, name: resolved, type: "game", accent: "#6366f1" };

  return Object.assign({}, meta, { owned, missing: total - owned, pct,
    sub: owned + " owned · " + (total - owned) + " missing", items: all });
}

export async function getCollectionsExpanded() {
  const list = await getCollections(), out = [];
  for (const c of list) {
    const full = await getCollection(c.id);
    out.push(Object.assign({}, c, { items: full.items || [] }));
  }
  return out;
}

export async function getHome() {
  const a = ipc();
  if (!a) return null;
  const [homeConf, dynamic] = await Promise.all([
    a.getHomeConfig(),
    a.getHomeDynamic().catch(() => null),
  ]);
  if (!homeConf) return null;
  const home = Object.assign({}, homeConf);
  home.featured = await getCollection(home.featuredCollectionId);

  home.recent = dynamic?.recent?.length
    ? dynamic.recent
    : await getItems(home.recentIds || []);

  if (home.headlineStats) {
    const stats = [...home.headlineStats];

    // Patch the "added this month" stat with live data
    if (dynamic?.addedThisMonth !== undefined) {
      const idx = stats.findIndex((s: any) => s.id === 'added');
      if (idx >= 0) stats[idx] = { ...stats[idx], value: dynamic.addedThisMonth };
      else stats.unshift({ id: 'added', icon: 'plus', value: dynamic.addedThisMonth, label: 'added\nthis month' });
    }

    // Patch collection-completion stats with live data (ensureCache already ran)
    if (_catalog && _holdings && _baseCols) {
      const h = _holdings;
      const liveColls = (_baseCols as any[]).map(bc => {
        const catItems = (_catalog as any[]).filter(c => c.collectionId === bc.id);
        const ownedN = catItems.filter(c => !!h[c.id]).length;
        const totalN = catItems.length;
        const pct = totalN ? Math.round(ownedN / totalN * 100) : 0;
        return { id: bc.id, type: bc.type as string, owned: ownedN, total: totalN, pct };
      });
      stats.forEach((s: any, i: number) => {
        const typeMatch = liveColls.find(c => s.id === c.id || (s.id && s.id === c.type + 's') || (s.id && c.id === s.id));
        if (typeMatch && (s.ring != null || s.unit === '%')) {
          stats[i] = { ...s, value: String(typeMatch.pct), ring: typeMatch.pct };
        }
      });

      // Patch "unread books" stat from live holdings
      const unreadIdx = stats.findIndex((s: any) => s.id === 'unread');
      if (unreadIdx >= 0) {
        const catUnread = (_catalog as any[]).filter(c => c.type === 'book' && (_holdings as any)[c.id] && !(_holdings as any)[c.id].watched).length;
        const userUnread = Object.values(_userItems as Record<string, any[]> || {}).flat()
          .filter((i: any) => i.type === 'book' && i.owned !== false && !i.watched).length;
        stats[unreadIdx] = { ...stats[unreadIdx], value: String(catUnread + userUnread) };
      }
    }

    home.headlineStats = stats;
  }

  if (home.wishlist?.itemIds) {
    home.wishlist = Object.assign({}, home.wishlist, { items: await getItems(home.wishlist.itemIds) });
  }

  if (dynamic?.rediscover) {
    home.rediscover = dynamic.rediscover;
  } else if (home.rediscover?.itemId) {
    const redItem = await getItem(home.rediscover.itemId);
    home.rediscover = Object.assign({}, redItem, home.rediscover);
  } else {
    home.rediscover = null;
  }
  return home;
}

export async function getTimeline() {
  const a = ipc();
  return a ? a.getTimeline() : [];
}

export async function getStory(id) {
  if (!id) return null;
  const a = ipc(); return a ? a.getStory(id) : null;
}

export async function getSettings() {
  const a = ipc(); return a ? a.getSettings() : {};
}

export function saveSetting(key, value) {
  const a = ipc(); if (a) a.saveSetting(key, value);
}

export async function lookupMetadata(type, query) {
  const a = ipc(); return a ? a.lookup(type, query) : null;
}

export async function importData() {
  const fn = (window as any).hoddDesktop?.importArchive;
  if (!fn) return null;
  const result = await fn();
  if (result && !result.canceled) {
    _catalog = null;
    invalidateCache();
  }
  return result;
}

export async function exportData() {
  await ensureCache();
  const fn = (window as any).hoddDesktop?.exportArchive;
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

export async function getSearchIndex() {
  if (_searchIndex) return _searchIndex;
  await ensureCache();
  const cat = _catalog || [], h = _holdings || {};
  const bcMap = Object.fromEntries((_baseCols || []).map(c => [c.id as string, c.name as string]));
  const catIdx = cat.map(c => {
    const item = joinHolding(c, h[c.id]);
    item.coll = bcMap[c.collectionId] || COLL_NAME[c.collectionId] || "Hoard";
    if (c.type === "game")  item.platform = c.sub;
    if (c.type === "book")  item.author   = c.sub;
    if (c.type === "vinyl") item.artist   = c.sub;
    if (c.type === "movie") item.director = c.sub;
    return item;
  });
  const ui = _userItems || {}, uc = _userColls || [], bc = _baseCols || [], userIdx = [];
  Object.keys(ui).forEach(collId => {
    const coll = uc.find(c => c.id === collId) || bc.find(c => c.id === collId);
    (ui[collId] || []).forEach(it => {
      const item = applyEdits(it);
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

// ── Ollama local AI client ────────────────────────────────────────────────────

let _ollamaStatus = null;

async function checkOllamaStatus() {
  if (_ollamaStatus) return _ollamaStatus;
  const o = (window as any).hoddDesktop?.ollama;
  _ollamaStatus = o ? (await o.status()) : { running: false, models: [] };
  return _ollamaStatus;
}

async function ollamaGenerate(model, prompt, system?) {
  const o = (window as any).hoddDesktop?.ollama;
  if (!o) throw new Error("Ollama not available");
  return o.generate(model, prompt, system);
}

export const OllamaClient = {
  invalidateStatus() { _ollamaStatus = null; },
  async isRunning() { return (await checkOllamaStatus()).running; },
  async getModels() { return (await checkOllamaStatus()).models; },

  async chat(model, messages) {
    const o = (window as any).hoddDesktop?.ollama;
    if (!o) throw new Error("Ollama not available");
    return o.chat(model, messages);
  },

  generate: ollamaGenerate,

  async ollamaSearch(query, idx, model) {
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
      const raw = await ollamaGenerate(model, query, systemPrompt);
      const filters = JSON.parse(raw.trim().replace(/^```json\s*/, "").replace(/```$/, ""));
      const results = idx.filter(i => {
        if (filters.type && i.type !== filters.type) return false;
        if (filters.status === "owned"   && i.owned === false) return false;
        if (filters.status === "missing" && i.owned !== false) return false;
        if (filters.watched === "no"     && (i.owned === false || i.watched !== false)) return false;
        if (filters.watched === "yes"    && !i.watched) return false;
        if (filters.completed === "no"   && (i.owned === false || i.completed !== false)) return false;
        if (filters.completed === "yes"  && !i.completed) return false;
        if (filters.yearFrom && i.year < filters.yearFrom) return false;
        if (filters.yearTo   && i.year > filters.yearTo)   return false;
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
        'The user asked: "' + query + '".',
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
      console.warn("[HODD Ollama] search failed, falling back to heuristic:", e.message);
      return null;
    }
  },

  async enrichItem(rawText, type, model) {
    const prompts = {
      game:  `Input: "${rawText}"\nType: game\nReturn JSON only: {"title":"clean game title only — no platform name, no year, no edition (e.g. 'Cyberpunk 2077' not 'Cyberpunk 2077 PS4')","year":REAL_RELEASE_YEAR_NOT_FROM_TITLE,"platform":"Game Boy|SNES|GBA|NES|N64|PS1|PS2|PS3|PS4|PS5|Xbox|Xbox 360|Xbox One|PC|Switch|etc","completeness":"CIB|Loose|Sealed|null (null unless explicitly stated)","condition":"Mint|Near Mint|Very Good|Good|Fair|Poor|null (null unless explicitly stated)","series":"franchise/series name or null (e.g. The Legend of Zelda, Mario, Halo)"}`,
      book:  `Input: "${rawText}"\nType: book\nReturn JSON only: {"title":"exact title","year":YYYY,"author":"Full Name","edition":"First Edition|Paperback|Hardcover|Mass Market|null","series":"book series name or null (e.g. Harry Potter, Dune, The Expanse)"}`,
      movie: `Input: "${rawText}"\nType: movie\nReturn JSON only: {"title":"exact title","year":YYYY,"director":"Full Name or null","format":"4K Blu-ray|Blu-ray|DVD|Digital|VHS|null","series":"film series/franchise or null (e.g. Marvel Cinematic Universe, James Bond, Star Wars)"}`,
      vinyl: `Input: "${rawText}"\nType: vinyl\nReturn JSON only: {"title":"exact title","year":YYYY,"artist":"Full Name","pressing":"180g|Original Press|Limited|null","series":"album series or box set name or null"}`,
      coin:  `Input: "${rawText}"\nType: coin\nReturn JSON only: {"title":"coin name","year":YYYY,"mint":"Philadelphia|Denver|San Francisco|New Orleans|Carson City|null","grade":"MS-63|MS-64|etc or null","series":"coin series or program or null (e.g. State Quarters, Walking Liberty, Morgan Dollar)"}`,
      comic: `Input: "${rawText}"\nType: comic\nReturn JSON only: {"title":"exact title","year":YYYY,"publisher":"Marvel|DC|Image|Dark Horse|etc","format":"Single Issue|TPB|Hardcover|Omnibus|null","series":"comic series name or null (e.g. Amazing Spider-Man, Batman, Saga)"}`,
    };
    const prompt = prompts[type] || `Input: "${rawText}"\nReturn JSON only: {"title":"exact title","year":YYYY,"series":"series or franchise name or null"}`;
    try {
      const raw = await ollamaGenerate(model, prompt,
        "You are a collectibles database. Return ONLY valid JSON. No markdown, no explanations. Use null for unknown fields.");
      const cleaned = (raw as string).trim().replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "");
      return JSON.parse(cleaned);
    } catch (_) { return null; }
  },

  async generateStory(item, model) {
    const subLabel = item.type === "book" ? "Author" : item.type === "game" ? "Platform"
      : item.type === "coin" ? "Mint" : item.type === "vinyl" ? "Artist"
      : item.type === "movie" ? "Director" : item.type === "comic" ? "Publisher" : "Detail";
    const details = [
      "Title: " + item.title,
      item.year    ? "Year: "    + item.year         : null,
      item.sub     ? subLabel + ": " + item.sub      : null,
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
