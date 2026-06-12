// @ts-nocheck
import React from 'react';
import { HoddMark, Icon, I, typeIcon } from './icons';

// ── Color utilities ───────────────────────────────────────────────────────────

export function rgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
export function shade(hex, amt) {
  const h = hex.replace("#", ""); const n = parseInt(h, 16);
  let r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
}

export const COVER_RATIOS = { game: 0.72, book: 0.68, movie: 0.67, comic: 0.66, coin: 1, vinyl: 1, other: 0.74 };

// ── CompletionRing ────────────────────────────────────────────────────────────

export function CompletionRing({ pct = 0, size = 54, stroke = 5, color = "var(--gold)", track = "var(--panel-3)", showPct = true, fontSize = undefined }) {
  const uid = React.useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const val = Math.round(Math.max(0, Math.min(100, pct)));
  const off = c * (1 - val / 100);
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

// ── Cover ─────────────────────────────────────────────────────────────────────

export function Cover({ item, h = 168, ghost = false, onClick = undefined, glyph = true }) {
  const type = item.type || item.coverType || "game";
  const ratio = COVER_RATIOS[type] || 0.7;
  const w = type === "coin" || type === "vinyl" ? h : Math.round(h * ratio);
  const color = item.color || "#7a6a4a";
  const cls = "cover" + (onClick ? " click" : "") + (ghost ? " ghost" : "");

  if (ghost) {
    const Glyph = typeIcon(type, { size: Math.max(20, h * 0.16), stroke: 1.4 });
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

  if (type === "coin") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: "50%",
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

  if (type === "vinyl") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: 6,
        background: `linear-gradient(135deg, ${shade(color,20)}, ${shade(color,-40)})`, position: "relative", overflow: "hidden" }} onClick={onClick}>
        <div style={{ position: "absolute", right: -h*0.18, top: "50%", transform: "translateY(-50%)", width: h*0.78, height: h*0.78, borderRadius: "50%",
          background: `repeating-radial-gradient(circle, #111 0 2px, #1a1a1a 2px 4px)`, boxShadow: "0 0 0 3px #0a0a0a" }}>
          <div style={{ position:"absolute", inset:"38%", borderRadius:"50%", background: color }} />
        </div>
        <div style={{ position: "absolute", left: 12, bottom: 12, fontFamily: "var(--serif)", fontSize: h*0.12, color: "#fff", maxWidth: "60%", lineHeight: 1.05 }}>{item.title}</div>
      </div>
    );
  }

  if (type === "game") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: 6, overflow: "hidden",
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

  if (type === "comic") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: 5, overflow: "hidden",
        background: `linear-gradient(160deg, ${shade(color,30)}, ${shade(color,-35)})`, position: "relative" }} onClick={onClick}>
        <div style={{ background: rgba("#000",0.32), padding: "7% 8%", borderBottom: `2px solid ${rgba("#fff",0.18)}` }}>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: h*0.1, color: "#fff", lineHeight: 1.05 }}>{item.title}</div>
        </div>
        <div style={{ position: "absolute", bottom: "8%", left: "8%", fontSize: h*0.055, color: rgba("#fff",0.8) }}>{item.sub || ""}</div>
      </div>
    );
  }

  if (type === "book") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: "3px 6px 6px 3px", overflow: "hidden",
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

  if (type === "movie") {
    return (
      <div className={cls} style={{ width: w, height: h, borderRadius: 5, overflow: "hidden",
        background: `linear-gradient(180deg, ${shade(color,25)}, ${shade(color,-45)} 88%)`, position: "relative" }} onClick={onClick}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 50% at 50% 22%, ${rgba("#fff",0.22)}, transparent 70%)` }} />
        <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "8%" }}>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: h*0.13, color: "#fff", lineHeight: 1, textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>{item.title}</div>
          {item.sub && <div style={{ fontSize: h*0.052, letterSpacing: ".14em", textTransform: "uppercase", color: rgba("#fff",0.8), marginTop: 6 }}>{item.sub || item.format}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={cls} style={{ width: w, height: h, borderRadius: 8, overflow: "hidden",
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

// Fills container width and derives height from the cover type's aspect ratio.
export function FluidCover({ item, ghost = false, onClick = undefined, glyph = true, maxWidth = 999 }) {
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
  const ratio = COVER_RATIOS[type] || 0.7;
  const eff = Math.min(w || 0, maxWidth);
  const h = eff ? Math.round(eff / ratio) : 0;
  return (
    <div ref={ref} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      {h > 0 && <Cover item={item} h={h} ghost={ghost} glyph={glyph} onClick={onClick} />}
    </div>
  );
}

// ── Navigation ────────────────────────────────────────────────────────────────

export function Sidebar({ active, onNav, user, onSettings }) {
  const nm = (user && user.name) ? user.name : "Collector";
  const initial = nm.trim()[0]?.toUpperCase() || "C";
  const items = [
    ["home", "Home", I.home],
    ["collections", "Collections", I.grid],
    ["wishlist", "Wishlist", I.heart],
    ["favorites", "Favorites", I.heartFill],
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
      <div className="user" style={{ cursor: "pointer" }} onClick={onSettings}>
        <div className="avatar avatar-initials" aria-label={nm}>{initial}</div>
        <div className="meta">
          <div className="nm">{nm}</div>
          <div className="sub">Settings</div>
        </div>
      </div>
    </aside>
  );
}

export function Topbar({ title, subtitle, bare, onSearch, onAdd, searchValue, onSearchChange, onSearchSubmit }) {
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

export function MobileTopBar({ onAdd }) {
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

export function MobileTabs({ active, onNav }) {
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

// ── Viewport hook ─────────────────────────────────────────────────────────────

export function useNarrow(bp = 760) {
  const [n, setN] = React.useState(typeof window !== "undefined" && window.innerWidth <= bp);
  React.useEffect(() => {
    const on = () => setN(window.innerWidth <= bp);
    window.addEventListener("resize", on); on();
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return n;
}

// ── Async view states ─────────────────────────────────────────────────────────

export function Loading({ label = "Loading your hoard…" }) {
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

export function ErrorState({ error, onRetry, label = "We couldn't load this" }) {
  return (
    <div className="view-state view-enter" role="alert">
      <div className="view-state-ic err"><I.alert size={26} stroke={1.7} /></div>
      <div className="em">{label}</div>
      <div className="view-state-sub">{(error && error.message) || "Something went wrong reaching your hoard."}</div>
      {onRetry && <button className="btn" onClick={onRetry} style={{ marginTop: 16 }}><I.refresh size={15} /> Try again</button>}
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", sub = undefined, children = undefined }) {
  return (
    <div className="view-state view-enter">
      <div className="view-state-ic"><HoddMark size={40} color="var(--gold-deep)" style={{ opacity: .5 }} /></div>
      <div className="em">{title}</div>
      {sub && <div className="view-state-sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Async({ state, children, loadingLabel = undefined }) {
  if (state.loading) return <Loading label={loadingLabel} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.refetch} />;
  return children(state.data);
}

// ── Shelf building blocks (used by Home and Collections views) ─────────────────

function shelfRng(seed) {
  let s = 2166136261;
  for (const ch of String(seed)) { s ^= ch.charCodeAt(0); s = Math.imul(s, 16777619) >>> 0; }
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export function SpineMosaic({ accent, pct = 0, count = 14, height = 150 }) {
  const r = shelfRng(accent + "·" + count);
  const filled = Math.round((count * Math.max(0, Math.min(100, pct))) / 100);
  const spines = Array.from({ length: count }, (_, i) => {
    const hf = 0.52 + r() * 0.46;
    const w = 7 + Math.round(r() * 8);
    const sh = -36 + Math.round(r() * 66);
    return { hf, w, sh, gap: i >= filled };
  });
  return (
    <div className="shelf" style={{ height, background: `linear-gradient(180deg, ${rgba(accent, 0.12)}, ${rgba(accent, 0.02)})` }}>
      {spines.map((s, i) => (
        <div key={i} className={"spine" + (s.gap ? " gap" : "")}
          style={{ width: s.w, height: Math.round((height - 22) * s.hf), background: s.gap ? "transparent" : shade(accent, s.sh) }} />
      ))}
      <div className="plank" style={{ background: shade(accent, -50) }} />
    </div>
  );
}

export function CoverShelf({ items = [], accent, height = 140, coverH = 96, maxOwned = 5, ghosts = 1 }) {
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
          <div className="crate-cover" key={s.it.id || i} style={{ marginLeft: i ? -overlap : 0, zIndex: seq.length - i }}>
            <Cover item={s.it} h={coverH} ghost={s.ghost} glyph={coverH > 110} />
          </div>
        ))}
      </div>
      <div className="plank" style={{ background: shade(accent, -52) }} />
    </div>
  );
}
