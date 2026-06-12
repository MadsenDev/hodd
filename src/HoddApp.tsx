// @ts-nocheck
import React from 'react';
/* ============================================================================
 * HODD API CLIENT  —  the ONLY module that knows the data is mocked.
 * ----------------------------------------------------------------------------
 * Data model (mirrors a normalized backend):
 *   catalog.json   — canonical item records, shared. "What exists in the world."
 *   holdings.json  — per-user records keyed by catalog id. "What you own."
 * The view-models the components consume are JOINS of the two, performed here
 * by joinHolding(). A production backend would do this join in SQL / an ORM and
 * return the same composed shape; swap the body of `request()` for a real fetch
 * and delete mockItemsFor(), and nothing downstream changes.
 *
 * Endpoints (see each payload's meta.endpoint):
 *   GET /api/user                 GET /api/catalog        GET /api/holdings
 *   GET /api/collections          GET /api/collections/:id
 *   GET /api/home                 GET /api/stats          GET /api/search/index
 *   GET /api/items/:id/story
 * ==========================================================================*/
(function () {
  "use strict";

  var BASE = "./data";
  var SIMULATED_LATENCY_MS = 0; // raise (e.g. 220) to feel the loading states.

  // Collections backed by curated catalog rows. Everything else is summary +
  // generated items (a stand-in for collections we have no seed data for).
  var CURATED = { pokemon: true, books: true };
  // Display name per collection id (the catalog groups some ids under a parent).
  var COLL_NAME = { pokemon: "Games", books: "Books", movies: "Movies", games: "Games", coins: "Coins", comics: "Comics", vinyl: "Vinyl" };

  function resolveId(id) { return id === "featured" ? "pokemon" : id; }
  function delay(ms) { return ms > 0 ? new Promise(function (r) { setTimeout(r, ms); }) : Promise.resolve(); }

  /* The single network boundary. Returns the unwrapped `data` field. */
  async function request(path) {
    await delay(SIMULATED_LATENCY_MS);
    var res = await fetch(BASE + "/" + path);
    if (!res.ok) throw new Error("HODD API " + res.status + " — " + path);
    return (await res.json()).data;
  }

  /* ---- the two tables, fetched once and cached ----------------------------- */
  var _catalog = null, _holdingsBase = null;

  /* Local edits live in localStorage as a patch layer over holdings.json, so a
   * user's changes persist across reloads and flow through the same join the
   * rest of the app reads. A row tagged { _deleted:true } means "no longer owned". */
  var OVERRIDE_KEY = "hodd:holdings:v1";
  function readOverrides() {
    try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeOverrides(o) {
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); } catch (e) {}
  }
  /* Personal columns a holding row may carry (everything outside the catalog). */
  var HOLDING_FIELDS = ["format", "completeness", "grade", "pressing", "edition", "condition", "acquired", "watched", "custom"];
  function saveHolding(id, patch) {
    var o = readOverrides(), next = Object.assign({}, o[id], patch);
    delete next._deleted;            // saving implies the item is owned
    o[id] = next;
    writeOverrides(o);
  }
  function removeHolding(id) {        // mark as no longer in the collection
    var o = readOverrides();
    o[id] = { _deleted: true };
    writeOverrides(o);
  }

  /* Canonical (catalog) edits — title / secondary field / year — kept in their
   * own patch layer so a correction to the item itself persists too. */
  var CATALOG_OVERRIDE_KEY = "hodd:catalog:v1";
  var CATALOG_FIELDS = ["title", "sub", "year", "type"];
  function readCatalogOv() {
    try { return JSON.parse(localStorage.getItem(CATALOG_OVERRIDE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCatalog(id, patch) {
    var o = readCatalogOv(); o[id] = Object.assign({}, o[id], patch);
    try { localStorage.setItem(CATALOG_OVERRIDE_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function applyCatalogOv(cat) {
    var o = readCatalogOv()[cat.id];
    return o ? Object.assign({}, cat, o) : cat;
  }

  /* ---- USER-CREATED collections & items ------------------------------------
   * A collection the app never anticipated lives entirely client-side: its
   * definition (name, type, accent, and a default field TEMPLATE) in one layer,
   * its items in another keyed by collection id. New items get real ids, so the
   * same saveHolding / saveCatalog edit layers patch them like any other item. */
  var USERCOLL_KEY = "hodd:usercoll:v1";
  var USERITEMS_KEY = "hodd:useritems:v1";
  function readJSON(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function readUserColls() { return readJSON(USERCOLL_KEY, []); }
  function readUserItems() { return readJSON(USERITEMS_KEY, {}); }
  var USER_HUES = ["#6366f1", "#5BA47A", "#5C8AD6", "#C9A24C", "#CF6B5A", "#7FB0C4", "#9B7BD4", "#C0392B"];
  function slugify(s) { return (String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) || "coll"; }

  function createCollection(def) {
    var colls = readUserColls(), base = slugify(def.name), id = "u-" + base, n = 2;
    var taken = colls.map(function (c) { return c.id; });
    while (taken.indexOf(id) !== -1) { id = "u-" + base + "-" + n; n++; }
    var rec = {
      id: id, name: (def.name || "").trim() || "Untitled collection",
      type: def.type || "other", accent: def.accent || USER_HUES[colls.length % USER_HUES.length],
      template: (def.template || []).map(function (s) { return String(s).trim(); }).filter(Boolean),
      user: true
    };
    colls.push(rec); writeJSON(USERCOLL_KEY, colls);
    return rec;
  }

  function addItem(collectionId, draft) {
    var store = readUserItems(), list = store[collectionId] || [];
    var id = "i-" + Math.random().toString(36).slice(2, 9);
    var rec = Object.assign({ id: id, collectionId: collectionId, owned: true,
      color: draft.color || USER_HUES[list.length % USER_HUES.length] }, draft);
    list.push(rec); store[collectionId] = list; writeJSON(USERITEMS_KEY, store);
    return rec;
  }

  /* Merge the personal + canonical edit layers onto any item record. */
  function applyEdits(it) {
    var hv = readOverrides()[it.id];
    if (hv && hv._deleted) {
      it = Object.assign({}, it, { owned: false });
      HOLDING_FIELDS.forEach(function (k) { it[k] = k === "watched" ? undefined : null; });
    } else if (hv) {
      it = Object.assign({}, it, hv, { owned: true });
    }
    var cv = readCatalogOv()[it.id];
    if (cv) it = Object.assign({}, it, cv);
    return it;
  }
  function userItemsFor(collectionId) {
    return (readUserItems()[collectionId] || []).map(applyEdits);
  }

  async function getCatalog() {
    if (!_catalog) _catalog = await request("catalog.json");
    return _catalog;
  }
  async function getHoldings() {
    if (!_holdingsBase) _holdingsBase = await request("holdings.json");
    var ov = readOverrides(), merged = Object.assign({}, _holdingsBase);
    Object.keys(ov).forEach(function (id) {
      var o = ov[id];
      if (o && o._deleted) delete merged[id];
      else merged[id] = Object.assign({}, merged[id], o);
    });
    return merged;
  }

  /* ---- THE JOIN: canonical item + (optional) personal holding -> view-model -*/
  function joinHolding(cat, h) {
    cat = applyCatalogOv(cat);
    return Object.assign({}, cat, {
      owned: !!h,
      format: (h && h.format) || "—",
      completeness: (h && h.completeness) || null,
      grade: (h && h.grade) || null,
      pressing: (h && h.pressing) || null,
      edition: (h && h.edition) || null,
      condition: (h && h.condition) || null,
      acquired: (h && h.acquired) || null,
      watched: h ? h.watched : undefined,
      custom: (h && h.custom) || null,
    });
  }

  async function getItem(id) {
    var cat = await getCatalog(), h = await getHoldings();
    var row = cat.filter(function (c) { return c.id === id; })[0];
    return row ? joinHolding(row, h[id]) : null;
  }
  async function getItems(ids) {
    var out = [];
    for (var i = 0; i < ids.length; i++) out.push(await getItem(ids[i]));
    return out.filter(Boolean);
  }
  async function getCollectionItems(collectionId) {
    var cat = await getCatalog(), h = await getHoldings();
    return cat
      .filter(function (c) { return c.collectionId === collectionId; })
      .map(function (c) { return joinHolding(c, h[c.id]); });
  }

  /* ---- mock backend: synthesize items for non-curated collections ----------
   * Each row is [title, sub, year]; `sub` is the type's natural secondary
   * field (Director / Platform / Mint / Artist / Author / Publisher). Personal,
   * type-specific columns (grade, pressing, completeness, watched…) are attached
   * per type below — mirroring how the holdings table carries different columns
   * for different item types. */
  var FALLBACK = {
    movie: [["Blade Runner 2049","Denis Villeneuve",2017],["Dune","Denis Villeneuve",2021],["Arrival","Denis Villeneuve",2016],["Sicario","Denis Villeneuve",2015],["Prisoners","Denis Villeneuve",2013],["Enemy","Denis Villeneuve",2013],["Interstellar","Christopher Nolan",2014],["The Northman","Robert Eggers",2022],["Drive","Nicolas W. Refn",2011],["Annihilation","Alex Garland",2018]],
    game:  [["Link's Awakening","Game Boy",1993],["Metroid II","Game Boy",1991],["Tetris","Game Boy",1989],["Wario Land","Game Boy",1994],["Kirby's Dream Land","Game Boy",1992],["Donkey Kong","Game Boy",1994],["Super Mario Land","Game Boy",1989],["Castlevania","Game Boy",1989]],
    coin:  [["Morgan 1884-O","New Orleans Mint",1884],["Peace 1922","Philadelphia Mint",1922],["Walking Liberty","Philadelphia Mint",1943],["Mercury Dime","Philadelphia Mint",1942],["Buffalo Nickel","Denver Mint",1936],["Indian Head","Philadelphia Mint",1907],["Barber Half","San Francisco Mint",1899],["Standing Liberty","Denver Mint",1917]],
    comic: [["Saga #1","Image Comics",2012],["Sandman #1","DC / Vertigo",1989],["Watchmen","DC Comics",1986],["Daytripper","DC / Vertigo",2010],["Hellboy","Dark Horse",1994],["Bone","Cartoon Books",1991],["Locke & Key","IDW",2008],["Paper Girls","Image Comics",2015]],
    vinyl: [["Kind of Blue","Miles Davis",1959],["Blue Train","John Coltrane",1957],["Rumours","Fleetwood Mac",1977],["OK Computer","Radiohead",1997],["In Rainbows","Radiohead",2007],["Random Access Memories","Daft Punk",2013],["Discovery","Daft Punk",2001],["Currents","Tame Impala",2015]],
    book:  [["Dune","Frank Herbert",1965],["The Hobbit","J.R.R. Tolkien",1937],["Foundation","Isaac Asimov",1951],["Hyperion","Dan Simmons",1989],["Neuromancer","William Gibson",1984],["Snow Crash","Neal Stephenson",1992],["The Left Hand of Darkness","Ursula K. Le Guin",1969],["Solaris","Stanisław Lem",1961]]
  };
  var SPINE_HUES = ["#C0392B","#2C6FB0","#D4A02A","#3B9C6D","#9B7BD4","#CF6B5A","#5BA47A","#7FB0C4"];
  /* Physical medium per type — the "Format" of a copy (never a status). */
  var MEDIUM = { game: "Cartridge", book: "Hardcover", movie: "Blu-ray", coin: "Silver dollar", vinyl: "Vinyl LP", comic: "Single issue" };
  function mockItemsFor(summary) {
    var type = summary.type, ov = readOverrides(), catOv = readCatalogOv();
    return (FALLBACK[type] || []).map(function (row, i) {
      var id = type + "-" + i;
      var owned = i % 3 !== 2;
      var it = {
        id: id, title: row[0], sub: row[1], type: type,
        year: row[2], owned: owned, color: SPINE_HUES[i % SPINE_HUES.length]
      };
      if (owned) {
        it.format = MEDIUM[type] || "Standard";
        if (type === "game")  { it.completeness = i % 2 ? "Complete in box" : "Loose"; it.condition = i % 3 ? "Very Good" : "Mint"; }
        else if (type === "coin")  { it.grade = "MS-6" + (2 + (i % 4)); }
        else if (type === "vinyl") { it.pressing = i % 2 ? "180g" : "Standard weight"; }
        else if (type === "movie") { it.watched = i % 2 === 0; }
        else if (type === "comic") { it.condition = i % 2 ? "Near Mint" : "Very Fine"; }
        else if (type === "book" && i % 3 === 0) { it.edition = "First Edition"; }
      }
      var o = ov[id];
      if (o && o._deleted) {
        it.owned = false;
        HOLDING_FIELDS.forEach(function (k) { it[k] = k === "watched" ? undefined : null; });
      } else if (o) {
        it.owned = true;
        Object.assign(it, o);
        if (!it.format) it.format = MEDIUM[type] || "Standard";
      }
      var co = catOv[id];
      if (co) Object.assign(it, co);   // canonical edits (title / sub / year)
      return it;
    });
  }

  /* ---- endpoints ----------------------------------------------------------- */
  function getUser() { return request("user.json"); }
  async function getCollections() {
    var base = await request("collections.json");
    var store = readUserItems();
    // bump built-in counts by any items the user has added to them
    base = base.map(function (c) {
      var extra = (store[c.id] || []).map(applyEdits);
      if (!extra.length) return c;
      var ownedExtra = extra.filter(function (i) { return i.owned !== false; }).length;
      var owned = c.owned + ownedExtra, total = c.owned + c.missing + extra.length;
      return Object.assign({}, c, { owned: owned, pct: total ? Math.round(owned / total * 100) : c.pct });
    });
    var made = readUserColls().map(function (rc) {
      var its = (store[rc.id] || []).map(applyEdits);
      var owned = its.filter(function (i) { return i.owned !== false; }).length;
      return {
        id: rc.id, name: rc.name, type: rc.type, accent: rc.accent,
        owned: owned, missing: 0, pct: its.length ? Math.round(owned / its.length * 100) : 0,
        user: true, template: rc.template
      };
    });
    return base.concat(made);
  }
  function getStats() { return request("stats.json"); }

  async function getCollection(id) {
    var resolved = resolveId(id);
    var made = readUserColls().filter(function (c) { return c.id === resolved; })[0];
    var extra = userItemsFor(resolved);
    if (made) {
      var ownedN = extra.filter(function (i) { return i.owned !== false; }).length;
      return {
        id: made.id, name: made.name, type: made.type, accent: made.accent,
        user: true, template: made.template, owned: ownedN, missing: 0,
        pct: extra.length ? Math.round(ownedN / extra.length * 100) : 0,
        sub: ownedN + (ownedN === 1 ? " item" : " items"), items: extra
      };
    }
    if (CURATED[resolved]) {
      var summary = resolved === "pokemon"
        ? await request("collections/pokemon.json")
        : (await getCollections()).filter(function (c) { return c.id === resolved; })[0];
      return Object.assign({}, summary, {
        sub: summary.sub || (summary.owned + " owned · " + summary.missing + " missing"),
        items: (await getCollectionItems(resolved)).concat(extra)
      });
    }
    var all = await getCollections();
    var s = all.filter(function (c) { return c.id === resolved; })[0] || all[0];
    return Object.assign({}, s, { sub: s.owned + " owned · " + s.missing + " missing", items: mockItemsFor(s).concat(extra) });
  }

  /* Collection summaries, each expanded with its joined items — so a grid can
   * show real cover art per collection without N round-trips at the call site. */
  async function getCollectionsExpanded() {
    var list = await getCollections();
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var full = await getCollection(list[i].id);
      out.push(Object.assign({}, list[i], { items: full.items || [] }));
    }
    return out;
  }

  async function getHome() {
    var home = await request("home.json");
    home.featured = await getCollection(home.featuredCollectionId);
    home.recent = await getItems(home.recentIds);
    home.wishlist = Object.assign({}, home.wishlist, { items: await getItems(home.wishlist.itemIds) });
    var redItem = await getItem(home.rediscover.itemId);
    home.rediscover = Object.assign({}, redItem, home.rediscover); // note overrides nothing on item
    return home;
  }

  /* Story bundle, fetched once. In production this is a field on the item. */
  var _stories = null;
  var STORY_OVERRIDE_KEY = "hodd:stories:v1";
  function readStoryOv() {
    try { return JSON.parse(localStorage.getItem(STORY_OVERRIDE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveStory(id, paragraphs) {
    var o = readStoryOv(); o[id] = paragraphs;
    try { localStorage.setItem(STORY_OVERRIDE_KEY, JSON.stringify(o)); } catch (e) {}
  }
  async function getStory(id) {
    if (!id) return null;
    if (!_stories) _stories = await request("stories.json");
    var ov = readStoryOv()[id];
    return ov || _stories[id] || null;
  }

  /* Search index: every catalog item joined with its holding, plus the
   * denormalized fields the on-device engine filters over. */
  async function getSearchIndex() {
    var cat = await getCatalog(), h = await getHoldings();
    return cat.map(function (c) {
      var item = joinHolding(c, h[c.id]);
      item.coll = COLL_NAME[c.collectionId] || "Hoard";
      if (c.type === "game") item.platform = c.sub;
      if (c.type === "book") item.author = c.sub;
      // "completed" is a derived projection for the main-line Pokémon set.
      if (c.collectionId === "pokemon") item.completed = item.owned && c.year < 1999;
      return item;
    });
  }

  window.HoddAPI = {
    getUser: getUser,
    getCatalog: getCatalog,
    getHoldings: getHoldings,
    getCollections: getCollections,
    getCollectionsExpanded: getCollectionsExpanded,
    getCollection: getCollection,
    getItem: getItem,
    getHome: getHome,
    getStats: getStats,
    getStory: getStory,
    getSearchIndex: getSearchIndex,
    saveHolding: saveHolding,
    removeHolding: removeHolding,
    saveCatalog: saveCatalog,
    saveStory: saveStory,
    createCollection: createCollection,
    addItem: addItem,
    HOLDING_FIELDS: HOLDING_FIELDS
  };
})();
/* HODD icons — the hoard mark + UI line icons. All stroke = currentColor. */

// The Hodd mark: "Shelf H" — the letter H built as a stack of three spines.
// A monogram that doubles as a shelf of collected things. Filled, square.
function HoddMark({ size = 28, stroke = 1.6, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={style}>
      <g fill={color}>
        <rect x="22" y="24" width="9" height="52" rx="4" />
        <rect x="69" y="24" width="9" height="52" rx="4" />
        <rect x="31" y="35" width="38" height="7.5" rx="3.75" />
        <rect x="31" y="46.25" width="38" height="7.5" rx="3.75" />
        <rect x="31" y="57.5" width="38" height="7.5" rx="3.75" />
      </g>
    </svg>
  );
}

// Generic line-icon wrapper
function Icon({ children, size = 20, stroke = 1.7, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className}>
      {children}
    </svg>
  );
}

const I = {
  home: (p) => <Icon {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9h14v-9" /><path d="M9.5 19v-5h5v5" /></Icon>,
  grid: (p) => <Icon {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="1.4" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4" /></Icon>,
  heart: (p) => <Icon {...p}><path d="M12 20s-7-4.5-9.2-8.6C1.3 8.3 2.8 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.2 0 4.7 3.3 3.2 6.4C19 15.5 12 20 12 20Z" /></Icon>,
  clock: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Icon>,
  compass: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 Z" /></Icon>,
  chart: (p) => <Icon {...p}><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></Icon>,
  search: (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Icon>,
  plus: (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>,
  bell: (p) => <Icon {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10.5 19a1.7 1.7 0 0 0 3 0" /></Icon>,
  settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1A2 2 0 1 1 2.5 16l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 3.4 6.5l-.1-.1A2 2 0 1 1 6 3.6l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1A2 2 0 1 1 21.5 6l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.2 1Z" /></Icon>,
  arrowRight: (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>,
  arrowLeft: (p) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>,
  check: (p) => <Icon {...p}><path d="M4 12.5 9 17.5 20 6.5" /></Icon>,
  sparkle: (p) => <Icon {...p}><path d="M12 3.5c.6 3.7 1.8 4.9 5.5 5.5-3.7.6-4.9 1.8-5.5 5.5-.6-3.7-1.8-4.9-5.5-5.5 3.7-.6 4.9-1.8 5.5-5.5Z" /><path d="M18.5 14.5c.3 1.7.9 2.3 2.5 2.6-1.6.3-2.2.9-2.5 2.6-.3-1.7-.9-2.3-2.5-2.6 1.6-.3 2.2-.9 2.5-2.6Z" /></Icon>,
  book: (p) => <Icon {...p}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" /><path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5A1.5 1.5 0 0 1 5 19.5Z" /></Icon>,
  film: (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></Icon>,
  gamepad: (p) => <Icon {...p}><path d="M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.2 2l-.8-.9H9l-.8.9A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4Z" /><path d="M7.5 11v2M6.5 12h2M15.5 11.5h.01M17.5 13.5h.01" /></Icon>,
  coin: (p) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.5" /></Icon>,
  comic: (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="1.6" /><path d="M8 3v18" /><path d="M11 7h6M11 10h6M11 13h4" /></Icon>,
  disc: (p) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2" /></Icon>,
  eye: (p) => <Icon {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></Icon>,
  lock: (p) => <Icon {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>,
  tag: (p) => <Icon {...p}><path d="M3 12V4h8l9 9-8 8-9-9Z" /><circle cx="7.5" cy="7.5" r="1.4" /></Icon>,
  calendar: (p) => <Icon {...p}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icon>,
  close: (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>,
  edit: (p) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M13.5 6.5 17.5 10.5" /></Icon>,
  trash: (p) => <Icon {...p}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></Icon>,
  enter: (p) => <Icon {...p}><path d="M5 12h12M13 7l5 5-5 5" /><path d="M18 5v14" opacity=".5" /></Icon>,
  diamond: (p) => <Icon {...p}><path d="M12 3 19 12 12 21 5 12Z" /></Icon>,
  alert: (p) => <Icon {...p}><path d="M12 3.5 22 20H2L12 3.5Z" /><path d="M12 10v4.5" /><path d="M12 17.5h.01" /></Icon>,
  refresh: (p) => <Icon {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></Icon>,
};

// Map a collection/item type to its glyph
function typeIcon(type, props) {
  const m = { book: I.book, movie: I.film, game: I.gamepad, coin: I.coin, comic: I.comic, vinyl: I.disc, other: I.tag };
  const Fn = m[type] || I.grid;
  return Fn(props);
}

Object.assign(window, { HoddMark, Icon, I, typeIcon });
/* ===== HODD shared components ===== */

function CompletionRing({ pct = 0, size = 54, stroke = 5, color = "var(--gold)", track = "var(--panel-3)", showPct = true, fontSize }) {
  const uid = React.useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const val = Math.round(Math.max(0, Math.min(100, pct)));
  const off = c * (1 - val / 100);
  // Resolve a concrete hue (CSS vars can't be read by SVG stroke reliably)
  const map = { "var(--gold)": "var(--accent)", "var(--accent)": "var(--accent)" };
  const base = map[color] || color;
  const numSize = fontSize || Math.round(size * 0.30);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ display: "block", overflow: "visible" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={base} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset 1.1s var(--ease)" }} />
      </svg>
      {showPct && (
        <div className="pct">
          <span className="pct-wrap">
            <span className="pct-num" style={{ fontSize: numSize }}>{val}</span>
            <span className="pct-unit" style={{ fontSize: Math.max(9, numSize * 0.48) }}>%</span>
          </span>
        </div>
      )}
    </div>
  );
}

/* hex -> rgba */
function rgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(x=>x+x).join("") : h, 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function shade(hex, amt) {
  const h = hex.replace("#",""); const n = parseInt(h,16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  r=Math.max(0,Math.min(255,r+amt)); g=Math.max(0,Math.min(255,g+amt)); b=Math.max(0,Math.min(255,b+amt));
  return `rgb(${r},${g},${b})`;
}

/* width:height ratio per cover type (shared by Cover + FluidCover) */
const COVER_RATIOS = { game: 0.72, book: 0.68, movie: 0.67, comic: 0.66, coin: 1, vinyl: 1, other: 0.74 };

/* Cover — typographic box-art placeholder, varies by type */
function Cover({ item, h = 168, ghost = false, onClick, glyph = true }) {
  const type = item.type || item.coverType || "game";
  const ratios = COVER_RATIOS;
  const ratio = ratios[type] || 0.7;
  const w = type === "coin" || type === "vinyl" ? h : Math.round(h * ratio);
  const color = item.color || "#7a6a4a";
  const cls = "cover" + (onClick ? " click" : "") + (ghost ? " ghost" : "");

  if (ghost) {
    const Glyph = typeIcon(type, { size: Math.max(20, h*0.16), stroke: 1.4 });
    return (
      <div className={cls} style={{ width: w, height: h, background: "var(--panel-2)",
        border: "1.5px dashed var(--border-strong)", display: "grid", placeItems: "center", borderRadius: 7 }}
        onClick={onClick} title="Missing">
        <div style={{ color: "var(--mute)", display: "grid", placeItems: "center", gap: 8 }}>
          {glyph && Glyph}
          <I.plus size={16} stroke={1.6} style={{ opacity: .55 }} />
        </div>
      </div>
    );
  }

  // COIN
  if (type === "coin") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: "50%", onClick,
        background: `radial-gradient(circle at 38% 32%, ${shade(color,40)}, ${color} 45%, ${shade(color,-55)} 100%)`,
        boxShadow: `inset 0 2px 6px ${rgba("#ffffff",0.25)}, inset 0 -6px 14px ${rgba("#000000",0.5)}, 0 14px 26px -14px rgba(0,0,0,.85)`,
        display: "grid", placeItems: "center" }} onClick={onClick}>
        <div style={{ width: "76%", height: "76%", borderRadius: "50%", border: `1.5px solid ${rgba("#000",0.25)}`,
          display: "grid", placeItems: "center", textAlign: "center", padding: 6 }}>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: h*0.13, fontWeight: 600, color: rgba("#241a08",0.8), lineHeight: 1 }}>{(item.title||"").split(" ")[0]}</div>
            <div style={{ fontSize: h*0.07, letterSpacing: ".1em", color: rgba("#241a08",0.7), marginTop: 4 }}>{item.year || ""}</div>
          </div>
        </div>
      </div>
    );
  }

  // VINYL
  if (type === "vinyl") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: 6, onClick,
        background: `linear-gradient(135deg, ${shade(color,20)}, ${shade(color,-40)})`, position: "relative", overflow: "hidden" }} onClick={onClick}>
        <div style={{ position: "absolute", right: -h*0.18, top: "50%", transform: "translateY(-50%)", width: h*0.78, height: h*0.78, borderRadius: "50%",
          background: `repeating-radial-gradient(circle, #111 0 2px, #1a1a1a 2px 4px)`, boxShadow: "0 0 0 3px #0a0a0a" }}>
          <div style={{ position:"absolute", inset:"38%", borderRadius:"50%", background: color }} />
        </div>
        <div style={{ position: "absolute", left: 12, bottom: 12, fontFamily: "var(--serif)", fontSize: h*0.12, color: "#fff", maxWidth: "60%", lineHeight: 1.05 }}>{item.title}</div>
      </div>
    );
  }

  // GAME (Game Boy box)
  if (type === "game") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: 6, overflow: "hidden", onClick,
        background: "#15110a", border: "1px solid rgba(0,0,0,0.5)" }} onClick={onClick}>
        <div style={{ height: "15%", background: "linear-gradient(180deg,#2b2b2b,#161616)", display: "flex", alignItems: "center", padding: "0 8%",
          borderBottom: "2px solid " + rgba(color,0.9) }}>
          <span style={{ fontSize: Math.max(7, h*0.052), fontWeight: 800, letterSpacing: ".06em", color: "#d8d8d8" }}>GAME BOY</span>
        </div>
        <div style={{ height: "85%", padding: "10% 9% 9%", display: "flex", flexDirection: "column", justifyContent: "center",
          background: `radial-gradient(120% 90% at 50% 18%, ${shade(color,35)}, ${shade(color,-30)} 80%)` }}>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: h*0.115, color: "#fff", lineHeight: 1.05, textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>{item.title}</div>
          {item.sub && <div style={{ fontSize: h*0.06, color: rgba("#fff",0.78), marginTop: 6, letterSpacing: ".02em" }}>{item.sub}</div>}
        </div>
      </div>
    );
  }

  // COMIC
  if (type === "comic") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: 5, overflow: "hidden", onClick,
        background: `linear-gradient(160deg, ${shade(color,30)}, ${shade(color,-35)})`, position: "relative" }} onClick={onClick}>
        <div style={{ background: rgba("#000",0.32), padding: "7% 8%", borderBottom: `2px solid ${rgba("#fff",0.18)}` }}>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: h*0.1, color: "#fff", lineHeight: 1.05 }}>{item.title}</div>
        </div>
        <div style={{ position: "absolute", bottom: "8%", left: "8%", fontSize: h*0.055, color: rgba("#fff",0.8) }}>{item.sub || ""}</div>
      </div>
    );
  }

  // BOOK (hardcover)
  if (type === "book") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: "3px 6px 6px 3px", overflow: "hidden", onClick,
        background: `linear-gradient(110deg, ${shade(color,-30)} 0 7px, ${shade(color,10)} 7px 11px, ${color} 11px)`,
        position: "relative", boxShadow: `inset -8px 0 14px ${rgba("#000",0.28)}, 0 14px 26px -14px rgba(0,0,0,.85)` }} onClick={onClick}>
        <div style={{ position: "absolute", inset: "11% 9% 11% 16%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          border: `1px solid ${rgba("#000",0.18)}`, padding: "9% 7%" }}>
          <div style={{ borderTop: `1px solid ${rgba("#f0e3b8",0.4)}`, borderBottom: `1px solid ${rgba("#f0e3b8",0.4)}`, padding: "8% 0", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: h*0.115, color: rgba("#f3ead0",0.95), lineHeight: 1.08 }}>{item.title}</div>
          </div>
          <div style={{ textAlign: "center", fontSize: h*0.058, letterSpacing: ".08em", textTransform: "uppercase", color: rgba("#f3ead0",0.75) }}>{item.sub || item.author || ""}</div>
        </div>
      </div>
    );
  }

  // MOVIE (poster)
  if (type === "movie") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: 5, overflow: "hidden", onClick,
        background: `linear-gradient(180deg, ${shade(color,25)}, ${shade(color,-45)} 88%)`, position: "relative" }} onClick={onClick}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 50% at 50% 22%, ${rgba("#fff",0.22)}, transparent 70%)` }} />
        <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "8%" }}>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: h*0.13, color: "#fff", lineHeight: 1, textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>{item.title}</div>
          {item.sub && <div style={{ fontSize: h*0.052, letterSpacing: ".14em", textTransform: "uppercase", color: rgba("#fff",0.8), marginTop: 6 }}>{item.sub || item.format}</div>}
        </div>
      </div>
    );
  }

  // OTHER / generic keepsake — for any type we don't render bespoke art for
  return (
    <div className={cls} style={{ width: w, height: h, borderRadius: 8, overflow: "hidden", onClick,
      background: `linear-gradient(150deg, ${shade(color,30)}, ${shade(color,-40)} 92%)`, position: "relative" }} onClick={onClick}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(72% 48% at 50% 16%, ${rgba("#fff",0.20)}, transparent 70%)` }} />
      <div style={{ position: "absolute", top: "13%", left: 0, right: 0, display: "grid", placeItems: "center" }}>
        <div style={{ width: h*0.2, height: h*0.2, border: `2px solid ${rgba("#fff",0.55)}`, borderRadius: 5, transform: "rotate(45deg)" }} />
      </div>
      <div style={{ position: "absolute", left: "9%", right: "9%", bottom: "9%" }}>
        <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: h*0.108, color: "#fff", lineHeight: 1.06, textShadow: "0 2px 6px rgba(0,0,0,.5)", overflowWrap: "break-word", hyphens: "auto" }}>{item.title}</div>
        {item.sub && <div style={{ fontSize: h*0.05, letterSpacing: ".12em", textTransform: "uppercase", color: rgba("#fff",0.8), marginTop: 6, overflowWrap: "break-word" }}>{item.sub}</div>}
      </div>
    </div>
  );
}

