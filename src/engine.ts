// @ts-nocheck
// Heuristic on-device search + shorthand parser. Pure functions, no network.

// ── Type vocabulary ──────────────────────────────────────────────────────────

export const TYPE_KW = {
  game:  ["game", "games", "gameboy", "game boy", "gba", "snes", "nes", "n64", "nintendo", "cart", "cartridge", "cib", "pokemon", "pokémon", "zelda", "mario", "metroid", "kirby", "wario"],
  book:  ["book", "books", "novel", "hardcover", "paperback", "hardback", "tolkien", "hobbit", "dune", "foundation", "asimov", "author", "first edition"],
  movie: ["movie", "movies", "film", "blu-ray", "bluray", "blu ray", "4k", "uhd", "dvd", "criterion", "steelbook"],
  coin:  ["coin", "coins", "dollar", "morgan", "peace", "mint", "dime", "nickel", "penny", "cent", "half", "ms-", "ms6", "ms 6", "graded", "silver eagle", "bullion"],
  comic: ["comic", "comics", "issue", "floppy", "trade paperback", "tpb", "omnibus"],
  vinyl: ["vinyl", "record", "records", "lp", "180g", "180 gram", "45rpm", "album pressing"],
};
export const TYPE_LABEL = { game: "Game", book: "Book", movie: "Movie", coin: "Coin", comic: "Comic", vinyl: "Vinyl" };
export const TYPE_COLL  = { game: "Games", book: "Books", movie: "Movies", coin: "Coins", comic: "Comics", vinyl: "Vinyl" };
export const TYPE_COLOR = { game: "#9B7BD4", book: "#5BA47A", movie: "#5C8AD6", coin: "#C9A24C", comic: "#CF6B5A", vinyl: "#7FB0C4" };

// ── Known titles (drives confident enrichment) ────────────────────────────────

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

// ── Format / edition detection ────────────────────────────────────────────────

const FORMATS = [
  { re: /\bcib\b|complete in box/i,                 label: "Complete In Box",   types: ["game"] },
  { re: /\bsealed\b|brand new|\bnib\b/i,            label: "Sealed",            types: ["game", "movie", "vinyl"] },
  { re: /\bloose\b|cart only|\bcart\b|cartridge/i,  label: "Cartridge only",    types: ["game"] },
  { re: /\b4k\b|uhd/i,                              label: "4K Blu-ray",        types: ["movie"] },
  { re: /blu-?\s?ray/i,                             label: "Blu-ray",           types: ["movie"] },
  { re: /\bdvd\b/i,                                 label: "DVD",               types: ["movie"] },
  { re: /criterion/i,                               label: "Criterion",         types: ["movie"] },
  { re: /steelbook/i,                               label: "Steelbook",         types: ["movie"] },
  { re: /first edition|1st ed/i,                    label: "First Edition",     types: ["book"] },
  { re: /hardcover|hardback|\bhc\b/i,               label: "Hardcover",         types: ["book"] },
  { re: /paperback|\bpb\b/i,                        label: "Paperback",         types: ["book"] },
  { re: /signed/i,                                  label: "Signed",            types: ["book", "vinyl"] },
  { re: /180\s?g(ram)?/i,                           label: "180g pressing",     types: ["vinyl"] },
  { re: /\blp\b|original press/i,                   label: "Original LP",       types: ["vinyl"] },
  { re: /\bms-?\s?(\d{2})\b/i,                      label: (m) => `MS-${m[1]}`, types: ["coin"] },
  { re: /\bpf-?\s?(\d{2})\b|proof/i,               label: "Proof",             types: ["coin"] },
];

const MINTS = { O: "New Orleans", S: "San Francisco", D: "Denver", CC: "Carson City", P: "Philadelphia" };

// ── Parser ────────────────────────────────────────────────────────────────────

