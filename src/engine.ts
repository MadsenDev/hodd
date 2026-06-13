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

const PLATFORM_RE = /\b(game\s?boy(\s?(color|colour|advance|sp))?|gba|gbc|nes|snes|n64|gamecube|wii\s?u?|switch|ps\s?[1-5]|playstation\s?[1-5]|xbox(\s?(360|one|series\s?[xs]))?|sega\s?(genesis|saturn|dreamcast|mega\s?drive)|\b3?ds\b|psp|vita|pc|steam)\b/gi;

function cleanTitle(line) {
  let t = line
    .replace(/\bcib\b|complete in box|sealed|loose|cart only|cartridge|hardcover|hardback|paperback|first edition|1st ed|blu-?\s?ray|\b4k\b|uhd|dvd|criterion|steelbook|180\s?g(ram)?|\blp\b|\bms-?\s?\d{2}\b|\bpf-?\s?\d{2}\b|proof|graded|signed/gi, "")
    .replace(PLATFORM_RE, "")
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

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Ordered longest-first so "game boy advance" matches before "game boy"
const PLATFORM_KW: [string, string][] = [
  ["game boy advance", "Game Boy Advance"], ["game boy colour", "Game Boy Color"],
  ["game boy color", "Game Boy Color"],     ["game boy", "Game Boy"],
  ["gameboy advance", "Game Boy Advance"],  ["gameboy color", "Game Boy Color"],
  ["gameboy", "Game Boy"],                  ["gba", "Game Boy Advance"],
  ["gbc", "Game Boy Color"],               ["nintendo 64", "N64"],
  ["nintendo switch", "Switch"],            ["gamecube", "GameCube"],
  ["playstation 5", "PS5"], ["playstation 4", "PS4"], ["playstation 3", "PS3"],
  ["playstation 2", "PS2"], ["playstation 1", "PS1"], ["playstation", "PlayStation"],
  ["xbox series x", "Xbox Series X"], ["xbox series s", "Xbox Series S"],
  ["xbox series", "Xbox Series X"], ["xbox one", "Xbox One"],
  ["xbox 360", "Xbox 360"], ["xbox", "Xbox"],
  ["wii u", "Wii U"], ["wii", "Wii"], ["switch", "Switch"],
  ["snes", "SNES"], ["nes", "NES"], ["n64", "N64"],
  ["ps5", "PS5"], ["ps4", "PS4"], ["ps3", "PS3"], ["ps2", "PS2"], ["ps1", "PS1"],
  ["3ds", "3DS"], ["nds", "DS"], ["psp", "PSP"], ["vita", "PS Vita"],
  ["sega saturn", "Sega Saturn"], ["sega genesis", "Sega Genesis"],
  ["mega drive", "Sega Genesis"], ["dreamcast", "Dreamcast"],
  ["game gear", "Game Gear"], ["sega", "Sega"],
];

const PUBLISHER_KW: [string, string][] = [
  ["dc comics", "DC"], ["marvel comics", "Marvel"], ["marvel", "Marvel"], ["dc", "DC"],
  ["image comics", "Image"], ["image", "Image"], ["dark horse", "Dark Horse"],
  ["idw publishing", "IDW"], ["idw", "IDW"], ["boom studios", "BOOM! Studios"],
  ["fantagraphics", "Fantagraphics"], ["oni press", "Oni Press"],
];

const FORMAT_KW: [string, string][] = [
  ["complete in box", "Complete in box"], ["cib", "Complete in box"],
  ["4k blu-ray", "4K Blu-ray"], ["4k bluray", "4K Blu-ray"], ["4k uhd", "4K Blu-ray"],
  ["blu-ray", "Blu-ray"], ["bluray", "Blu-ray"], ["blu ray", "Blu-ray"],
  ["first edition", "First Edition"], ["steelbook", "Steelbook"],
  ["criterion", "Criterion"], ["dvd", "DVD"], ["vhs", "VHS"],
  ["sealed", "Sealed"], ["loose", "Loose"],
  ["hardcover", "Hardcover"], ["hardback", "Hardcover"],
  ["paperback", "Paperback"], ["mass market", "Mass market"],
  ["180g", "180g"], ["180 gram", "180g"], ["original press", "Original press"],
  ["game pass", "Xbox Game Pass"], ["xbox game pass", "Xbox Game Pass"],
  ["ps plus", "PS Plus"], ["playstation plus", "PS Plus"],
  ["nintendo eshop", "Nintendo eShop"], ["eshop", "Nintendo eShop"],
  ["battle.net", "Battle.net"], ["battlenet", "Battle.net"],
  ["ubisoft connect", "Ubisoft Connect"], ["ea app", "EA App"],
  ["epic games", "Epic Games"], ["itch.io", "itch.io"],
  ["comixology", "Comixology"], ["kindle", "Kindle"],
  ["kobo", "Kobo"], ["apple books", "Apple Books"],
  ["local file", "Local file"], ["steam", "Steam"],
  ["gog", "GOG"], ["digital", "Digital"],
];

const CONDITION_KW: [string, string][] = [
  ["near mint", "Near Mint"], ["very good", "Very Good"],
  ["mint condition", "Mint"], ["good condition", "Good"],
  ["mint", "Mint"], ["good", "Good"], ["fair", "Fair"], ["poor", "Poor"],
];

const REGION_KW: [string, string][] = [
  ["ntsc-j", "Japan"], ["japanese", "Japan"], ["japan", "Japan"],
  ["north america", "North America"], ["ntsc-u", "North America"],
  ["ntsc", "NTSC"], ["european", "Europe"], ["europe", "Europe"],
  ["pal", "PAL"], ["uk", "UK"], ["german", "Germany"], ["french", "France"],
];

export function searchHoard(query, idx) {
  const q = norm(query);
  idx = idx || [];
  const tokens = [];
  let res = idx.slice();

  // ── 1. Type detection ──────────────────────────────────────────────────────
  let typeHit = null;
  for (const [type, kws] of Object.entries(TYPE_KW)) {
    if (kws.some(k => q.includes(norm(k)))) { typeHit = type; break; }
  }
  if (typeHit) {
    tokens.push(["Type", TYPE_LABEL[typeHit]]);
    res = res.filter(i => i.type === typeHit);
  }

  // ── 2. Platform ────────────────────────────────────────────────────────────
  let platformHit = null;
  for (const [kw, label] of PLATFORM_KW) {
    if (q.includes(kw)) { platformHit = label; break; }
  }
  if (platformHit) {
    tokens.push(["Platform", platformHit]);
    const pn = norm(platformHit);
    res = res.filter(i => {
      const sub = norm(i.sub);
      return sub === pn || sub.startsWith(pn) || pn.startsWith(sub.split(" ")[0]);
    });
    if (!typeHit) { res = res.filter(i => i.type === "game"); }
  }

  // ── 3. Publisher (comics/books) ────────────────────────────────────────────
  let publisherHit = null;
  for (const [kw, label] of PUBLISHER_KW) {
    if (q.includes(kw)) { publisherHit = label; break; }
  }
  if (publisherHit) {
    tokens.push(["Publisher", publisherHit]);
    const pn = norm(publisherHit);
    res = res.filter(i => norm(i.sub).includes(pn) || norm(i.publisher || "").includes(pn));
    if (!typeHit) res = res.filter(i => i.type === "comic");
  }

  // ── 4. Year range / decade / exact ────────────────────────────────────────
  const between = q.match(/between\s+((?:19|20)\d{2})\s+and\s+((?:19|20)\d{2})/);
  const before  = q.match(/before\s+((?:19|20)\d{2})|pre[- ]((?:19|20)\d{2})/);
  const after   = q.match(/after\s+((?:19|20)\d{2})|since\s+((?:19|20)\d{2})/);
  const decade  = q.match(/\b((19|20)\d0)s\b/) || q.match(/\b((?:19|20)\d)0s\b/);
  const exactYr = !between && !before && !after && !decade
    ? q.match(/\b(1[6-9]\d{2}|20\d{2})\b/) : null;

  if (between) {
    const [y1, y2] = [+between[1], +between[2]].sort((a, b) => a - b);
    tokens.push(["Year", `${y1}–${y2}`]);
    res = res.filter(i => i.year >= y1 && i.year <= y2);
  } else if (before) {
    const y = +(before[1] || before[2]);
    tokens.push(["Year", `before ${y}`]);
    res = res.filter(i => i.year && i.year < y);
  } else if (after) {
    const y = +(after[1] || after[2]);
    tokens.push(["Year", `after ${y}`]);
    res = res.filter(i => i.year && i.year > y);
  } else if (decade) {
    const raw = decade[1] || decade[2];
    const start = raw.length === 4 ? +raw : +(raw.length === 3 ? raw + "0" : "19" + raw + "0");
    tokens.push(["Decade", `${start}s`]);
    res = res.filter(i => i.year >= start && i.year < start + 10);
  } else if (exactYr) {
    tokens.push(["Year", exactYr[1]]);
    res = res.filter(i => i.year == +exactYr[1]);
  }

  // ── 5. Ownership / status ──────────────────────────────────────────────────
  let intent = null;
  if (/missing|don'?t have|haven'?t got|still need|looking for|want to (get|buy|find)/.test(q)) {
    intent = "missing"; tokens.push(["Status", "Missing"]);
    res = res.filter(i => i.owned === false);
  } else if (/\bown\b|owned|i have|in my|my collection/.test(q)) {
    intent = "owned"; tokens.push(["Status", "Owned"]);
    res = res.filter(i => i.owned !== false);
  } else if (/\bborrowed?\b|\blent\b|\blending\b/.test(q)) {
    intent = "borrowed"; tokens.push(["Status", "Borrowed"]);
    res = res.filter(i => i.ownership === "borrowed");
  } else if (/subscri|game pass|ps plus|kindle unlimited/.test(q)) {
    intent = "subscription"; tokens.push(["Status", "Subscription"]);
    res = res.filter(i => i.ownership === "subscription");
  }

  if (/favou?rites?|\bstarred\b|\bbest\b/.test(q)) {
    tokens.push(["Filter", "Favorites"]);
    res = res.filter(i => i.favorite);
  }

  // ── 6. Progress ────────────────────────────────────────────────────────────
  if (/haven'?t watched|unwatched|not yet watched|still to watch/.test(q)) {
    intent = intent || "unwatched";
    tokens.push(["Watched", "No"]);
    res = res.filter(i => i.owned !== false && !i.watched);
    if (!typeHit) res = res.filter(i => i.type === "movie" || i.type === "book");
  } else if (/\bwatched\b/.test(q) && !/haven'?t|not/.test(q)) {
    tokens.push(["Watched", "Yes"]);
    res = res.filter(i => i.watched);
  }

  if (/haven'?t (completed|finished)|incomplete|unfinished|not yet (completed|finished)/.test(q)) {
    intent = intent || "incomplete";
    tokens.push(["Completed", "No"]);
    res = res.filter(i => i.owned !== false && !i.completed);
    if (!typeHit) res = res.filter(i => i.type === "game");
  } else if (/\bcompleted\b|\bfinished\b/.test(q) && !/haven'?t|not/.test(q)) {
    tokens.push(["Completed", "Yes"]);
    res = res.filter(i => i.completed);
  }

  if (/haven'?t read|unread|not yet read|still to read/.test(q)) {
    intent = intent || "unread";
    tokens.push(["Read", "No"]);
    res = res.filter(i => i.owned !== false && !i.watched);
    if (!typeHit) res = res.filter(i => i.type === "book");
  } else if (/\bread\b/.test(q) && !/haven'?t|not/.test(q)) {
    tokens.push(["Read", "Yes"]);
    res = res.filter(i => i.watched && i.type === "book");
  }

  // ── 7. Format / completeness ───────────────────────────────────────────────
  let formatHit = null;
  for (const [kw, label] of FORMAT_KW) {
    if (q.includes(kw)) { formatHit = label; break; }
  }
  if (formatHit) {
    tokens.push(["Format", formatHit]);
    const fn = norm(formatHit);
    res = res.filter(i =>
      norm(i.format || "").includes(fn) ||
      norm(i.completeness || "").includes(fn) ||
      norm(i.pressing || "").includes(fn) ||
      norm(i.edition || "").includes(fn)
    );
  }

  // ── 8. Condition ───────────────────────────────────────────────────────────
  if (typeHit !== "coin") {
    for (const [kw, label] of CONDITION_KW) {
      if (q.includes(kw)) {
        tokens.push(["Condition", label]);
        res = res.filter(i => norm(i.condition || "").includes(norm(label)));
        break;
      }
    }
  }

  // ── 9. Grade (coins) ───────────────────────────────────────────────────────
  const gradeMatch = q.match(/\bms[- ]?(\d{2})\b|\bpf[- ]?(\d{2})\b/);
  if (gradeMatch) {
    tokens.push(["Grade", gradeMatch[0].toUpperCase()]);
    res = res.filter(i => norm(i.grade || "").includes(norm(gradeMatch[0])));
  } else if (/\bgraded\b/.test(q)) {
    tokens.push(["Filter", "Graded"]);
    res = res.filter(i => i.grade && i.grade.trim());
  }

  // ── 10. Region ─────────────────────────────────────────────────────────────
  let regionHit = null;
  for (const [kw, label] of REGION_KW) {
    if (q.includes(kw)) { regionHit = label; break; }
  }
  if (regionHit) {
    tokens.push(["Region", regionHit]);
    const rn = norm(regionHit);
    res = res.filter(i => norm(i.region || "").includes(rn));
  }

  // ── 11. Series explicit ────────────────────────────────────────────────────
  // "zelda series", "the mario franchise" etc. — handled via keyword below,
  // but label it properly when series field matches
  let seriesHit = null;

  // ── 12. Keyword matching (accent-normalised, scored) ──────────────────────
  const STOP = new Set([
    "the", "and", "for", "with", "that", "this", "they", "them", "from", "into",
    "have", "been", "are", "was", "what", "which", "where", "when", "but", "all",
    "you", "your", "own", "owned", "having", "missing", "not", "still", "some",
    "give", "show", "list", "find", "search", "get", "tell", "me", "about", "any",
    "completed", "finished", "watched", "unwatched", "unfinished", "incomplete",
    "read", "unread", "lent", "borrowed", "want", "need",
    "book", "books", "game", "games", "movie", "movies", "coin", "coins",
    "vinyl", "comic", "comics", "record", "records", "film", "films", "lp",
    "collection", "hoard", "library", "item", "items", "series", "franchise",
    "before", "after", "since", "between", "decade",
  ]);
  // Remove words consumed by previous filters
  const consumed = new Set([
    ...(platformHit ? norm(platformHit).split(" ") : []),
    ...(publisherHit ? norm(publisherHit).split(" ") : []),
    ...(formatHit ? norm(formatHit).split(" ") : []),
    ...(regionHit ? norm(regionHit).split(" ") : []),
  ]);
  const words = q.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w) && !consumed.has(w));

  if (words.length) {
    const scored = res.map(i => {
      const fields = [
        norm(i.title), norm(i.series), norm(i.sub),
        norm(i.publisher || ""), norm(i.format || ""),
        norm(i.edition || ""), norm(i.coll || ""),
      ].join(" ");
      const hits = words.filter(w => fields.includes(w));
      // Bonus for series match
      const seriesMatch = words.some(w => norm(i.series || "").includes(w));
      return { i, score: hits.length + (seriesMatch ? 0.5 : 0), hits };
    }).filter(({ score }) => score > 0);

    if (scored.length) {
      // Detect if we matched on series
      const seriesMatches = scored.filter(s => words.some(w => norm(s.i.series || "").includes(w)));
      if (seriesMatches.length === scored.length && scored[0].i.series) {
        seriesHit = scored[0].i.series;
        tokens.push(["Series", seriesHit]);
      } else {
        const kw = [...new Set(scored.flatMap(s => s.hits))].join(", ");
        if (kw) tokens.push(["Keywords", kw]);
      }
      const maxScore = Math.max(...scored.map(s => s.score));
      res = scored
        .filter(s => s.score >= Math.max(1, maxScore * 0.5))
        .sort((a, b) => b.score - a.score)
        .map(s => s.i);
    }
  }

  const summary = writeAnswer(query, res, { typeHit, intent, platformHit, publisherHit, seriesHit });
  return { tokens, results: res.slice(0, 24), total: res.length, summary };
}