/* FluidCover — fills its container's width and derives a flexible height from
 * the cover type's aspect ratio, so square art (coins, vinyl) no longer
 * overflows a narrow column. Keeps Cover's pixel-based internal scaling. */
function FluidCover({ item, ghost = false, onClick, glyph = true, maxWidth = 999 }) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const type = item.type || item.coverType || "game";
  const ratio = COVER_RATIOS[type] || 0.7;          // width / height
  const eff = Math.min(w || 0, maxWidth);
  const h = eff ? Math.round(eff / ratio) : 0;        // height that fills width
  return (
    <div ref={ref} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      {h > 0 && <Cover item={item} h={h} ghost={ghost} glyph={glyph} onClick={onClick} />}
    </div>
  );
}

/* ===== Sidebar ===== */
function Sidebar({ active, onNav }) {
  const items = [
    ["home", "Home", I.home],
    ["collections", "Collections", I.grid],
    ["wishlist", "Wishlist", I.heart],
    ["timeline", "Timeline", I.clock],
    ["discover", "Discover", I.compass],
    ["statistics", "Statistics", I.chart],
    ["search", "Search", I.search],
  ];
  return (
    <aside className="sidebar">
      <div className="brand" onClick={() => onNav("home")} style={{ cursor: "pointer" }}>
        <HoddMark size={34} color="var(--gold)" />
        <div className="wordmark">HODD</div>
        <div className="tagline">Your hoard. Your story.</div>
      </div>
      <nav className="nav">
        {items.map(([id, label, Ic]) => (
          <div key={id} className={"nav-item" + (active === id ? " active" : "")} onClick={() => onNav(id)}>
            <Ic size={20} stroke={1.7} />
            <span>{label}</span>
          </div>
        ))}
      </nav>
      <div className="spacer" />
      <div className="nav-item" onClick={() => onNav("settings")}>
        <I.settings size={20} stroke={1.6} /><span>Settings</span>
      </div>
      <div className="user">
        <div className="avatar avatar-initials" aria-label="Chris">C</div>
        <div className="meta">
          <div className="nm">Chris</div>
          <div className="sub">View profile</div>
        </div>
      </div>
    </aside>
  );
}