function cleanTitle(line) {
  let t = line
    .replace(/\bcib\b|complete in box|sealed|loose|cart only|cartridge|hardcover|hardback|paperback|first edition|1st ed|blu-?\s?ray|\b4k\b|uhd|dvd|criterion|steelbook|180\s?g(ram)?|\blp\b|\bms-?\s?\d{2}\b|\bpf-?\s?\d{2}\b|proof|graded|signed/gi, "")
    .replace(/\b(1[6-9]\d{2}|20\d{2})\b/g, "")
    .replace(/-(O|S|D|CC|P)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,;]+\s*$/, "")
    .trim();
  if (!t) return line.trim();
  return t.replace(/\b([a-z])([a-z']+)/g, (_, a, b) => a.toUpperCase() + b);
}

export function detectType(lower) {
  let best = null, bestScore = 0;
  for (const [type, kws] of Object.entries(TYPE_KW)) {
    let score = 0;
    for (const k of kws) if (lower.includes(k)) score += (k.length > 4 ? 2 : 1);
    if (score > bestScore) { bestScore = score; best = type; }
  }
  return { type: best || "game", strong: bestScore >= 2 };
}

export function parseOne(line) {
  const lower = line.toLowerCase();
  const known = KNOWN_TITLES.find(k => k.kw.some(kw => lower.includes(kw)));
  const det = detectType(lower);
  const type = known ? known.type : det.type;

  const yrMatch = line.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  const year = yrMatch ? +yrMatch[0] : (known && known.year) || null;

  let edition = null;
  for (const f of FORMATS) {
    const m = lower.match(f.re) || line.match(f.re);
    if (m && (!f.types || f.types.includes(type))) { edition = typeof f.label === "function" ? f.label(m) : f.label; break; }
  }

  let mint = null;
  const mm = line.match(/-(O|S|D|CC|P)\b/i);
  if (type === "coin" && mm) mint = `${MINTS[mm[1].toUpperCase()]} (${mm[1].toUpperCase()})`;

  const title = known ? known.title : cleanTitle(line);
  const color = known ? known.color : TYPE_COLOR[type];

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

export function parseHoardLines(text) {
  return text.split(/\n|·|•/).map(s => s.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean).slice(0, 20).map(parseOne);
}

// ── Search engine ─────────────────────────────────────────────────────────────

export function searchHoard(query, idx) {
  const q = (query || "").toLowerCase();
  idx = idx || [];
  const tokens = [];
  let res = idx.slice();

  let typeHit = null;
  for (const [type, kws] of Object.entries(TYPE_KW)) {
    if (kws.some(k => q.includes(k))) { typeHit = type; break; }
  }
  if (typeHit) { tokens.push(["Type", TYPE_LABEL[typeHit]]); res = res.filter(i => i.type === typeHit); }

  if (q.includes("nintendo") || q.includes("game boy") || q.includes("gameboy")) tokens.push(["Platform", "Nintendo"]);
  if (q.includes("tolkien")) { tokens.push(["Author", "J.R.R. Tolkien"]); res = res.filter(i => (i.author || "").includes("Tolkien")); }

  const decade = q.match(/\b((19|20)\d0)s\b/) || q.match(/\b(\d0)s\b/);
  if (decade) {
    const start = decade[1].length === 4 ? +decade[1] : (+("19" + decade[1]));
    tokens.push(["Decade", `${start}s`]);
    res = res.filter(i => i.year >= start && i.year < start + 10);
  } else {
    const yr = q.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
    if (yr) { tokens.push(["Year", yr[0]]); res = res.filter(i => i.year == +yr[0]); }
  }

  let intent = null;
  if (/missing|don'?t have|haven'?t got|need|to collect|still need/.test(q)) { intent = "missing"; tokens.push(["Status", "Missing"]); res = res.filter(i => i.owned === false); }
  else if (/\bown\b|owned|i have|in my/.test(q)) { intent = "owned"; tokens.push(["Status", "Owned"]); res = res.filter(i => i.owned !== false); }
  if (/haven'?t watched|unwatched|not watched|still to watch/.test(q)) { intent = "unwatched"; tokens.push(["Watched", "No"]); res = res.filter(i => i.type === "movie" && i.owned !== false && i.watched === false); }
  if (/haven'?t (completed|finished)|incomplete|unfinished|not (completed|finished)/.test(q)) { intent = "incomplete"; tokens.push(["Progress", "Not completed"]); res = res.filter(i => i.type === "game" && i.owned !== false && !i.completed); }
  if (/haven'?t read|unread|not read|still to read/.test(q)) { intent = "unread"; tokens.push(["Read", "No"]); res = res.filter(i => i.type === "book" && i.owned !== false && i.watched === false); }

  // Always try to narrow results with meaningful title/series keywords.
  // Strip common function words and words already handled by other filters.
  const STOP = new Set([
    "the", "and", "for", "with", "that", "this", "they", "them", "from", "into",
    "have", "been", "are", "was", "what", "which", "where", "when", "but", "all",
    "you", "your", "own", "owned", "having", "missing", "not", "still", "some",
    "completed", "finished", "watched", "unwatched", "unfinished", "incomplete", "read", "unread",
    "book", "books", "game", "games", "movie", "movies", "coin", "coins",
    "vinyl", "comic", "comics", "record", "records", "film", "films", "lp",
  ]);
  const words = q.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  if (words.length) {
    const m = res.filter(i => words.some(w =>
      (i.title || "").toLowerCase().includes(w) ||
      (i.series || "").toLowerCase().includes(w) ||
      (i.sub || "").toLowerCase().includes(w)
    ));
    if (m.length) {
      res = m;
      if (!tokens.find(t => t[0] === "Match")) tokens.push(["Match", "Title / series"]);
    }
  }

  const summary = writeAnswer(query, res, { typeHit, intent });
  return { tokens, results: res.slice(0, 24), total: res.length, summary };
}

function writeAnswer(query, res, ctx) {
  const n = res.length;
  const list = (arr) => arr.map(i => i.title).slice(0, 4).join(", ") + (arr.length > 4 ? `, +${arr.length - 4} more` : "");
  if (n === 0) return "Nothing in your hoard matches that yet — try a broader query, or add it from the + button.";
  if (ctx.intent === "missing") {
    const coll = res[0].coll || "the set";
    return `You're missing ${n} item${n > 1 ? "s" : ""} — ${list(res)}. They're the gaps in ${coll}.`;
  }
  if (ctx.intent === "unwatched") return `${n} owned movie${n > 1 ? "s are" : " is"} still unwatched: ${list(res)}. The disc waits.`;
  if (ctx.intent === "incomplete") return `${n} game${n > 1 ? "s" : ""} you own but haven't finished: ${list(res)}.`;
  if (ctx.intent === "unread") return `${n} book${n > 1 ? "s" : ""} you own but haven't read yet: ${list(res)}.`;
  if (ctx.intent === "owned") return `You own ${n} matching item${n > 1 ? "s" : ""}: ${list(res)}.`;
  return `Found ${n} item${n > 1 ? "s" : ""} across your hoard: ${list(res)}.`;
}
