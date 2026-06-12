// @ts-nocheck
// Electron IPC data layer. All reads go through an in-memory cache; writes
// update the cache immediately so the UI never waits on IPC, then persist async.

const COLL_NAME = { pokemon: "Pokémon Games", books: "Books", movies: "Movies", games: "Games", coins: "Coins", comics: "Comics", vinyl: "Vinyl" };
export const HOLDING_FIELDS = ["format", "completeness", "grade", "pressing", "edition", "condition", "acquired", "watched", "custom"];
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

export function invalidateCache() { _holdings = null; _catOv = null; _userColls = null; _userItems = null; }

function readOverrides()  { return _holdings  || {}; }
function readCatalogOv()  { return _catOv     || {}; }
function readUserColls()  { return _userColls || []; }
function readUserItems()  { return _userItems || {}; }

// ── Write operations ─────────────────────────────────────────────────────────

export function saveHolding(id, patch) {
  if (!_holdings) _holdings = {};
  _holdings[id] = Object.assign({}, _holdings[id] || {}, patch);
  const a = ipc(); if (a) a.saveHolding(id, patch);
}
export function removeHolding(id) {
  if (_holdings) delete _holdings[id];
  const a = ipc(); if (a) a.removeHolding(id);
}
export function saveCatalog(id, patch) {
  if (!_catOv) _catOv = {};
  _catOv[id] = Object.assign({}, _catOv[id] || {}, patch);
  const a = ipc(); if (a) a.saveCatalog(id, patch);
}
export function saveStory(id, paragraphs) {
  const a = ipc(); if (a) a.saveStory(id, paragraphs);
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
    custom:       (h && h.custom)       || null,
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
    const its   = (ui[rc.id] || []).map(applyEdits);
    const owned = its.filter(i => i.owned !== false).length;
    return { id: rc.id, name: rc.name, type: rc.type, accent: rc.accent,
      owned, missing: 0, pct: its.length ? Math.round(owned / its.length * 100) : 0,
      user: true, template: rc.template };
  });

  return built.concat(made);
}

export async function getStats() {
  const a = ipc();
  return a ? a.getStatsConfig() : { growth: [] };
}

export async function getCollection(id) {
  await ensureCache();
  const resolved = resolveId(id);
  const made  = (_userColls || []).find(c => c.id === resolved);
  const extra = userItemsFor(resolved);

  if (made) {
    const ownedN = extra.filter(i => i.owned !== false).length;
    return { id: made.id, name: made.name, type: made.type, accent: made.accent,
      user: true, template: made.template, owned: ownedN, missing: 0,
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
  const homeConf = a ? (await a.getHomeConfig()) : null;
  if (!homeConf) return null;
  const home     = Object.assign({}, homeConf);
  home.featured  = await getCollection(home.featuredCollectionId);
  home.recent    = await getItems(home.recentIds);
  home.wishlist  = Object.assign({}, home.wishlist, { items: await getItems(home.wishlist.itemIds) });
  const redItem  = await getItem(home.rediscover.itemId);
  home.rediscover = Object.assign({}, redItem, home.rediscover);
  return home;
}

export async function getStory(id) {
  if (!id) return null;
  const a = ipc(); return a ? a.getStory(id) : null;
}

export async function getSearchIndex() {
  await ensureCache();
  const cat = _catalog || [], h = _holdings || {};
  const catIdx = cat.map(c => {
    const item = joinHolding(c, h[c.id]);
    item.coll = COLL_NAME[c.collectionId] || "Hoard";
    if (c.type === "game")  item.platform = c.sub;
    if (c.type === "book")  item.author   = c.sub;
    if (c.collectionId === "pokemon") item.completed = item.owned && c.year < 1999;
    return item;
  });
  const ui = _userItems || {}, uc = _userColls || [], userIdx = [];
  Object.keys(ui).forEach(collId => {
    const coll = uc.find(c => c.id === collId);
    (ui[collId] || []).forEach(it => {
      const item = applyEdits(it);
      item.coll = coll ? coll.name : "My Collection";
      userIdx.push(item);
    });
  });
  return catIdx.concat(userIdx);
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
      '  "status": "owned|missing|null",',
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
      return { tokens: [], results: results.slice(0, 12), total: results.length, summary: (answer as string).trim(), q: query, aiPowered: true };
    } catch (e) {
      console.warn("[HODD Ollama] search failed, falling back to heuristic:", e.message);
      return null;
    }
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