/* ===== Topbar ===== */
function Topbar({ title, subtitle, bare, onSearch, onAdd, searchValue, onSearchChange, onSearchSubmit }) {
  return (
    <div className="topbar" style={bare ? { marginBottom: 6 } : null}>
      {!bare && (
        <div className="greet">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      {bare && <div style={{ flex: 1 }} />}
      <div className="topbar-actions" style={bare ? { paddingTop: 0 } : null}>
        <div className="search-bar" onClick={onSearch}>
          <I.search size={18} stroke={1.7} />
          <input placeholder="Search your collection…" value={searchValue || ""}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && onSearchSubmit) onSearchSubmit(e.target.value); }}
            onFocus={onSearch} />
        </div>
        <button className="icon-btn" title="Notifications"><I.bell size={20} stroke={1.7} /></button>
        <button className="add-btn" onClick={onAdd} title="Add item"><I.plus size={22} stroke={2} /></button>
      </div>
    </div>
  );
}

/* ===== Mobile chrome ===== */
function MobileTopBar({ onAdd }) {
  return (
    <div className="mobile-topbar">
      <div className="mt-brand">
        <HoddMark size={22} color="var(--gold)" />
        <span>HODD</span>
      </div>
      <div className="mt-actions">
        <button className="icon-btn sm" title="Notifications"><I.bell size={18} stroke={1.7} /></button>
        <button className="add-btn sm" onClick={onAdd} title="Add item"><I.plus size={19} stroke={2} /></button>
      </div>
    </div>
  );
}

