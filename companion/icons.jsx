/* HODD Companion — icons, mark, and shared visual helpers */

function HoddMark({ size = 28, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={style} aria-hidden="true">
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

function Icon({ children, size = 22, stroke = 1.8, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

const I = {
  home:    (p) => <Icon {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9h14v-9" /><path d="M9.5 19v-5h5v5" /></Icon>,
  scan:    (p) => <Icon {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M4 12h16" /></Icon>,
  scanLine:(p) => <Icon {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M7 9v6M10 9v6M13 9v6M16 9v6" /></Icon>,
  barcode: (p) => <Icon {...p}><path d="M4 5v14M7 5v14M10.5 5v14M13 5v14M16.5 5v14M20 5v14" /></Icon>,
  qr:      (p) => <Icon {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2M20 14v.01M14 20h.01M18 18h2v2M18 14h.01" /></Icon>,
  queue:   (p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="19" cy="18" r="2.4" /></Icon>,
  layers:  (p) => <Icon {...p}><path d="M12 3 21 8l-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" opacity=".6" /></Icon>,
  plus:    (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>,
  settings:(p) => <Icon {...p}><circle cx="12" cy="12" r="3.1" /><path d="M12 2.6v2.4M12 19v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.6 12H5M19 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" /></Icon>,
  check:   (p) => <Icon {...p}><path d="M4 12.5 9 17.5 20 6.5" /></Icon>,
  close:   (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>,
  chevDown:(p) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>,
  chevRight:(p)=> <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>,
  arrowLeft:(p)=> <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>,
  arrowRight:(p)=><Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>,
  desktop: (p) => <Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon>,
  phone:   (p) => <Icon {...p}><rect x="7" y="3" width="10" height="18" rx="2.4" /><path d="M11 18h2" /></Icon>,
  wifi:    (p) => <Icon {...p}><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9 9 0 0 1 13 0M8.5 16a4.5 4.5 0 0 1 7 0" /><path d="M12 19.5h.01" /></Icon>,
  link:    (p) => <Icon {...p}><path d="M9 12a3 3 0 0 1 3-3h3a3 3 0 0 1 0 6h-1.5" /><path d="M15 12a3 3 0 0 1-3 3H9a3 3 0 0 1 0-6h1.5" /></Icon>,
  bolt:    (p) => <Icon {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></Icon>,
  torch:   (p) => <Icon {...p}><path d="M9 2h6l-.5 4.5a2 2 0 0 1-.4 1L13 9v11a1 1 0 0 1-1 1 1 1 0 0 1-1-1V9L9.9 7.5a2 2 0 0 1-.4-1L9 2Z" /><path d="M9 5h6" /></Icon>,
  refresh: (p) => <Icon {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></Icon>,
  cloud:   (p) => <Icon {...p}><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 18 18H7Z" /></Icon>,
  cloudOff:(p) => <Icon {...p}><path d="M7 18a4 4 0 0 1-.9-7.9M9 6.2A5 5 0 0 1 16.6 8.7 3.5 3.5 0 0 1 19 14.7" /><path d="M3 3l18 18" /><path d="M18 18H8" /></Icon>,
  pencil:  (p) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M13.5 6.5 17.5 10.5" /></Icon>,
  bell:    (p) => <Icon {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10.5 19a1.7 1.7 0 0 0 3 0" /></Icon>,
  trash:   (p) => <Icon {...p}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></Icon>,
  search:  (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Icon>,
  shield:  (p) => <Icon {...p}><path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" /></Icon>,
  info:    (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>,
  sliders: (p) => <Icon {...p}><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></Icon>,
  sun:     (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4" /></Icon>,
  book:    (p) => <Icon {...p}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" /><path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5A1.5 1.5 0 0 1 5 19.5Z" /></Icon>,
  film:    (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></Icon>,
  gamepad: (p) => <Icon {...p}><path d="M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.2 2l-.8-.9H9l-.8.9A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4Z" /><path d="M7.5 11v2M6.5 12h2M15.5 11.5h.01M17.5 13.5h.01" /></Icon>,
  coin:    (p) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /></Icon>,
  comic:   (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="1.6" /><path d="M8 3v18M11 7h6M11 10h6M11 13h4" /></Icon>,
  disc:    (p) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2" /></Icon>,
  tag:     (p) => <Icon {...p}><path d="M3 12V4h8l9 9-8 8-9-9Z" /><circle cx="7.5" cy="7.5" r="1.4" /></Icon>,
};

const TYPE_META = {
  book:  { icon: I.book,    label: "Book",  collection: "books",  cname: "Books" },
  movie: { icon: I.film,    label: "Movie", collection: "movies", cname: "Movies" },
  game:  { icon: I.gamepad, label: "Game",  collection: "games",  cname: "Games" },
  coin:  { icon: I.coin,    label: "Coin",  collection: "coins",  cname: "Coins" },
  comic: { icon: I.comic,   label: "Comic", collection: "comics", cname: "Comics" },
  vinyl: { icon: I.disc,    label: "Vinyl", collection: "vinyl",  cname: "Vinyl" },
  other: { icon: I.tag,     label: "Item",  collection: "other",  cname: "Other" },
};
function typeIcon(type, props) { return (TYPE_META[type] || TYPE_META.other).icon(props); }

// Deterministic seeded barcode bar widths so a barcode looks stable per item.
function barcodeBars(seed, count = 38) {
  let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const out = [];
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(1 + (s % 4)); // width 1-4px
  }
  return out;
}

// Cover swatch — colored placeholder consistent with the desktop "ghost" covers.
function Cover({ item, w = 56, h = 76, glyph = true, radius = 7 }) {
  const color = (item && item.color) || "#3a3a44";
  const init = (item && item.title ? item.title.replace(/^(The|A) /, "") : "?").slice(0, 1).toUpperCase();
  return (
    <div className="cover-sw" style={{ width: w, height: h, background: `linear-gradient(165deg, ${color}, ${shade(color, -22)})`, borderRadius: radius }}>
      <div className="cv-sheen" />
      {glyph && <div className="cv-glyph">{typeIcon(item && item.type, { size: Math.max(12, w * 0.26) })}</div>}
      <div className="cv-init" style={{ fontSize: Math.max(16, w * 0.5) }}>{init}</div>
    </div>
  );
}

function shade(hex, amt) {
  const n = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + amt));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

Object.assign(window, { HoddMark, Icon, I, TYPE_META, typeIcon, barcodeBars, Cover, shade });