function writeAnswer(query, res, ctx) {
  const n = res.length;
  const s = n === 1 ? "" : "s";
  const list = (arr, max = 5) =>
    arr.slice(0, max).map(i => i.title).join(", ") + (arr.length > max ? ` and ${arr.length - max} more` : "");

  if (n === 0) {
    if (ctx.intent === "missing") return "Nothing on your want list matches — try broadening the search.";
    if (ctx.platformHit) return `No ${ctx.platformHit} games in your hoard yet — try adding some.`;
    return "Nothing in your hoard matches that yet — try a broader query, or add it from the + button.";
  }

  if (ctx.intent === "missing")      return `${n} item${s} still missing from your hoard: ${list(res)}.`;
  if (ctx.intent === "unwatched")    return `${n} movie${s} on the shelf unwatched: ${list(res)}.`;
  if (ctx.intent === "incomplete")   return `${n} game${s} started but not yet finished: ${list(res)}.`;
  if (ctx.intent === "unread")       return `${n} book${s} waiting to be read: ${list(res)}.`;
  if (ctx.intent === "borrowed")     return `${n} borrowed item${s}: ${list(res)}.`;
  if (ctx.intent === "subscription") return `${n} item${s} via subscription: ${list(res)}.`;

  if (ctx.seriesHit) return `${n} item${s} in the ${ctx.seriesHit} series: ${list(res)}.`;
  if (ctx.platformHit) return `${n} ${ctx.platformHit} game${s} in your hoard: ${list(res)}.`;
  if (ctx.publisherHit) return `${n} ${ctx.publisherHit} title${s}: ${list(res)}.`;

  const typeLabel = ctx.typeHit ? TYPE_LABEL[ctx.typeHit].toLowerCase() : "item";
  if (n === 1) return `One matching ${typeLabel}: ${res[0].title}.`;
  if (n <= 6) return `${n} ${typeLabel}${s} match: ${list(res)}.`;
  return `Found ${n} ${typeLabel}${s}. Top matches: ${list(res)}.`;
}