function MobileTabs({ active, onNav }) {
  const tabs = [
    ["home", "Home", I.home],
    ["collections", "Library", I.grid],
    ["search", "Search", I.search],
    ["timeline", "Timeline", I.clock],
    ["wishlist", "Wishlist", I.heart],
  ];
  return (
    <nav className="mobile-tabs">
      {tabs.map(([id, label, Ic]) => (
        <button key={id} className={"mtab" + (active === id ? " on" : "")} onClick={() => onNav(id)}>
          <Ic size={22} stroke={active === id ? 2 : 1.7} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/* viewport hook */
function useNarrow(bp = 760) {
  const [n, setN] = React.useState(typeof window !== "undefined" && window.innerWidth <= bp);
  React.useEffect(() => {
    const on = () => setN(window.innerWidth <= bp);
    window.addEventListener("resize", on); on();
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return n;
}

/* ===== Async view states (loading / error / empty) =====
 * Every data-backed view renders one of these while its hook resolves, so the
 * loading + failure paths are real product states — not invisible assumptions
 * baked into a synchronous mock. */
function Loading({ label = "Loading your hoard…" }) {
  return (
    <div className="view-state view-enter">
      <svg className="loading-mark" width="48" height="48" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <g fill="currentColor">
          <rect x="22" y="24" width="9" height="52" rx="4" />
          <rect x="69" y="24" width="9" height="52" rx="4" />
          <rect className="lm-spine s1" x="31" y="35" width="38" height="7.5" rx="3.75" />
          <rect className="lm-spine s2" x="31" y="46.25" width="38" height="7.5" rx="3.75" />
          <rect className="lm-spine s3" x="31" y="57.5" width="38" height="7.5" rx="3.75" />
        </g>
      </svg>
      <div className="view-state-sub">{label}</div>
    </div>
  );
}

function ErrorState({ error, onRetry, label = "We couldn't load this" }) {
  return (
    <div className="view-state view-enter" role="alert">
      <div className="view-state-ic err"><I.alert size={26} stroke={1.7} /></div>
      <div className="em">{label}</div>
      <div className="view-state-sub">{(error && error.message) || "Something went wrong reaching your hoard."}</div>
      {onRetry && <button className="btn" onClick={onRetry} style={{ marginTop: 16 }}><I.refresh size={15} /> Try again</button>}
    </div>
  );
}

function EmptyState({ title = "Nothing here yet", sub, children }) {
  return (
    <div className="view-state view-enter">
      <div className="view-state-ic"><HoddMark size={40} color="var(--gold-deep)" style={{ opacity: .5 }} /></div>
      <div className="em">{title}</div>
      {sub && <div className="view-state-sub">{sub}</div>}
      {children}
    </div>
  );
}

/* Convenience: render the right state for a hook result. Returns the children
 * (via render fn) only once data is present. */
function Async({ state, children, loadingLabel }) {
  if (state.loading) return <Loading label={loadingLabel} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.refetch} />;
  return children(state.data);
}

Object.assign(window, { CompletionRing, Cover, FluidCover, COVER_RATIOS, Sidebar, Topbar, MobileTopBar, MobileTabs, useNarrow, rgba, shade, Loading, ErrorState, EmptyState, Async });
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-omelette-chrome=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});
/* ============================================================================
 * HODD DATA HOOKS
 * ----------------------------------------------------------------------------
 * Thin wrappers over HoddAPI that give every view the same React-Query-style
 * contract: { data, loading, error, refetch }. To move to TanStack Query /
 * SWR / RTK Query in production, replace each hook body with a `useQuery(...)`
 * call against the same HoddAPI endpoint — the return shape is identical, so
 * no consuming component changes.
 * ==========================================================================*/

/* Generic async runner. `deps` controls when the request re-fires (like a
 * query key). Guards against setState-after-unmount and out-of-order responses. */
function useAsync(fn, deps) {
  const [state, setState] = React.useState({ data: null, loading: true, error: null });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then(
        (data) => { if (alive) setState({ data, loading: false, error: null }); },
        (error) => {
          if (alive) setState({ data: null, loading: false, error });
          if (typeof console !== "undefined") console.error("[HODD] data error:", error);
        }
      );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(deps || []), nonce]);

  const refetch = React.useCallback(() => setNonce((n) => n + 1), []);
  return { data: state.data, loading: state.loading, error: state.error, refetch };
}

const useUser        = ()   => useAsync(() => window.HoddAPI.getUser(), []);
const useCollections = ()   => useAsync(() => window.HoddAPI.getCollections(), []);
const useCollectionsFull = () => useAsync(() => window.HoddAPI.getCollectionsExpanded(), []);
const useCollection  = (id) => useAsync(() => (id ? window.HoddAPI.getCollection(id) : Promise.resolve(null)), [id]);
const useHome        = ()   => useAsync(() => window.HoddAPI.getHome(), []);
const useStats       = ()   => useAsync(() => window.HoddAPI.getStats(), []);
const useStory       = (id) => useAsync(() => window.HoddAPI.getStory(id), [id]);
const useSearchIndex = ()   => useAsync(() => window.HoddAPI.getSearchIndex(), []);

/* Combine several hook results into one { data:[...], loading, error, refetch }
 * so a view that needs multiple endpoints still renders a single state. */
function combine() {
  const states = Array.prototype.slice.call(arguments);
  return {
    data: states.every((s) => s.data != null) ? states.map((s) => s.data) : null,
    loading: states.some((s) => s.loading),
    error: states.map((s) => s.error).filter(Boolean)[0] || null,
    refetch: () => states.forEach((s) => s.refetch && s.refetch()),
  };
}

Object.assign(window, {
  useAsync, useUser, useCollections, useCollectionsFull, useCollection, useHome, useStats, useStory, useSearchIndex, combine
});
/* ===== HODD local-AI mock =====
   A small, deterministic "on-device" engine:
   - parseHoardLines(text): turns collector shorthand into structured, confidence-scored items
   - searchHoard(query): turns a plain-language question into filters + results + a written answer
   These are heuristic (keyword + pattern) — no network — but they genuinely react to input,
   so the demo feels like real local inference rather than a canned script. */

/* ---- type vocabulary ---- */
const TYPE_KW = {
  game:  ["game", "games", "gameboy", "game boy", "gba", "snes", "nes", "n64", "nintendo", "cart", "cartridge", "cib", "pokemon", "pokémon", "zelda", "mario", "metroid", "kirby", "wario"],
  book:  ["book", "books", "novel", "hardcover", "paperback", "hardback", "tolkien", "hobbit", "dune", "foundation", "asimov", "author", "first edition"],
  movie: ["movie", "movies", "film", "blu-ray", "bluray", "blu ray", "4k", "uhd", "dvd", "criterion", "steelbook"],
  coin:  ["coin", "coins", "dollar", "morgan", "peace", "mint", "dime", "nickel", "penny", "cent", "half", "ms-", "ms6", "ms 6", "graded", "silver eagle", "bullion"],
  comic: ["comic", "comics", "issue", "floppy", "trade paperback", "tpb", "omnibus"],
  vinyl: ["vinyl", "record", "records", "lp", "180g", "180 gram", "45rpm", "album pressing"],
};
const TYPE_LABEL = { game: "Game", book: "Book", movie: "Movie", coin: "Coin", comic: "Comic", vinyl: "Vinyl" };
const TYPE_COLL  = { game: "Games", book: "Books", movie: "Movies", coin: "Coins", comic: "Comics", vinyl: "Vinyl" };
const TYPE_COLOR = { game: "#9B7BD4", book: "#5BA47A", movie: "#5C8AD6", coin: "#C9A24C", comic: "#CF6B5A", vinyl: "#7FB0C4" };

/* ---- marquee titles the engine "knows" (drives confident enrichment) ---- */
const KNOWN_TITLES = [
  { kw: ["pokemon red", "pokémon red"],         title: "Pokémon Red",      type: "game", platform: "Game Boy",         year: 1996, color: "#C0392B" },
  { kw: ["pokemon blue", "pokémon blue"],       title: "Pokémon Blue",     type: "game", platform: "Game Boy",         year: 1996, color: "#2C6FB0" },
  { kw: ["pokemon yellow", "pokémon yellow"],   title: "Pokémon Yellow",   type: "game", platform: "Game Boy",         year: 1998, color: "#D4A02A" },
  { kw: ["pokemon crystal", "pokémon crystal"], title: "Pokémon Crystal",  type: "game", platform: "Game Boy Color",   year: 2000, color: "#5FA8C4" },
  { kw: ["link's awakening", "links awakening", "zelda awakening"], title: "Link's Awakening", type: "game", platform: "Game Boy", year: 1993, color: "#3E8E5A" },
  { kw: ["super mario land"],                   title: "Super Mario Land", type: "game", platform: "Game Boy",         year: 1989, color: "#C77A2E" },
  { kw: ["metroid ii", "metroid 2"],            title: "Metroid II",       type: "game", platform: "Game Boy",         year: 1991, color: "#7A2E2A" },
  { kw: ["morgan dollar", "morgan silver", "morgan"], title: "Morgan Dollar", type: "coin", year: 1884, color: "#A9A8A2" },
  { kw: ["peace dollar"],                        title: "Peace Dollar",     type: "coin", year: 1922, color: "#B0AFA8" },
  { kw: ["walking liberty"],                     title: "Walking Liberty",  type: "coin", year: 1943, color: "#A9A8A2" },
  { kw: ["dune"],                                title: "Dune",             type: "book", author: "Frank Herbert",     year: 1965, color: "#C9923B" },
  { kw: ["the hobbit", "hobbit"],                title: "The Hobbit",       type: "book", author: "J.R.R. Tolkien",     year: 1937, color: "#3C4A2E" },
  { kw: ["fellowship of the ring", "fellowship"],title: "The Fellowship of the Ring", type: "book", author: "J.R.R. Tolkien", year: 1954, color: "#5A3E22" },
  { kw: ["two towers"],                          title: "The Two Towers",   type: "book", author: "J.R.R. Tolkien",     year: 1954, color: "#7A2E2A" },
  { kw: ["return of the king"],                  title: "The Return of the King", type: "book", author: "J.R.R. Tolkien", year: 1955, color: "#2E4258" },
  { kw: ["foundation"],                          title: "Foundation",       type: "book", author: "Isaac Asimov",       year: 1951, color: "#4A3A5A" },
  { kw: ["blade runner 2049", "blade runner"],   title: "Blade Runner 2049",type: "movie", year: 2017, color: "#C77A2E" },
  { kw: ["interstellar"],                        title: "Interstellar",     type: "movie", year: 2014, color: "#3A4A66" },
  { kw: ["kind of blue"],                        title: "Kind of Blue",     type: "vinyl", artist: "Miles Davis",       year: 1959, color: "#3A6EA5" },
];

/* ---- format / edition detection ---- */
const FORMATS = [
  { re: /\bcib\b|complete in box/i,            label: "Complete In Box",   types: ["game"] },
  { re: /\bsealed\b|brand new|\bnib\b/i,       label: "Sealed",            types: ["game", "movie", "vinyl"] },
  { re: /\bloose\b|cart only|\bcart\b|cartridge/i, label: "Cartridge only", types: ["game"] },
  { re: /\b4k\b|uhd/i,                          label: "4K Blu-ray",        types: ["movie"] },
  { re: /blu-?\s?ray/i,                         label: "Blu-ray",           types: ["movie"] },
  { re: /\bdvd\b/i,                             label: "DVD",               types: ["movie"] },
  { re: /criterion/i,                           label: "Criterion",         types: ["movie"] },
  { re: /steelbook/i,                           label: "Steelbook",         types: ["movie"] },
  { re: /first edition|1st ed/i,                label: "First Edition",     types: ["book"] },
  { re: /hardcover|hardback|\bhc\b/i,           label: "Hardcover",         types: ["book"] },
  { re: /paperback|\bpb\b/i,                    label: "Paperback",         types: ["book"] },
  { re: /signed/i,                              label: "Signed",            types: ["book", "vinyl"] },
  { re: /180\s?g(ram)?/i,                       label: "180g pressing",     types: ["vinyl"] },
  { re: /\blp\b|original press/i,               label: "Original LP",       types: ["vinyl"] },
  { re: /\bms-?\s?(\d{2})\b/i,                  label: (m) => `MS-${m[1]}`,  types: ["coin"] },
  { re: /\bpf-?\s?(\d{2})\b|proof/i,            label: "Proof",             types: ["coin"] },
];

/* mint marks for coins */
const MINTS = { O: "New Orleans", S: "San Francisco", D: "Denver", CC: "Carson City", P: "Philadelphia" };

function cleanTitle(line) {
  // strip recognised noise tokens so a readable title is left
  let t = line
    .replace(/\bcib\b|complete in box|sealed|loose|cart only|cartridge|hardcover|hardback|paperback|first edition|1st ed|blu-?\s?ray|\b4k\b|uhd|dvd|criterion|steelbook|180\s?g(ram)?|\blp\b|\bms-?\s?\d{2}\b|\bpf-?\s?\d{2}\b|proof|graded|signed/gi, "")
    .replace(/\b(1[6-9]\d{2}|20\d{2})\b/g, "")     // years
    .replace(/-(O|S|D|CC|P)\b/gi, "")               // mint marks
    .replace(/\s{2,}/g, " ")
    .replace(/[,;]+\s*$/, "")
    .trim();
  if (!t) return line.trim();
  // light title-case for short tokens, leave acronyms alone
  return t.replace(/\b([a-z])([a-z']+)/g, (_, a, b) => a.toUpperCase() + b);
}

function detectType(lower) {
  let best = null, bestScore = 0;
  for (const [type, kws] of Object.entries(TYPE_KW)) {
    let score = 0;
    for (const k of kws) if (lower.includes(k)) score += (k.length > 4 ? 2 : 1);
    if (score > bestScore) { bestScore = score; best = type; }
  }
  return { type: best || "game", strong: bestScore >= 2 };
}

/* parse ONE shorthand line into a confidence-scored record */
function parseOne(line) {
  const lower = line.toLowerCase();
  const known = KNOWN_TITLES.find(k => k.kw.some(kw => lower.includes(kw)));
  const det = detectType(lower);
  const type = known ? known.type : det.type;

  // year
  const yrMatch = line.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  const year = yrMatch ? +yrMatch[0] : (known && known.year) || null;

  // format
  let edition = null;
  for (const f of FORMATS) {
    const m = lower.match(f.re) || line.match(f.re);
    if (m && (!f.types || f.types.includes(type))) { edition = typeof f.label === "function" ? f.label(m) : f.label; break; }
  }

  // coin mint
  let mint = null;
  const mm = line.match(/-(O|S|D|CC|P)\b/i);
  if (type === "coin" && mm) mint = `${MINTS[mm[1].toUpperCase()]} (${mm[1].toUpperCase()})`;

  const title = known ? known.title : cleanTitle(line);
  const color = known ? known.color : TYPE_COLOR[type];

  // build confidence-scored fields
  const fields = [];
  fields.push({ k: "Title", v: title, c: "high" });
  fields.push({ k: "Type", v: TYPE_LABEL[type], c: known || det.strong ? "high" : "ask" });
  if (type === "game") fields.push({ k: "Platform", v: (known && known.platform) || "Confirm platform", c: known && known.platform ? "high" : "ask" });
  if (type === "book") fields.push({ k: "Author", v: (known && known.author) || "Confirm author", c: known && known.author ? "high" : "ask" });
  if (type === "vinyl") fields.push({ k: "Artist", v: (known && known.artist) || "Confirm artist", c: known && known.artist ? "high" : "ask" });
  if (type === "coin") fields.push({ k: "Mint", v: mint || "Confirm mint", c: mint ? "high" : "ask" });
  fields.push({ k: "Year", v: year || "Confirm year", c: year ? "high" : "ask" });
  fields.push({ k: "Edition", v: edition || "Standard", c: edition ? "high" : "ask" });
  fields.push({ k: type === "coin" ? "Grade" : "Condition", v: "Add a grade", c: "ask" });

  return {
    id: "new-" + Math.random().toString(36).slice(2, 8),
    raw: line, title, type, color,
    collection: TYPE_COLL[type],
    fields,
    askCount: fields.filter(f => f.c === "ask").length,
  };
}

function parseHoardLines(text) {
  return text.split(/\n|·|•/).map(s => s.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean).slice(0, 8).map(parseOne);
}

/* ============================ SEARCH ============================ */
/* The search engine is pure: it operates on an index supplied by the caller
 * (HoddAPI.getSearchIndex), so it has no knowledge of where data comes from. */

function searchHoard(query, idx) {
  const q = (query || "").toLowerCase();
  idx = idx || [];
  const tokens = [];
  let res = idx.slice();

  // type
  const tdet = detectType(q);
  let typeHit = null;
  for (const [type, kws] of Object.entries(TYPE_KW)) {
    if (kws.some(k => q.includes(k))) { typeHit = type; break; }
  }
  if (typeHit) { tokens.push(["Type", TYPE_LABEL[typeHit]]); res = res.filter(i => i.type === typeHit); }

  // platform / author hints
  if (q.includes("nintendo") || q.includes("game boy") || q.includes("gameboy")) tokens.push(["Platform", "Nintendo"]);
  if (q.includes("tolkien")) { tokens.push(["Author", "J.R.R. Tolkien"]); res = res.filter(i => (i.author || "").includes("Tolkien")); }

  // decade / year
  const decade = q.match(/\b((19|20)\d0)s\b/) || q.match(/\b(\d0)s\b/);
  if (decade) {
    let start = decade[1].length === 4 ? +decade[1] : (+("19" + decade[1]));
    tokens.push(["Decade", `${start}s`]);
    res = res.filter(i => i.year >= start && i.year < start + 10);
  } else {
    const yr = q.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
    if (yr) { tokens.push(["Year", yr[0]]); res = res.filter(i => i.year == +yr[0]); }
  }

  // status intent
  let intent = null;
  if (/missing|don'?t have|haven'?t got|need|to collect|still need/.test(q)) { intent = "missing"; tokens.push(["Status", "Missing"]); res = res.filter(i => i.owned === false); }
  else if (/\bown\b|owned|i have|in my/.test(q)) { intent = "owned"; tokens.push(["Status", "Owned"]); res = res.filter(i => i.owned !== false); }
  if (/haven'?t watched|unwatched|not watched|still to watch/.test(q)) { intent = "unwatched"; tokens.push(["Watched", "No"]); res = res.filter(i => i.type === "movie" && i.owned !== false && i.watched === false); }
  if (/haven'?t (completed|finished)|incomplete|unfinished|not (completed|finished)/.test(q)) { intent = "incomplete"; tokens.push(["Progress", "Not completed"]); res = res.filter(i => i.type === "game" && i.owned !== false && !i.completed); }

  // free text title fallback (only if query has words not yet consumed and nothing matched well)
  if (!typeHit && !decade && !intent && q.trim()) {
    const words = q.split(/\s+/).filter(w => w.length > 2);
    const m = res.filter(i => words.some(w => (i.title || "").toLowerCase().includes(w)));
    if (m.length) { res = m; tokens.push(["Match", "Title"]); }
  }

  // write a plain-language answer
  const summary = writeAnswer(query, res, { typeHit, intent });
  return { tokens, results: res.slice(0, 12), total: res.length, summary };
}

function writeAnswer(query, res, ctx) {
  const n = res.length;
  const list = (arr) => arr.map(i => i.title).slice(0, 4).join(", ") + (arr.length > 4 ? `, +${arr.length - 4} more` : "");
  if (n === 0) return "Nothing in your hoard matches that yet — try a broader query, or add it from the + button.";
  if (ctx.intent === "missing") {
    const coll = res[0].coll || "the set";
    return `You're missing ${n} item${n > 1 ? "s" : ""}${ctx.typeHit ? "" : ""} — ${list(res)}. They're the gaps in ${coll}.`;
  }
  if (ctx.intent === "unwatched") return `${n} owned movie${n > 1 ? "s are" : " is"} still unwatched: ${list(res)}. The disc waits.`;
  if (ctx.intent === "incomplete") return `${n} game${n > 1 ? "s" : ""} you own but haven't finished: ${list(res)}.`;
  if (ctx.intent === "owned") return `You own ${n} matching item${n > 1 ? "s" : ""}: ${list(res)}.`;
  return `Found ${n} item${n > 1 ? "s" : ""} across your hoard: ${list(res)}.`;
}

Object.assign(window, { parseHoardLines, parseOne, searchHoard, TYPE_LABEL, TYPE_COLL });
/* ===== HODD views ===== */

/* Provenance text shown when an item has no authored story (the authored
 * copy lives in data/stories.json, loaded via useStory). This fallback is
 * pure presentation logic — it derives a sentence from the item itself. */
function fallbackStory(item) {
  return [
    `A treasured part of the ${item.to || item.sub || "collection"}. Every item in the hoard carries its own provenance — when it arrived, where it came from, and why it earned a place on the shelf.`,
    "Add your own notes, acquisition details, and memories to give this entry its full story.",
  ];
}

/* ---------- HOME ---------- */
/* One headline-stat card. The four cards differ (icon vs ring, unit suffix),
 * so the shape is described by data and rendered by this one component. */
function HeadlineStat({ s }) {
  const lines = String(s.label).split("\n");
  const label = lines.map((l, i) => (i ? [<br key={i} />, l] : l));
  return (
    <div className="stat">
      {s.ring != null
        ? <CompletionRing pct={s.ring} size={50} stroke={5} color="var(--gold)" showPct={false} />
        : <div className="glyph" style={s.iconColor ? { color: s.iconColor } : null}>
            {React.createElement(I[s.icon] || I.plus, { size: 22, stroke: s.icon === "plus" ? 1.8 : 1.6 })}
          </div>}
      <div>
        <div className="big" style={s.unit === "months" ? { fontSize: 27 } : null}>
          {s.value}
          {s.unit === "%" && <span style={{ fontSize: 18, color: "var(--dim)", marginLeft: 1 }}>%</span>}
          {s.unit === "months" && <span style={{ fontSize: 16, color: "var(--dim)" }}> months</span>}
        </div>
        <div className="lbl">{label}</div>
      </div>
    </div>
  );
}

function Home({ ctx }) {
  const home = useHome();
  const cols = useCollections();
  const phone = useNarrow();

  if (home.loading || cols.loading) return <Loading />;
  if (home.error || cols.error) {
    return <ErrorState error={home.error || cols.error} onRetry={() => { home.refetch(); cols.refetch(); }} />;
  }

  const D = home.data;
  const F = D.featured;
  const collections = cols.data;
  const wish = D.wishlist;
  const redis = D.rediscover;
  const ownedShelf = F.items.filter(i => i.owned).slice(0, 3);
  const missShelf = F.items.filter(i => !i.owned).slice(0, 3);
  const openRediscover = () => ctx.openItem(redis);

  return (
    <div className="view-enter">
      {/* Stats */}
      <div className="stats">
        {D.headlineStats.map(s => <HeadlineStat key={s.id} s={s} />)}
      </div>

      {/* Featured shelf — full width */}
      <div className="section-head"><div className="eyebrow">Featured shelf</div><a className="link" onClick={() => ctx.openCollection("featured")}>View all <I.arrowRight size={14} /></a></div>
      <div className="featured">
        <div className="featured-inner">
          <div className="featured-copy">
            <div className="eyebrow" style={{ color: "var(--gold-deep)" }}>{F.sub || "Featured"}</div>
            <h2>{F.name}</h2>
            <div className="meta">{F.owned} owned · {F.missing} missing</div>
            <div className="blurb">{F.blurb}</div>
          </div>
          <div className="shelf-track">
            {ownedShelf.map(it => <Cover key={it.id} item={{ ...it, type: F.type }} h={196} onClick={() => ctx.openItem(it, F)} />)}
            {missShelf.map(it => <Cover key={it.id} item={{ ...it, type: F.type }} h={196} ghost onClick={() => ctx.openItem(it, F)} />)}
          </div>
        </div>
        <div className="shelf-plank" />
        <div className="shelf-progress">
          <div className="bar"><i style={{ width: F.pct + "%" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--gold-soft)", fontWeight: 600 }}>{F.pct}% complete</span>
            <span style={{ fontSize: 12.5, color: "var(--mute)" }}>{F.missing} to collect</span>
          </div>
        </div>
      </div>

      {/* Rediscover + Recently added — full width */}
      <div className="home-mid">
        <div className="panel" style={{ overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 0" }}><div className="eyebrow">Rediscover</div></div>
          <div className="rediscover">
            <Cover item={{ title: redis.title, sub: redis.sub, type: redis.type, color: redis.color }} h={188} onClick={openRediscover} />
            <div className="copy">
              <div className="ago">You acquired this {redis.acquired}</div>
              <h3>{redis.title}</h3>
              <div className="auth">{redis.sub}</div>
              <div className="fmt">{redis.format}{redis.edition ? ` · ${redis.edition}` : ""}</div>
              <div className="note">{redis.note}</div>
              <button className="btn" style={{ marginTop: 18 }} onClick={openRediscover}>View item <I.arrowRight size={15} /></button>
            </div>
          </div>
        </div>

        <div>
          <div className="section-head"><div className="eyebrow">Recently added</div><a className="link" onClick={() => ctx.go("timeline")}>View all</a></div>
          <div className="recent-grid">
            {D.recent.map(it => (
              <div className="recent-card" key={it.id} onClick={() => ctx.openItem(it)}>
                <Cover item={it} h={phone ? 150 : 196} onClick={() => ctx.openItem(it)} />
                <div className="title">{it.title}</div>
                <div className="sub">{it.sub}</div>
                <div className="date">{it.acquired}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Collections — full width */}
      <div className="home-collections">
        <div className="section-head"><div className="eyebrow">Collections</div><a className="link" onClick={() => ctx.go("collections")}>View all collections</a></div>
        <div className="coll-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(184px, 1fr))" }}>
          {collections.map(c => <CollCard key={c.id} c={c} onClick={() => ctx.openCollection(c.id)} />)}
        </div>
      </div>

      {/* Timeline + Wishlist — full width split */}
      <div className="home-bottom">
        <div className="panel aside-panel">
          <div className="section-head" style={{ margin: "0 0 6px" }}><div className="eyebrow">Timeline</div><a className="link" onClick={() => ctx.go("timeline")}>View full timeline</a></div>
          <div className="tl-list">
            {D.timeline.slice(0, 4).map((t, i) => (
              <div className="tl-item" key={i}>
                <div className="tl-dot"><i style={{ background: t.color }} /></div>
                <div className="tl-body">
                  <div className="tl-when">{t.when}</div>
                  <div className="tl-text">{t.label} <b>{t.item}</b> to {t.to}</div>
                </div>
                <div className="tl-thumb" style={{ background: `linear-gradient(150deg, ${shade(t.color,20)}, ${shade(t.color,-40)})` }} />
              </div>
            ))}
          </div>
        </div>

        <div className="panel aside-panel wish">
          <div className="eyebrow" style={{ marginBottom: 4 }}>Wishlist highlight</div>
          <div className="lead" style={{ marginTop: 12 }}>You're close!</div>
          <div className="desc">{wish.total - wish.collected} more items to complete <b style={{ color: "var(--text-2)" }}>{wish.name}</b>.</div>
          <div className="row">
            {wish.items.map(it => <Cover key={it.id} item={{ ...it, type: "book" }} h={92} ghost={!it.owned} onClick={() => ctx.openItem({ ...it, type: "book" }, { name: wish.name, items: wish.items, type: "book" })} />)}
          </div>
          <div className="bar" style={{ marginTop: 6 }}><i style={{ width: (wish.collected / wish.total * 100) + "%" }} /></div>
          <div className="progress-row"><span className="frac">{wish.collected} / {wish.total} collected</span><a className="link" onClick={() => ctx.go("wishlist")}>Open</a></div>
        </div>
      </div>
    </div>
  );
}

function CollCard({ c, onClick }) {
  return (
    <div className="coll-card" onClick={onClick}>
      <div className="top">
        <div className="ic" style={{ color: c.accent }}>{typeIcon(c.type, { size: 22, stroke: 1.6 })}</div>
        <div className="nm">{c.name}</div>
      </div>
      <div className="bottom">
        <div className="counts"><div className="o">{c.owned} owned</div><div className="m">{c.missing} missing</div></div>
        <CompletionRing pct={c.pct} size={50} stroke={5} color={c.accent} fontSize={12} />
      </div>
    </div>
  );
}

/* ---------- COLLECTIONS GRID ---------- */
function Collections({ ctx }) {
  const { data, loading, error, refetch } = useCollections();
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data.length) return <EmptyState title="No collections yet" sub="Start a collection from the + button and it'll appear here." />;
  return (
    <div className="view-enter">
      <div className="coll-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {data.map(c => <CollCard key={c.id} c={c} onClick={() => ctx.openCollection(c.id)} />)}
      </div>
    </div>
  );
}

/* ---------- COLLECTION DETAIL ---------- */
function CollectionDetail({ collId, ctx }) {
  const { data, loading, error, refetch } = useCollection(collId);
  const [filter, setFilter] = React.useState("all");

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="Collection not found" />;

  const { name, sub, accent, owned, missing, pct, type, items } = data;
  const shown = items.filter(i => filter === "all" ? true : filter === "owned" ? i.owned : !i.owned);
  return (
    <div className="view-enter">
      <div className="back" onClick={() => ctx.go("home")}><I.arrowLeft size={16} /> Back</div>
      <div className="detail-head">
        <CompletionRing pct={pct} size={92} stroke={7} color={accent} fontSize={20} />
        <div className="titles">
          <div className="eyebrow" style={{ color: accent }}>{sub}</div>
          <h1>{name}</h1>
          <div className="sub">{owned} owned · {missing} missing · {pct}% complete</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn solid add-item-btn" onClick={() => ctx.addToCollection(data)}><I.plus size={16} stroke={2} /> Add item</button>
        <div className="seg">
          {["all", "owned", "missing"].map(f => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
      </div>
      {items.length === 0
        ? <EmptyState title={`${name} is empty`} sub="Add your first item to start the collection." />
        : shown.length === 0
        ? <EmptyState title={`No ${filter} items`} sub="Try a different filter." />
        : <div className="items-grid">
            {shown.map(it => (
              <div className={"item-cell" + (it.owned ? "" : " missing")} key={it.id}>
                <Cover item={{ ...it, type }} h={210} ghost={!it.owned} onClick={() => ctx.openItem({ ...it, type }, { name, items, type })} />
                <div className="nm">{it.title}</div>
                <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
                {it.owned
                  ? <div className="badge badge-owned"><I.check size={12} stroke={2.2} /> Owned{it.format && it.format !== "—" ? ` · ${it.format}` : ""}</div>
                  : <div className="badge badge-missing"><I.plus size={12} stroke={2} /> Missing</div>}
              </div>
            ))}
          </div>}
    </div>
  );
}

/* ---------- ITEM DETAIL ---------- */
function ItemDetail({ item: initialItem, collection, ctx }) {
  const narrow = useNarrow();
  const [item, setItem] = React.useState(initialItem);
  const [editing, setEditing] = React.useState(false);
  const [storyOv, setStoryOv] = React.useState(null);
  React.useEffect(() => { setItem(initialItem); setEditing(false); setStoryOv(null); }, [initialItem]);
  // Related strip: use the passed-in collection, else fall back to the
  // featured collection. Only fetch the fallback when we actually need it.
  const fallback = useCollection(collection ? null : "featured");
  const storyState = useStory(item.id);
  const type = item.type || "game";
  const story = storyOv || storyState.data || fallbackStory(item);
  const pool = (collection && collection.items) ? collection.items : (fallback.data ? fallback.data.items : []);
  const related = pool.filter(i => i.id !== item.id).slice(0, 5);
  const relType = collection ? collection.type : type;
  const owned = item.owned !== false;
  const medium = (item.format && item.format !== "—" && item.format !== "Owned") ? item.format : null;
  const subLabel = type === "book" ? "Author" : type === "game" ? "Platform"
    : type === "coin" ? "Mint" : type === "vinyl" ? "Artist" : type === "movie" ? "Director"
    : type === "comic" ? "Publisher" : "Detail";
  // Type-tailored facts. Each row is [label, value]; rows whose value is
  // null/empty are dropped, so a sparse item shows only what it actually has.
  const facts = [
    ["Status", owned ? "Owned" : "Missing"],
    owned && ["Format", medium],
    ["Year", item.year],
    [subLabel, item.sub],
    ["Series", item.series],
    type === "game" && ["Region", item.region],
    owned && type === "game" && ["Completeness", item.completeness],
    owned && type === "coin" && ["Grade", item.grade],
    owned && type === "book" && ["Edition", item.edition],
    owned && type === "vinyl" && ["Pressing", item.pressing],
    owned && type === "movie" && typeof item.watched === "boolean" && ["Watched", item.watched ? "Yes" : "Not yet"],
    owned && ["Condition", item.condition],
    ...(owned && Array.isArray(item.custom) ? item.custom.map(x => [x.label, x.value]) : []),
    owned && ["Acquired", item.acquired],
  ].filter(f => f && f[1] != null && f[1] !== "");
  return (
    <div className="view-enter">
      <div className="back" onClick={ctx.back}><I.arrowLeft size={16} /> Back</div>
      <div className="item-detail">
        <div className="big-cover">
          <FluidCover item={item} ghost={item.owned === false} maxWidth={narrow ? 300 : 360} />
        </div>
        <div>
          <div className="eyebrow" style={{ color: "var(--gold-deep)" }}>{collection ? collection.name : (item.sub || type)}</div>
          <h1>{item.title}</h1>
          <div className="byline">{item.sub || subLabel}</div>
          {!editing && (
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              {item.owned === false
                ? <span className="badge badge-missing" style={{ fontSize: 12, padding: "8px 14px", border: "1px solid var(--border-soft)", borderRadius: 20 }}><I.plus size={13} stroke={2} /> Not in collection</span>
                : <span className="badge badge-owned" style={{ fontSize: 12, padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 20, background: "var(--accent-wash)" }}><I.check size={13} stroke={2.2} /> In your collection</span>}
              <button className="btn" onClick={() => setEditing(true)}><I.edit size={16} /> Edit details</button>
              {item.owned === false
                ? <button className="btn solid" onClick={() => setEditing(true)}><I.plus size={16} /> Add to collection</button>
                : <button className="btn"><I.heart size={16} /> Mark favorite</button>}
            </div>
          )}

          {editing
            ? <ItemEditForm item={item} type={type} subLabel={subLabel} story={story}
                onCancel={() => setEditing(false)}
                onSave={({ owned: isOwned, holding, canonical, story: paras }) => {
                  if (canonical) window.HoddAPI.saveCatalog(item.id, canonical);
                  if (paras) { window.HoddAPI.saveStory(item.id, paras); setStoryOv(paras); }
                  if (isOwned === false) {
                    window.HoddAPI.removeHolding(item.id);
                    setItem({ ...item, ...(canonical || {}), owned: false, format: null, completeness: null, grade: null, pressing: null, edition: null, condition: null, acquired: null, watched: undefined });
                  } else {
                    window.HoddAPI.saveHolding(item.id, holding);
                    setItem({ ...item, ...(canonical || {}), owned: true, ...holding });
                  }
                  setEditing(false);
                }} />
            : <div className="facts">
                {facts.map(([k, v], i) => (
                  <div className={"fact" + (facts.length % 2 === 1 && i === facts.length - 1 ? " full" : "")} key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
                ))}
              </div>}

          <div className="eyebrow" style={{ marginTop: 30 }}>The story</div>
          <div className="story">{story.map((p, i) => <p key={i}>{p}</p>)}</div>

          {related.length > 0 && (
            <div style={{ marginTop: 30 }}>
              <div className="eyebrow">{collection ? `More in ${collection.name}` : "Related"}</div>
              <div className="related-strip" style={{ marginTop: 14 }}>
                {related.map(r => <Cover key={r.id} item={{ ...r, type: relType }} h={130} ghost={r.owned === false} onClick={() => ctx.openItem({ ...r, type: relType }, collection)} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- SEARCH (natural language, local) ---------- */
const SEARCH_SAMPLES = [
  "Which Tolkien books am I missing?",
  "Game Boy games I haven't completed",
  "Movies I own but haven't watched",
  "Coins from the 1920s",
  "Vinyl I'm still missing",
];

function SearchView({ initial, ctx }) {
  const index = useSearchIndex();
  const [value, setValue] = React.useState(initial || "");
  const [out, setOut] = React.useState(null);     // { tokens, results, total, summary, q }
  const [phase, setPhase] = React.useState("idle"); // idle | thinking | done

  function run(q) {
    const query = (q == null ? value : q);
    if (!query.trim() || !index.data) return;
    setValue(query);
    setPhase("thinking");
    setOut({ ...window.searchHoard(query, index.data), q: query });
    setTimeout(() => setPhase("done"), 850);
  }
  // Run the initial query once the index has loaded.
  React.useEffect(() => { if (initial && index.data) run(initial); /* eslint-disable-next-line */ }, [index.data]);

  if (index.loading) return <Loading label="Indexing your hoard…" />;
  if (index.error) return <ErrorState error={index.error} onRetry={index.refetch} label="Couldn't build the search index" />;

  return (
    <div className="view-enter">
      <div className="ai-input-wrap" style={{ maxWidth: 760 }}>
        <input className="ai-input" autoFocus placeholder="Ask anything… e.g. “Game Boy games I haven't completed”"
          value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") run(); }} />
        <button className="ai-go" onClick={() => run()}><I.sparkle size={18} /></button>
      </div>
      <div className="ai-hint" style={{ marginTop: 13 }}><I.lock size={13} /> Parsed on-device — your hoard never leaves this machine.</div>
      <div className="add-examples" style={{ marginTop: 12 }}>
        <span className="add-examples-lbl">Try</span>
        {SEARCH_SAMPLES.map(s => <div key={s} className="chip" onClick={() => run(s)}>{s}</div>)}
      </div>

      {out && (
        <div className="search-translate">
          <div className="translate-eyebrow">
            <I.sparkle size={15} /> {phase === "thinking" ? "Translating…" : "Understood as"}
          </div>
          <div className="translate-row">
            {out.tokens.length
              ? out.tokens.map(([k, v], i) => (
                  <div className="token" key={i} style={{ opacity: phase === "thinking" ? 0.35 : 1, transition: `opacity .4s ${i * 0.1}s` }}>{k}: <b>{v}</b></div>
                ))
              : <div className="token" style={{ opacity: phase === "thinking" ? 0.35 : 1 }}>Free text search</div>}
          </div>
        </div>
      )}

      {out && phase === "done" && (
        <>
          <div className="answer-card">
            <div className="answer-mark"><I.sparkle size={16} /></div>
            <div className="answer-text">{out.summary}</div>
          </div>
          {out.results.length > 0 && (
            <div>
              <div className="section-head" style={{ marginTop: 24 }}>
                <div className="eyebrow">{out.total} result{out.total !== 1 ? "s" : ""}{out.total > out.results.length ? ` · showing ${out.results.length}` : ""}</div>
              </div>
              <div className="items-grid">
                {out.results.map(it => (
                  <div className={"item-cell" + (it.owned === false ? " missing" : "")} key={it.id}>
                    <Cover item={it} h={200} ghost={it.owned === false} onClick={() => ctx.openItem(it)} />
                    <div className="nm">{it.title}</div>
                    <div className="yr">{it.platform || it.author || it.sub || it.coll}{it.year ? ` · ${it.year}` : ""}</div>
                    {it.owned === false
                      ? <div className="badge badge-missing"><I.plus size={12} stroke={2} /> Missing</div>
                      : <div className="badge badge-owned"><I.check size={12} stroke={2.2} /> Owned</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- placeholder for unbuilt sections ---------- */
function ComingSoon({ name }) {
  return (
    <div className="coming view-enter">
      <div>
        <HoddMark size={48} color="var(--gold-deep)" style={{ opacity: .5 }} />
        <div className="em" style={{ marginTop: 18 }}>{name}</div>
        <div>This corner of your hoard is still being curated.</div>
      </div>
    </div>
  );
}

Object.assign(window, { Home, Collections, CollectionDetail, ItemDetail, SearchView, ComingSoon });
/* ===== HODD — item edit form =====
 * Type-aware editor for a collection item. The fields shown match the item's
 * type (a game gets Completeness, a coin gets Grade, vinyl gets Pressing…),
 * mirroring the type-specific columns of the holdings table. Saving writes a
 * patch via HoddAPI.saveHolding (localStorage-backed), so edits persist and
 * flow through the same join the rest of the app reads. */

const FORMAT_OPTIONS = {
  game:  ["Cartridge", "Disc", "Digital", "Boxed set"],
  book:  ["Hardcover", "Paperback", "Mass market", "Ebook", "Audiobook"],
  movie: ["4K Blu-ray", "Blu-ray", "DVD", "Digital", "VHS"],
  coin:  ["Silver dollar", "Gold", "Silver", "Copper", "Proof set"],
  vinyl: ["Vinyl LP", "7\" single", "Boxed set", "Picture disc"],
  comic: ["Single issue", "Trade paperback", "Hardcover", "Omnibus"],
};
const CONDITION_OPTIONS = ["Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"];
const COMPLETENESS_OPTIONS = ["Complete in box", "Loose", "Sealed", "Manual only"];
const TYPE_OPTIONS = [["game", "Game"], ["book", "Book"], ["movie", "Movie"], ["coin", "Coin"], ["vinyl", "Vinyl"], ["comic", "Comic"], ["other", "Other / custom"]];
const SUBLABELS = { book: "Author", game: "Platform", coin: "Mint", vinyl: "Artist", movie: "Director", comic: "Publisher", other: "Detail" };

/* Ensure the current value is selectable even if it's not in the preset list. */
function withCurrent(options, current) {
  if (current && options.indexOf(current) === -1) return [current].concat(options);
  return options;
}

function EFSelect({ label, value, options, pairs, placeholder, onChange }) {
  const opts = pairs || withCurrent(options, value).map(o => [o, o]);
  return (
    <label className="ef-field">
      <span className="ef-k">{label}</span>
      <div className="ef-select-wrap">
        <select className="ef-control" value={value || ""} onChange={e => onChange(e.target.value)}>
          {placeholder !== false && <option value="">{placeholder || "—"}</option>}
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="ef-chev">{I.chevDown ? I.chevDown({ size: 15 }) : "▾"}</span>
      </div>
    </label>
  );
}

function EFText({ label, value, placeholder, onChange, wide }) {
  return (
    <label className={"ef-field" + (wide ? " ef-wide" : "")}>
      <span className="ef-k">{label}</span>
      <input className="ef-control" type="text" value={value || ""} placeholder={placeholder || ""}
        onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function EFTextarea({ label, value, placeholder, onChange }) {
  return (
    <label className="ef-field ef-wide">
      <span className="ef-k">{label}</span>
      <textarea className="ef-control ef-textarea" rows={5} value={value || ""} placeholder={placeholder || ""}
        onChange={e => onChange(e.target.value)} />
      <span className="ef-hint">Separate paragraphs with a blank line.</span>
    </label>
  );
}

function EFToggle({ label, value, onChange, hint }) {
  return (
    <div className="ef-field">
      <span className="ef-k">{label}</span>
      <button type="button" className={"ef-toggle" + (value ? " on" : "")} onClick={() => onChange(!value)}>
        <span className="ef-knob" />
        <span className="ef-toggle-lbl">{value ? (hint ? hint[0] : "Yes") : (hint ? hint[1] : "No")}</span>
      </button>
    </div>
  );
}

function ItemEditForm({ item, type, subLabel, story, onCancel, onSave }) {
  const init = {
    format: item.format && item.format !== "—" && item.format !== "Owned" ? item.format : "",
    completeness: item.completeness || "",
    grade: item.grade || "",
    pressing: item.pressing || "",
    edition: item.edition || "",
    condition: item.condition || "",
    acquired: item.acquired || "",
    watched: !!item.watched,
  };
  const [owned, setOwned] = React.useState(item.owned !== false);
  const [f, setF] = React.useState(init);
  const [c, setC] = React.useState({
    title: item.title || "",
    sub: item.sub || "",
    year: item.year != null ? String(item.year) : "",
    type: item.type || type || "other",
  });
  const [custom, setCustom] = React.useState(
    Array.isArray(item.custom) && item.custom.length
      ? item.custom.map(x => ({ label: x.label || "", value: x.value || "" }))
      : []
  );
  const [storyText, setStoryText] = React.useState((story || []).join("\n\n"));
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const setCan = (k, v) => setC(prev => ({ ...prev, [k]: v }));
  const setRow = (i, k, v) => setCustom(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setCustom(p => [...p, { label: "", value: "" }]);
  const delRow = (i) => setCustom(p => p.filter((_, idx) => idx !== i));

  // The selected type drives which fields show — switch to "coin" and a Grade
  // field appears; "Other" leaves it to your own custom fields.
  const etype = c.type || "other";
  const eSub = SUBLABELS[etype] || "Detail";

  function handleSave() {
    const yearNum = c.year.trim() ? parseInt(c.year, 10) : null;
    const canonical = {
      title: c.title.trim() || item.title,
      sub: c.sub.trim() || null,
      year: Number.isFinite(yearNum) ? yearNum : (c.year.trim() ? item.year : null),
      type: etype,
    };
    const customClean = custom
      .map(r => ({ label: r.label.trim(), value: r.value.trim() }))
      .filter(r => r.label && r.value);
    const paragraphs = storyText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (!owned) { onSave({ owned: false, canonical, story: paragraphs }); return; }
    const holding = {
      format: f.format || null,
      condition: f.condition || null,
      acquired: f.acquired || null,
      custom: customClean.length ? customClean : null,
    };
    if (etype === "game")  holding.completeness = f.completeness || null;
    if (etype === "coin")  holding.grade = f.grade || null;
    if (etype === "vinyl") holding.pressing = f.pressing || null;
    if (etype === "book")  holding.edition = f.edition || null;
    if (etype === "movie") holding.watched = f.watched;
    onSave({ owned: true, holding, canonical, story: paragraphs });
  }

  return (
    <div className="edit-form">
      <div className="ef-head">
        <div className="ef-title">Edit item</div>
        <EFToggle label="In collection" value={owned} onChange={setOwned} hint={["Owned", "Missing"]} />
      </div>

      <div className="ef-section">Item details</div>
      <div className="ef-grid">
        <EFText label="Title" value={c.title} placeholder="Item title" onChange={v => setCan("title", v)} wide />
        <EFSelect label="Type" value={etype} pairs={TYPE_OPTIONS} placeholder={false} onChange={v => setCan("type", v)} />
        <EFText label={eSub} value={c.sub} placeholder={eSub} onChange={v => setCan("sub", v)} />
        <EFText label="Year" value={c.year} placeholder="e.g. 1996" onChange={v => setCan("year", v)} />
      </div>

      {owned ? (
        <>
          <div className="ef-section">Your copy</div>
          <div className="ef-grid">
            <EFSelect label="Format" value={f.format} options={FORMAT_OPTIONS[etype] || []} placeholder="Medium" onChange={v => set("format", v)} />
            {etype === "game"  && <EFSelect label="Completeness" value={f.completeness} options={COMPLETENESS_OPTIONS} placeholder="How complete" onChange={v => set("completeness", v)} />}
            {etype === "coin"  && <EFText label="Grade" value={f.grade} placeholder="e.g. MS-63" onChange={v => set("grade", v)} />}
            {etype === "vinyl" && <EFText label="Pressing" value={f.pressing} placeholder="e.g. 180g" onChange={v => set("pressing", v)} />}
            {etype === "book"  && <EFText label="Edition" value={f.edition} placeholder="e.g. First Edition" onChange={v => set("edition", v)} />}
            <EFSelect label="Condition" value={f.condition} options={CONDITION_OPTIONS} placeholder="Condition" onChange={v => set("condition", v)} />
            <EFText label="Acquired" value={f.acquired} placeholder="e.g. May 2024" onChange={v => set("acquired", v)} />
            {etype === "movie" && <EFToggle label="Watched" value={f.watched} onChange={v => set("watched", v)} hint={["Yes", "Not yet"]} />}
          </div>

          <div className="ef-section ef-section-row">
            <span>More details</span>
            <button type="button" className="ef-add" onClick={addRow}><I.plus size={14} stroke={2} /> Add field</button>
          </div>
          {custom.length === 0
            ? <div className="ef-empty">Collecting something unusual? Add your own fields — Movement, Reference, Colorway, Size, anything.</div>
            : <div className="ef-custom">
                {custom.map((r, i) => (
                  <div className="ef-custom-row" key={i}>
                    <input className="ef-control" placeholder="Field name" value={r.label} onChange={e => setRow(i, "label", e.target.value)} />
                    <input className="ef-control" placeholder="Value" value={r.value} onChange={e => setRow(i, "value", e.target.value)} />
                    <button type="button" className="ef-del" onClick={() => delRow(i)} title="Remove field"><I.trash size={16} /></button>
                  </div>
                ))}
              </div>}
        </>
      ) : (
        <div className="ef-removed">This item will be marked as missing — its personal details are cleared, but it stays in the catalog so you can re-add it anytime.</div>
      )}

      <div className="ef-section">The story</div>
      <div className="ef-grid">
        <EFTextarea label="" value={storyText} placeholder={"Write what this piece means to you — how you found it, why it matters…"} onChange={setStoryText} />
      </div>

      <div className="ef-actions">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn solid" onClick={handleSave}><I.check size={16} stroke={2.2} /> Save changes</button>
      </div>
    </div>
  );
}

Object.assign(window, { ItemEditForm, FORMAT_OPTIONS, CONDITION_OPTIONS, COMPLETENESS_OPTIONS, TYPE_OPTIONS, SUBLABELS, EFText, EFSelect, EFToggle, EFTextarea });
/* ===== HODD — creation flows =====
 * CreateCollectionModal: define a collection the app never anticipated — name,
 * type, accent, and a default FIELD TEMPLATE so every item you add starts
 * pre-shaped. AddItemModal: add one item, with the collection's template
 * seeded as ready-to-fill fields. Both reuse the EF* controls from item-edit. */

const ACCENT_SWATCHES = ["#6366f1", "#5BA47A", "#5C8AD6", "#C9A24C", "#CF6B5A", "#7FB0C4", "#9B7BD4", "#C0392B"];

function AccentPicker({ value, onChange }) {
  return (
    <div className="ef-field">
      <span className="ef-k">Accent</span>
      <div className="accent-swatches">
        {ACCENT_SWATCHES.map(c => (
          <button type="button" key={c} className={"swatch" + (value === c ? " on" : "")}
            style={{ background: c }} onClick={() => onChange(c)} aria-label={c}>
            {value === c && <I.check size={15} stroke={2.6} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Editable list of default field labels — the collection's template. */
function TemplateEditor({ rows, setRows }) {
  const setRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const add = () => setRows([...rows, ""]);
  const del = (i) => setRows(rows.filter((_, idx) => idx !== i));
  return (
    <div>
      <div className="ef-section ef-section-row" style={{ marginTop: 4 }}>
        <span>Default fields</span>
        <button type="button" className="ef-add" onClick={add}><I.plus size={14} stroke={2} /> Add field</button>
      </div>
      <div className="ef-hint" style={{ marginBottom: 12 }}>Every item you add to this collection starts with these — e.g. Movement, Reference, Colorway, Scale.</div>
      {rows.length === 0
        ? <div className="ef-empty">No default fields yet. Built-in details (format, condition, acquired) are always included.</div>
        : <div className="ef-custom">
            {rows.map((r, i) => (
              <div className="tmpl-row" key={i}>
                <input className="ef-control" placeholder="Field name" value={r} onChange={e => setRow(i, e.target.value)} />
                <button type="button" className="ef-del" onClick={() => del(i)} title="Remove"><I.trash size={16} /></button>
              </div>
            ))}
          </div>}
    </div>
  );
}

function CreateCollectionModal({ onClose, onCreated }) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("other");
  const [accent, setAccent] = React.useState(ACCENT_SWATCHES[0]);
  const [tmpl, setTmpl] = React.useState(["", ""]);

  function create() {
    if (!name.trim()) return;
    const rec = window.HoddAPI.createCollection({
      name, type, accent,
      template: tmpl.map(s => s.trim()).filter(Boolean),
    });
    onCreated(rec);
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="t">
            <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: accent, color: "#fff", flex: "0 0 auto" }}>
              {window.typeIcon(type, { size: 20, stroke: 1.8 })}
            </span>
            <div>
              <div className="lbl">New collection</div>
              <h3>{name.trim() || "Name your collection"}</h3>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: 38, height: 38 }}><I.close size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="ef-grid">
            <EFText label="Name" value={name} placeholder="e.g. Wristwatches" onChange={setName} wide />
            <EFSelect label="Type" value={type} pairs={window.TYPE_OPTIONS} placeholder={false} onChange={setType} />
            <AccentPicker value={accent} onChange={setAccent} />
          </div>
          <TemplateEditor rows={tmpl} setRows={setTmpl} />
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 12, color: "var(--mute)", display: "flex", alignItems: "center", gap: 7 }}>
            <I.lock size={13} /> Saved on this device
          </div>
          <button className="btn solid" disabled={!name.trim()} onClick={create}><I.check size={16} /> Create collection</button>
        </div>
      </div>
    </div>
  );
}

function AddItemModal({ collection, onClose, onAdded }) {
  const type = collection.type || "other";
  const subLabel = window.SUBLABELS[type] || "Detail";
  const [owned, setOwned] = React.useState(true);
  const [c, setC] = React.useState({ title: "", sub: "", year: "" });
  const [f, setF] = React.useState({ format: "", completeness: "", grade: "", pressing: "", edition: "", condition: "", acquired: "", watched: false });
  const [custom, setCustom] = React.useState((collection.template || []).map(l => ({ label: l, value: "" })));
  const setCan = (k, v) => setC(p => ({ ...p, [k]: v }));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setRow = (i, k, v) => setCustom(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setCustom(p => [...p, { label: "", value: "" }]);
  const delRow = (i) => setCustom(p => p.filter((_, idx) => idx !== i));

  function add() {
    if (!c.title.trim()) return;
    const yearNum = c.year.trim() ? parseInt(c.year, 10) : null;
    const customClean = custom.map(r => ({ label: r.label.trim(), value: r.value.trim() })).filter(r => r.label && r.value);
    const draft = {
      title: c.title.trim(), sub: c.sub.trim() || null, type,
      year: Number.isFinite(yearNum) ? yearNum : null, owned,
    };
    if (owned) {
      draft.format = f.format || null;
      draft.condition = f.condition || null;
      draft.acquired = f.acquired || null;
      if (type === "game")  draft.completeness = f.completeness || null;
      if (type === "coin")  draft.grade = f.grade || null;
      if (type === "vinyl") draft.pressing = f.pressing || null;
      if (type === "book")  draft.edition = f.edition || null;
      if (type === "movie") draft.watched = f.watched;
      if (customClean.length) draft.custom = customClean;
    }
    const rec = window.HoddAPI.addItem(collection.id, draft);
    onAdded(rec);
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="t">
            <span style={{ color: collection.accent, display: "flex", flex: "0 0 auto" }}>{window.typeIcon(type, { size: 22, stroke: 1.7 })}</span>
            <div>
              <div className="lbl">Add to {collection.name}</div>
              <h3>{c.title.trim() || "New item"}</h3>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: 38, height: 38 }}><I.close size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="ef-head" style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border-soft)" }}>
            <div className="ef-title">Item details</div>
            <EFToggle label="In collection" value={owned} onChange={setOwned} hint={["Owned", "Wishlist"]} />
          </div>
          <div className="ef-grid">
            <EFText label="Title" value={c.title} placeholder="Item title" onChange={v => setCan("title", v)} wide />
            <EFText label={subLabel} value={c.sub} placeholder={subLabel} onChange={v => setCan("sub", v)} />
            <EFText label="Year" value={c.year} placeholder="e.g. 1996" onChange={v => setCan("year", v)} />
          </div>

          {owned && (
            <>
              <div className="ef-section">Your copy</div>
              <div className="ef-grid">
                <EFSelect label="Format" value={f.format} options={window.FORMAT_OPTIONS[type] || []} placeholder="Medium" onChange={v => set("format", v)} />
                {type === "game"  && <EFSelect label="Completeness" value={f.completeness} options={window.COMPLETENESS_OPTIONS} placeholder="How complete" onChange={v => set("completeness", v)} />}
                {type === "coin"  && <EFText label="Grade" value={f.grade} placeholder="e.g. MS-63" onChange={v => set("grade", v)} />}
                {type === "vinyl" && <EFText label="Pressing" value={f.pressing} placeholder="e.g. 180g" onChange={v => set("pressing", v)} />}
                {type === "book"  && <EFText label="Edition" value={f.edition} placeholder="e.g. First Edition" onChange={v => set("edition", v)} />}
                <EFSelect label="Condition" value={f.condition} options={window.CONDITION_OPTIONS} placeholder="Condition" onChange={v => set("condition", v)} />
                <EFText label="Acquired" value={f.acquired} placeholder="e.g. May 2024" onChange={v => set("acquired", v)} />
                {type === "movie" && <EFToggle label="Watched" value={f.watched} onChange={v => set("watched", v)} hint={["Yes", "Not yet"]} />}
              </div>

              <div className="ef-section ef-section-row">
                <span>More details</span>
                <button type="button" className="ef-add" onClick={addRow}><I.plus size={14} stroke={2} /> Add field</button>
              </div>
              {custom.length === 0
                ? <div className="ef-empty">Add your own fields for anything specific to this piece.</div>
                : <div className="ef-custom">
                    {custom.map((r, i) => (
                      <div className="ef-custom-row" key={i}>
                        <input className="ef-control" placeholder="Field name" value={r.label} onChange={e => setRow(i, "label", e.target.value)} />
                        <input className="ef-control" placeholder="Value" value={r.value} onChange={e => setRow(i, "value", e.target.value)} />
                        <button type="button" className="ef-del" onClick={() => delRow(i)} title="Remove field"><I.trash size={16} /></button>
                      </div>
                    ))}
                  </div>}
            </>
          )}
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 12, color: "var(--mute)" }}>{collection.template && collection.template.length ? `${collection.template.length} template field${collection.template.length !== 1 ? "s" : ""} ready` : "Saved on this device"}</div>
          <button className="btn solid" disabled={!c.title.trim()} onClick={add}><I.check size={16} /> Add item</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CreateCollectionModal, AddItemModal, ACCENT_SWATCHES });
/* ===== HODD redesign — collection-first home + shelf-banner collections =====
 * Addresses the "too dashboard-heavy / rings everywhere / generic collections"
 * notes. The shelf-mosaic encodes completion as a filling shelf, so progress
 * rings are rationed down to one numeric % per collection card. */

/* deterministic PRNG so each collection's shelf is stable across renders */
function shelfRng(seed) {
  let s = 2166136261;
  for (const ch of String(seed)) { s ^= ch.charCodeAt(0); s = Math.imul(s, 16777619) >>> 0; }
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/* A shelf of spines. Filled spines (owned) are accent-shaded; the trailing
 * gaps are dashed outlines = what's still to collect. The fill ratio IS the
 * completion read, so no ring is needed. */
function SpineMosaic({ accent, pct = 0, count = 14, height = 150 }) {
  const r = shelfRng(accent + "·" + count);
  const filled = Math.round((count * Math.max(0, Math.min(100, pct))) / 100);
  const spines = Array.from({ length: count }, (_, i) => {
    const hf = 0.52 + r() * 0.46;            // height fraction
    const w = 7 + Math.round(r() * 8);        // spine width
    const sh = -36 + Math.round(r() * 66);    // shade amount
    return { hf, w, sh, gap: i >= filled };
  });
  return (
    <div className="shelf" style={{ height, background: `linear-gradient(180deg, ${rgba(accent, 0.12)}, ${rgba(accent, 0.02)})` }}>
      {spines.map((s, i) => (
        <div key={i} className={"spine" + (s.gap ? " gap" : "")}
          style={{
            width: s.w,
            height: Math.round((height - 22) * s.hf),
            background: s.gap ? "transparent" : shade(accent, s.sh),
          }} />
      ))}
      <div className="plank" style={{ background: shade(accent, -50) }} />
    </div>
  );
}

/* Quiet one-line pulse of stats — personality, not a metric wall. */
function StatLine({ D }) {
  const by = {};
  (D.headlineStats || []).forEach(s => { by[s.id] = s; });
  const parts = [];
  if (by.added) parts.push(<span className="sl-item" key="a"><span className="sl-ic">{I.plus({ size: 14, stroke: 2 })}</span><span><b>{by.added.value}</b> added this month</span></span>);
  if (by.movies) parts.push(<span className="sl-item" key="m"><span><b>{by.movies.value}%</b> of Movies complete</span></span>);
  if (by.unread) parts.push(<span className="sl-item" key="u"><span><b>{by.unread.value}</b> unread books</span></span>);
  return (
    <div className="statline">
      {parts.map((p, i) => [i ? <span className="dot" key={"d" + i} /> : null, p])}
    </div>
  );
}

/* A "crate" of real cover art — owned items face-out and up front, the next
 * couple of missing items as ghost gaps trailing behind = the chase. The
 * fanned fill reads as completion + gives every collection its own identity. */
function CoverShelf({ items = [], accent, height = 140, coverH = 96, maxOwned = 5, ghosts = 1 }) {
  const owned = items.filter(i => i.owned);
  const missing = items.filter(i => !i.owned);
  const seq = [
    ...owned.slice(0, maxOwned).map(it => ({ it, ghost: false })),
    ...missing.slice(0, owned.length ? ghosts : 4).map(it => ({ it, ghost: true })),
  ];
  const overlap = Math.round(coverH * 0.34);
  return (
    <div className="cshelf" style={{ height, background: `linear-gradient(180deg, ${rgba(accent, 0.16)}, ${rgba(accent, 0.03)})` }}>
      <div className="crate">
        {seq.map((s, i) => (
          <div className="crate-cover" key={s.it.id || i}
            style={{ marginLeft: i ? -overlap : 0, zIndex: seq.length - i }}>
            <Cover item={s.it} h={coverH} ghost={s.ghost} glyph={coverH > 110} />
          </div>
        ))}
      </div>
      <div className="plank" style={{ background: shade(accent, -52) }} />
    </div>
  );
}

/* Home rail tile — collection as a crate of real covers, the hero of the homepage. */
function CollTile({ c, art = "Covers", onClick }) {
  return (
    <div className="ctile" onClick={onClick}>
      {art === "Covers"
        ? <CoverShelf items={c.items} accent={c.accent} height={128} coverH={88} maxOwned={4} ghosts={1} />
        : <SpineMosaic accent={c.accent} pct={c.pct} count={12} height={128} />}
      <div className="meta">
        <div className="nm"><span style={{ color: c.accent, display: "flex" }}>{typeIcon(c.type, { size: 17, stroke: 1.7 })}</span> {c.name}</div>
        <div className="cnt">{c.owned} of {c.owned + c.missing}</div>
        <div className="pbar"><i style={{ width: c.pct + "%", background: c.accent }} /></div>
      </div>
    </div>
  );
}

/* Collections view — rich cover crate, one numeric % (no ring). */
function CollBanner({ c, art = "Covers", onClick }) {
  return (
    <div className="cbanner" onClick={onClick}>
      {art === "Covers"
        ? <CoverShelf items={c.items} accent={c.accent} height={176} coverH={130} maxOwned={7} ghosts={2} />
        : <SpineMosaic accent={c.accent} pct={c.pct} count={20} height={176} />}
      <div className="body">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ty"><span style={{ color: c.accent, display: "flex" }}>{typeIcon(c.type, { size: 14, stroke: 1.8 })}</span> {c.type}</div>
          <h3>{c.name}</h3>
          <div className="cnt">{c.owned} owned · <span className="miss">{c.missing} to find</span></div>
          <div className="pbar"><i style={{ width: c.pct + "%", background: c.accent }} /></div>
        </div>
        <div className="pctnum" style={{ color: c.accent }}>{c.pct}<span>%</span></div>
      </div>
    </div>
  );
}

/* ---------- NEW HOME: collection-first ---------- */
function HomeNew({ ctx, art = "Covers" }) {
  const home = useHome();
  const cols = useCollectionsFull();
  const phone = useNarrow();

  if (home.loading || cols.loading) return <Loading />;
  if (home.error || cols.error) return <ErrorState error={home.error || cols.error} onRetry={() => { home.refetch(); cols.refetch(); }} />;

  const D = home.data;
  const F = D.featured;
  const collections = cols.data;
  const wish = D.wishlist;
  const redis = D.rediscover;
  const ownedShelf = F.items.filter(i => i.owned).slice(0, 3);
  const missShelf = F.items.filter(i => !i.owned).slice(0, 3);
  const openRediscover = () => ctx.openItem(redis);

  const stillToFind = [
    ...F.items.filter(i => !i.owned).map(i => ({ it: { ...i, type: F.type }, coll: F })),
    ...(wish.items || []).filter(i => !i.owned).map(i => ({ it: { ...i, type: "book" }, coll: { name: wish.name, items: wish.items, type: "book" } })),
  ].slice(0, 7);

  return (
    <div className="view-enter">
      <StatLine D={D} />

      {/* HERO: jump back into your collections */}
      <div className="section-head"><div className="eyebrow">Continue exploring</div><a className="link" onClick={() => ctx.go("collections")}>All collections <I.arrowRight size={14} /></a></div>
      <div className="explore-rail">
        {collections.map(c => <CollTile key={c.id} c={c} art={art} onClick={() => ctx.openCollection(c.id)} />)}
      </div>

      {/* Featured set — keeps the one hero progress */}
      <div className="section-head" style={{ marginTop: 34 }}><div className="eyebrow">Featured shelf</div><a className="link" onClick={() => ctx.openCollection("featured")}>View all <I.arrowRight size={14} /></a></div>
      <div className="featured">
        <div className="featured-inner">
          <div className="featured-copy">
            <div className="eyebrow" style={{ color: "var(--gold-deep)" }}>{F.sub || "Featured"}</div>
            <h2>{F.name}</h2>
            <div className="meta">{F.owned} owned · {F.missing} missing</div>
            <div className="blurb">{F.blurb}</div>
          </div>
          <div className="shelf-track">
            {ownedShelf.map(it => <Cover key={it.id} item={{ ...it, type: F.type }} h={196} onClick={() => ctx.openItem(it, F)} />)}
            {missShelf.map(it => <Cover key={it.id} item={{ ...it, type: F.type }} h={196} ghost onClick={() => ctx.openItem(it, F)} />)}
          </div>
        </div>
        <div className="shelf-plank" />
        <div className="shelf-progress">
          <div className="bar"><i style={{ width: F.pct + "%" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--gold-soft)", fontWeight: 600 }}>{F.pct}% complete</span>
            <span style={{ fontSize: 12.5, color: "var(--mute)" }}>{F.missing} to collect</span>
          </div>
        </div>
      </div>

      {/* Recently added */}
      <div className="section-head" style={{ marginTop: 34 }}><div className="eyebrow">Recently added</div><a className="link" onClick={() => ctx.go("timeline")}>View all</a></div>
      <div className="recent-grid">
        {D.recent.map(it => (
          <div className="recent-card" key={it.id} onClick={() => ctx.openItem(it)}>
            <Cover item={it} h={phone ? 150 : 196} onClick={() => ctx.openItem(it)} />
            <div className="title">{it.title}</div>
            <div className="sub">{it.sub}</div>
            <div className="date">{it.acquired}</div>
          </div>
        ))}
      </div>

      {/* Still to find — the chase (real missing items) */}
      {stillToFind.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 34 }}><div className="eyebrow">Still to find</div><a className="link" onClick={() => ctx.go("wishlist")}>Wishlist</a></div>
          <div className="find-rail">
            {stillToFind.map(({ it, coll }, i) => (
              <div className="find-item" key={it.id || i} onClick={() => ctx.openItem(it, coll)}>
                <Cover item={it} h={150} ghost onClick={() => ctx.openItem(it, coll)} />
                <div className="fn">{it.title}</div>
                <div className="fc">{coll.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rediscover — the story moment */}
      <div className="section-head" style={{ marginTop: 34 }}><div className="eyebrow">Rediscover</div></div>
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="rediscover">
          <Cover item={{ title: redis.title, sub: redis.sub, type: redis.type, color: redis.color }} h={188} onClick={openRediscover} />
          <div className="copy">
            <div className="ago">You acquired this {redis.acquired}</div>
            <h3>{redis.title}</h3>
            <div className="auth">{redis.sub}</div>
            <div className="fmt">{redis.format}{redis.edition ? ` · ${redis.edition}` : ""}</div>
            <div className="note">{redis.note}</div>
            <button className="btn" style={{ marginTop: 18 }} onClick={openRediscover}>View item <I.arrowRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- NEW COLLECTIONS: shelf banners ---------- */
function CollectionsNew({ ctx, art = "Covers" }) {
  const { data, loading, error, refetch } = useCollectionsFull();
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data.length) return <EmptyState title="No collections yet" sub="Start a collection from the + button and it'll appear here." />;
  return (
    <div className="view-enter">
      <div className="coll-shelves">
        {data.map(c => <CollBanner key={c.id} c={c} art={art} onClick={() => ctx.openCollection(c.id)} />)}
        <button className="coll-new" onClick={() => ctx.newCollection()}>
          <span className="coll-new-plus"><I.plus size={26} stroke={1.8} /></span>
          <span className="coll-new-t">New collection</span>
          <span className="coll-new-s">Track anything — watches, sneakers, stamps, LEGO…</span>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { SpineMosaic, CoverShelf, StatLine, CollTile, CollBanner, HomeNew, CollectionsNew });
/* ===== HODD — Statistics: the shape of the hoard ===== */
/* Headline totals + completeness are DERIVED on the client from the
   collections endpoint; the 6-month growth series is fetched from /api/stats. */

function Statistics({ ctx }) {
  const cols = useCollections();
  const stats = useStats();

  if (cols.loading || stats.loading) return <Loading label="Crunching the numbers…" />;
  if (cols.error || stats.error) {
    return <ErrorState error={cols.error || stats.error} onRetry={() => { cols.refetch(); stats.refetch(); }} />;
  }

  const GROWTH = stats.data.growth;
  const cols_ = cols.data;
  const totalOwned = cols_.reduce((s, c) => s + c.owned, 0);
  const totalMissing = cols_.reduce((s, c) => s + c.missing, 0);
  const avgPct = Math.round(cols_.reduce((s, c) => s + c.pct, 0) / cols_.length);
  const sorted = [...cols_].sort((a, b) => b.pct - a.pct);
  const closest = sorted[0];
  const needs = sorted[sorted.length - 1];
  const maxGrowth = Math.max(...GROWTH.map(g => g.n));
  const ytd = GROWTH.reduce((s, g) => s + g.n, 0);

  return (
    <div className="view-enter">
      {/* Overview */}
      <div className="stats" style={{ marginBottom: 24 }}>
        <div className="stat"><div className="glyph"><I.grid size={22} stroke={1.7} /></div>
          <div><div className="big">{totalOwned.toLocaleString()}</div><div className="lbl">Items in<br/>your hoard</div></div></div>
        <div className="stat"><CompletionRing pct={avgPct} size={50} stroke={5} color="var(--accent)" showPct={false} />
          <div><div className="big">{avgPct}<span style={{ fontSize: 18, color: "var(--dim)", marginLeft: 1 }}>%</span></div><div className="lbl">Overall<br/>completion</div></div></div>
        <div className="stat"><div className="glyph" style={{ color: "#cf6b5a" }}><I.tag size={22} stroke={1.7} /></div>
          <div><div className="big">{totalMissing}</div><div className="lbl">Items still<br/>to collect</div></div></div>
        <div className="stat"><div className="glyph" style={{ color: "#5ba47a" }}><I.calendar size={22} stroke={1.7} /></div>
          <div><div className="big">{ytd}</div><div className="lbl">Added in<br/>the last 6 mo</div></div></div>
      </div>

      <div className="stats-layout">
        {/* Completeness */}
        <div className="panel stat-panel">
          <div className="section-head" style={{ margin: "0 0 18px" }}><div className="eyebrow">Completeness by collection</div></div>
          <div className="bar-rows">
            {sorted.map(c => (
              <div className="bar-row" key={c.id} onClick={() => ctx.openCollection(c.id)}>
                <div className="bar-row-ic" style={{ color: c.accent }}>{typeIcon(c.type, { size: 18, stroke: 1.7 })}</div>
                <div className="bar-row-name">{c.name}</div>
                <div className="bar-row-track"><i style={{ width: c.pct + "%", background: c.accent }} /></div>
                <div className="bar-row-pct">{c.pct}%</div>
                <div className="bar-row-count">{c.owned} of {c.owned + c.missing}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div className="stat-aside">
          <div className="panel highlight-card">
            <div className="eyebrow">Closest to complete</div>
            <div className="highlight-main">
              <CompletionRing pct={closest.pct} size={62} stroke={6} color={closest.accent} fontSize={15} />
              <div><div className="highlight-name">{closest.name}</div><div className="highlight-sub">Only {closest.missing} left to find</div></div>
            </div>
            <button className="btn" onClick={() => ctx.openCollection(closest.id)} style={{ marginTop: 4 }}>View collection <I.arrowRight size={14} /></button>
          </div>
          <div className="panel highlight-card">
            <div className="eyebrow">Needs attention</div>
            <div className="highlight-main">
              <CompletionRing pct={needs.pct} size={62} stroke={6} color={needs.accent} fontSize={15} />
              <div><div className="highlight-name">{needs.name}</div><div className="highlight-sub">{needs.missing} items still missing</div></div>
            </div>
            <button className="btn" onClick={() => ctx.openCollection(needs.id)} style={{ marginTop: 4 }}>View collection <I.arrowRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* Distribution */}
      <div className="panel stat-panel" style={{ marginTop: 22 }}>
        <div className="section-head" style={{ margin: "0 0 16px" }}><div className="eyebrow">Hoard by type</div><span style={{ fontSize: 12.5, color: "var(--mute)" }}>{totalOwned.toLocaleString()} items owned</span></div>
        <div className="dist-bar">
          {sorted.map(c => <span key={c.id} title={`${c.name} · ${c.owned}`} style={{ width: (c.owned / totalOwned * 100) + "%", background: c.accent }} />)}
        </div>
        <div className="legend">
          {sorted.map(c => (
            <div className="legend-item" key={c.id}>
              <span className="legend-dot" style={{ background: c.accent }} />
              <span className="legend-name">{c.name}</span>
              <span className="legend-val">{Math.round(c.owned / totalOwned * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Growth */}
      <div className="panel stat-panel" style={{ marginTop: 22 }}>
        <div className="section-head" style={{ margin: "0 0 4px" }}><div className="eyebrow">Acquisitions · last 6 months</div><span style={{ fontSize: 12.5, color: "var(--mute)" }}>{ytd} items</span></div>
        <div className="growth">
          {GROWTH.map(g => (
            <div className="growth-col" key={g.m}>
              <div className="growth-bar-wrap"><div className="growth-bar" style={{ height: (g.n / maxGrowth * 100) + "%" }}><span className="growth-n">{g.n}</span></div></div>
              <div className="growth-m">{g.m}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Statistics });
/* ===== HODD app root ===== */
const { useState, useEffect, useRef } = React;

/* Accent palettes keyed by primary hex: [base, soft, deep] */
const ACCENTS = {
  "#4f46e5": ["#4f46e5", "#6366f1", "#4338ca"], // indigo
  "#0d9488": ["#0d9488", "#14b8a6", "#0f766e"], // teal
  "#e2503b": ["#e2503b", "#f06a57", "#c43f2c"], // coral
  "#2563eb": ["#2563eb", "#3b82f6", "#1d4ed8"], // cobalt
};
const HEADLINE_FONTS = {
  "Bricolage": '"Bricolage Grotesque", "Hanken Grotesk", system-ui, sans-serif',
  "Space Grotesk": '"Space Grotesk", "Hanken Grotesk", system-ui, sans-serif',
};
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
  return `rgba(${(n>>16)&255}, ${(n>>8)&255}, ${n&255}, ${a})`;
}
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "#4f46e5",
  "headline": "Bricolage",
  "homeStyle": "Collection-first",
  "collStyle": "Shelves",
  "shelfArt": "Covers"
}/*EDITMODE-END*/;

/* ---- Add-item flow: batch shorthand → local parse → confirm ---- */
const ADD_EXAMPLES = ["Pokemon Red CIB", "Morgan Dollar 1884-O", "Dune hardcover", "Blade Runner 2049 4K", "Kind of Blue 180g"];

function ConfBadge({ c }) {
  return <span className={"conf " + c}>{c === "high" ? "Confident" : "Confirm"}</span>;
}

function AddCard({ item, onChange, onRemove }) {
  const setField = (i, v) => {
    const fields = item.fields.map((f, j) => j === i ? { ...f, v, c: "high" } : f);
    onChange({ ...item, fields, askCount: fields.filter(f => f.c === "ask").length });
  };
  const collections = [...new Set(Object.values(window.TYPE_COLL))];
  return (
    <div className="add-card">
      <div className="add-card-cover"><Cover item={{ title: item.title, type: item.type, color: item.color }} h={84} /></div>
      <div className="add-card-body">
        <div className="add-card-head">
          <input className="add-title" value={item.title} onChange={e => onChange({ ...item, title: e.target.value, fields: item.fields.map(f => f.k === "Title" ? { ...f, v: e.target.value } : f) })} />
          <div className="add-card-meta">
            <span className="add-type">{window.typeIcon(item.type, { size: 13, stroke: 1.8 })} {window.TYPE_LABEL[item.type]}</span>
            <span className="add-arrow">→</span>
            <select className="add-coll" value={item.collection} onChange={e => onChange({ ...item, collection: e.target.value })}>
              {collections.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="add-fields">
          {item.fields.filter(f => f.k !== "Title" && f.k !== "Type").map((f, i0) => {
            const i = item.fields.indexOf(f);
            return (
              <div className={"add-field" + (f.c === "ask" ? " ask" : "")} key={f.k}>
                <span className="afk">{f.k}</span>
                {f.c === "ask"
                  ? <input className="afv-input" placeholder={f.v} onChange={e => setField(i, e.target.value)} />
                  : <span className="afv">{f.v}</span>}
                {f.c === "high" && <I.check size={12} stroke={2.6} className="af-ok" />}
              </div>
            );
          })}
        </div>
      </div>
      <button className="add-remove" onClick={onRemove} title="Remove"><I.close size={15} /></button>
    </div>
  );
}

function AddModal({ onClose, ctx }) {
  const narrow = useNarrow();
  if (narrow) return <QuickCapture onClose={onClose} />;
  return <AddDesktop onClose={onClose} ctx={ctx} />;
}

function AddDesktop({ onClose, ctx }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState("input"); // input | thinking | review
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const lineCount = text.split("\n").map(s => s.trim()).filter(Boolean).length;

  function analyze() {
    if (!text.trim()) return;
    setStage("thinking");
    setTimeout(() => { setItems(window.parseHoardLines(text)); setStage("review"); }, 1000);
  }
  function addExample(s) {
    setText(t => (t.trim() ? t.replace(/\n*$/, "") + "\n" : "") + s);
    inputRef.current && inputRef.current.focus();
  }
  const totalAsk = items.reduce((n, it) => n + it.askCount, 0);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="t">
            <I.sparkle size={20} style={{ color: "var(--accent)" }} />
            <div>
              <div className="lbl">Add to your hoard</div>
              <h3>{stage === "review" ? `${items.length} item${items.length !== 1 ? "s" : ""} recognized` : "What did you collect?"}</h3>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: 38, height: 38 }}><I.close size={18} /></button>
        </div>

        <div className="modal-body">
          {stage !== "review" && (
            <>
              <textarea ref={inputRef} className="ai-textarea" rows={5}
                placeholder={"Type or paste — one item per line\n\nPokemon Red CIB\nMorgan Dollar 1884-O\nDune hardcover"}
                value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) analyze(); }} />
              <div className="ai-hint"><I.sparkle size={13} /> Local AI reads your shorthand line by line and fills in the details. Nothing is saved until you confirm.</div>
              <div className="add-examples">
                <span className="add-examples-lbl">Try</span>
                {ADD_EXAMPLES.map(s => <div className="chip" key={s} onClick={() => addExample(s)}>{s}</div>)}
              </div>
              {stage === "thinking" && (
                <div className="parse-status" style={{ marginTop: 20 }}>
                  <span className="ai-spinner" /> Reading locally — extracting titles, platforms, editions…
                </div>
              )}
            </>
          )}

          {stage === "review" && (
            <div className="parse">
              <div className="parse-status">
                <I.check size={16} stroke={2.4} /> Parsed on-device.{" "}
                {totalAsk > 0 ? <span>{totalAsk} field{totalAsk !== 1 ? "s" : ""} need a quick confirm.</span> : <span>Everything looks confident.</span>}
              </div>
              <div className="add-list">
                {items.map((it, i) => (
                  <AddCard key={it.id} item={it}
                    onChange={u => setItems(items.map((x, j) => j === i ? u : x))}
                    onRemove={() => setItems(items.filter((_, j) => j !== i))} />
                ))}
              </div>
              <button className="add-more" onClick={() => { setStage("input"); }}><I.plus size={15} /> Add more shorthand</button>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 12, color: "var(--mute)", display: "flex", alignItems: "center", gap: 7 }}>
            <I.lock size={13} /> Runs on-device · Nothing saved until you confirm
          </div>
          {stage === "review"
            ? <button className="btn solid" disabled={!items.length} onClick={() => { onClose(); ctx.openCollection("featured"); }}><I.check size={16} /> Add {items.length} item{items.length !== 1 ? "s" : ""}</button>
            : <button className="btn solid" disabled={!lineCount} onClick={analyze}><I.sparkle size={15} /> Parse {lineCount || ""} item{lineCount !== 1 ? "s" : ""}</button>}
        </div>
      </div>
    </div>
  );
}

/* Mobile: lightweight capture — jot now, parse on desktop */
function QuickCapture({ onClose }) {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState([]);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  function commit() { const v = text.trim(); if (!v) return; setNotes(n => [v, ...n]); setText(""); inputRef.current && inputRef.current.focus(); }
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div>
            <div className="lbl" style={{ color: "var(--accent)" }}>Quick capture</div>
            <h3>Jot it down</h3>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: 38, height: 38 }}><I.close size={18} /></button>
        </div>
        <div className="sheet-body">
          <div className="ai-input-wrap">
            <input ref={inputRef} className="ai-input" placeholder="e.g. Pokemon Red CIB"
              value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commit(); }} />
            <button className="ai-go" onClick={commit}><I.enter size={18} /></button>
          </div>
          <div className="ai-hint"><I.sparkle size={13} /> Capture the shorthand now — Hodd parses it into full records on your desktop.</div>
          {notes.length > 0 && (
            <div className="capture-list">
              {notes.map((n, i) => (
                <div className="capture-item" key={i}>
                  <I.tag size={14} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
                  <span>{n}</span>
                  <button onClick={() => setNotes(notes.filter((_, j) => j !== i))}><I.close size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sheet-foot">
          <span style={{ fontSize: 12, color: "var(--mute)" }}>{notes.length} note{notes.length !== 1 ? "s" : ""} captured</span>
          <button className="btn solid" disabled={!notes.length} onClick={onClose}><I.check size={16} /> Save</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Router / shell ---- */
/* Greeting is derived from the local clock, not stored server-side. */
function greetingFor(d) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", t.theme === "dark" ? "dark" : "light");
    const [a, soft, deep] = ACCENTS[t.accent] || ACCENTS["#4f46e5"];
    root.style.setProperty("--accent", a);
    root.style.setProperty("--accent-soft", soft);
    root.style.setProperty("--accent-deep", deep);
    root.style.setProperty("--accent-wash", hexA(a, t.theme === "dark" ? 0.20 : 0.10));
    root.style.setProperty("--display", HEADLINE_FONTS[t.headline] || HEADLINE_FONTS.Bricolage);
  }, [t.theme, t.accent, t.headline]);
  const [view, setView] = useState("home");
  const [collId, setCollId] = useState(null);
  const [item, setItem] = useState(null);
  const [itemColl, setItemColl] = useState(null);
  const [searchInit, setSearchInit] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [createCollOpen, setCreateCollOpen] = useState(false);
  const [addItemColl, setAddItemColl] = useState(null);
  const [dataVer, setDataVer] = useState(0);
  const bumpData = () => setDataVer(v => v + 1);
  const [topSearch, setTopSearch] = useState("");
  const histRef = useRef([]);
  const scrollRef = useRef(null);

  function push(v) { histRef.current.push({ view, collId, item, itemColl }); setView(v); }
  function scrollTop() { if (scrollRef.current) scrollRef.current.scrollTop = 0; window.scrollTo(0, 0); }

  const ctx = {
    go(v) { push(v); scrollTop(); },
    openCollection(id) { histRef.current.push({ view, collId, item, itemColl }); setCollId(id); setView("collection"); scrollTop(); },
    openItem(it, coll) { histRef.current.push({ view, collId, item, itemColl }); setItem(it); setItemColl(coll || null); setView("item"); scrollTop(); },
    back() {
      const h = histRef.current.pop();
      if (h) { setView(h.view); setCollId(h.collId); setItem(h.item); setItemColl(h.itemColl); }
      else setView("home");
      scrollTop();
    },
    search(q) { setSearchInit(q || ""); push("search"); scrollTop(); },
    newCollection() { setCreateCollOpen(true); },
    addToCollection(coll) { setAddItemColl(coll); },
  };

  useEffect(() => { scrollTop(); }, [view]);

  // Topbar config per view
  const user = useUser();
  const greeting = greetingFor(new Date());
  const name = user.data ? user.data.name : "";
  let bar;
  if (view === "home") bar = { title: name ? `${greeting}, ${name}.` : `${greeting}.`, subtitle: "Every item has a story. What will you discover tonight?" };
  else if (view === "collections") bar = { title: "Collections", subtitle: "Everything you value, gathered in one place." };
  else if (view === "search") bar = { title: "Search", subtitle: "Ask in plain language — Hodd translates it into your hoard." };
  else if (view === "wishlist") bar = { title: "Wishlist", subtitle: "What's still out there." };
  else if (view === "timeline") bar = { title: "Timeline", subtitle: "How your collection has grown." };
  else if (view === "discover") bar = { title: "Discover", subtitle: "Find what connects, and what's missing." };
  else if (view === "statistics") bar = { title: "Statistics", subtitle: "The shape of your hoard." };
  else if (view === "settings") bar = { title: "Settings", subtitle: null };
  else bar = { bare: true };

  let body;
  if (view === "home") body = t.homeStyle === "Dashboard" ? <Home ctx={ctx} /> : <HomeNew ctx={ctx} art={t.shelfArt} />;
  else if (view === "collections") body = t.collStyle === "Cards" ? <Collections ctx={ctx} /> : <CollectionsNew ctx={ctx} art={t.shelfArt} />;
  else if (view === "collection") body = <CollectionDetail collId={collId} ctx={ctx} />;
  else if (view === "item") body = <ItemDetail item={item} collection={itemColl} ctx={ctx} />;
  else if (view === "search") body = <SearchView initial={searchInit} ctx={ctx} />;
  else if (view === "statistics") body = <Statistics ctx={ctx} />;
  else body = <ComingSoon name={bar.title || "Coming soon"} />;

  const activeNav = ["collection"].includes(view) ? "collections" : ["item"].includes(view) ? null : view;

  const navTo = (id) => {
    if (id === "search") { ctx.search(""); return; }
    setCollId(null); setItem(null); setItemColl(null);
    histRef.current = []; setView(id); scrollTop();
  };

  return (
    <div className="app">
      <Sidebar active={activeNav} onNav={navTo} />
      <MobileTopBar onAdd={() => setAddOpen(true)} />
      <div className="main" ref={scrollRef} style={{ height: "100vh", overflowY: "auto" }}>
        <div className="canvas">
          <Topbar {...bar}
            onAdd={() => setAddOpen(true)}
            onSearch={() => { if (view !== "search") ctx.search(""); }}
            searchValue={topSearch}
            onSearchChange={setTopSearch}
            onSearchSubmit={(q) => { setTopSearch(""); ctx.search(q); }} />
          <div key={view + ":" + collId + ":" + dataVer}>{body}</div>
        </div>
      </div>
      <MobileTabs active={activeNav} onNav={navTo} />
      {addOpen && <AddModal onClose={() => setAddOpen(false)} ctx={ctx} />}
      {createCollOpen && <CreateCollectionModal
        onClose={() => setCreateCollOpen(false)}
        onCreated={(rec) => { setCreateCollOpen(false); bumpData(); ctx.openCollection(rec.id); }} />}
      {addItemColl && <AddItemModal collection={addItemColl}
        onClose={() => setAddItemColl(null)}
        onAdded={() => { setAddItemColl(null); bumpData(); }} />}
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Home" value={t.homeStyle} options={["Collection-first", "Dashboard"]}
          onChange={v => setTweak("homeStyle", v)} />
        <TweakRadio label="Collections" value={t.collStyle} options={["Shelves", "Cards"]}
          onChange={v => setTweak("collStyle", v)} />
        <TweakRadio label="Shelf art" value={t.shelfArt} options={["Covers", "Spines"]}
          onChange={v => setTweak("shelfArt", v)} />
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={["light", "dark"]}
          onChange={v => setTweak("theme", v)} />
        <TweakColor label="Accent" value={t.accent}
          options={["#4f46e5", "#0d9488", "#e2503b", "#2563eb"]}
          onChange={v => setTweak("accent", v)} />
        <TweakSection label="Typography" />
        <TweakRadio label="Headline" value={t.headline} options={["Bricolage", "Space Grotesk"]}
          onChange={v => setTweak("headline", v)} />
      </TweaksPanel>
    </div>
  );
}

export default App;
