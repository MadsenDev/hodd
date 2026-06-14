/* HODD Companion — mock data + helpers (plain JS, no JSX) */
(function () {
  const COLLECTIONS = [
    { id: "books",  name: "Books",  type: "book",  accent: "#5BA47A", owned: 342 },
    { id: "movies", name: "Movies", type: "movie", accent: "#5C8AD6", owned: 286 },
    { id: "games",  name: "Games",  type: "game",  accent: "#9B7BD4", owned: 178 },
    { id: "coins",  name: "Coins",  type: "coin",  accent: "#C9A24C", owned: 126 },
    { id: "comics", name: "Comics", type: "comic", accent: "#CF6B5A", owned: 95  },
    { id: "vinyl",  name: "Vinyl",  type: "vinyl", accent: "#7FB0C4", owned: 64  },
  ];

  // Pool the scanner will "resolve" barcodes against — real catalog items + a barcode.
  const SCAN_POOL = [
    { id: "dune-book",   title: "Dune",                  type: "book",  sub: "Frank Herbert · 1965",      color: "#C9923B", barcode: "9780441013593", format: "Paperback",  collection: "books",  conf: "high" },
    { id: "bladerunner", title: "Blade Runner 2049",     type: "movie", sub: "Denis Villeneuve · 2017",   color: "#C77A2E", barcode: "0883929598922", format: "4K Blu-ray", collection: "movies", conf: "high" },
    { id: "pk-emerald",  title: "Pokémon Emerald",       type: "game",  sub: "Game Boy Advance · 2004",   color: "#3B9C6D", barcode: "0045496737528", format: "Cartridge",  collection: "games",  conf: "high" },
    { id: "vn-blue",     title: "Blue Train",            type: "vinyl", sub: "John Coltrane · 1957",      color: "#2E4258", barcode: "0602577489839", format: "Vinyl LP",   collection: "vinyl",  conf: "high" },
    { id: "lotr-return", title: "The Return of the King",type: "book",  sub: "J.R.R. Tolkien · 1955",     color: "#2E4258", barcode: "9780261103573", format: "Hardcover",  collection: "books",  conf: "ask"  },
    { id: "mv-prison",   title: "Prisoners",             type: "movie", sub: "Denis Villeneuve · 2013",   color: "#2E3440", barcode: "5051892148665", format: "Blu-ray",    collection: "movies", conf: "high" },
  ];

  // Seed captures for the queue + recent activity.
  const SEED_CAPTURES = [
    { uid: "c1", title: "Pokémon Crystal",  type: "game",  sub: "Game Boy Color · 2000", color: "#5FA8C4", collection: "games",  via: "scan", state: "synced", ago: "2m ago" },
    { uid: "c2", title: "The Silmarillion", type: "book",  sub: "J.R.R. Tolkien · 1977", color: "#4A3A5A", collection: "books",  via: "scan", state: "synced", ago: "6m ago" },
    { uid: "c3", title: "Walking Liberty 1943", type: "coin", sub: "Philadelphia Mint",  color: "#A9A8A2", collection: "coins",  via: "manual", state: "synced", ago: "1h ago" },
  ];

  const DESKTOP = { name: "Studio iMac", host: "studio.local", network: "Hoard-5G", latency: 8 };

  const TYPES = ["book", "movie", "game", "coin", "comic", "vinyl", "other"];

  let _id = 100;
  function newUid() { return "c" + (++_id); }

  window.HODD_DATA = { COLLECTIONS, SCAN_POOL, SEED_CAPTURES, DESKTOP, TYPES, newUid };
})();
