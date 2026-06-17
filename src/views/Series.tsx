// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useSearchIndex } from '../hooks';

function SeriesStrip({ items, accent, onSelect }) {
  const numbered = items.filter(i => i.series_number != null);
  if (!numbered.length) return null;

  const min = Math.floor(Math.min(...numbered.map(i => i.series_number)));
  const max = Math.ceil(Math.max(...numbered.map(i => i.series_number)));
  const byNum = {};
  items.forEach(i => { if (i.series_number != null) byNum[i.series_number] = i; });

  const blocks = [];
  for (let n = min; n <= max; n++) {
    const whole = byNum[n];
    const half  = byNum[n - 0.5];
    if (half) {
      const isOwned = half.owned !== false;
      blocks.push(
        <div
          key={n - 0.5}
          title={half.title}
          onClick={() => onSelect(half)}
          style={{
            width: 16, height: 32, borderRadius: 3,
            background: isOwned ? accent : "transparent",
            border: isOwned ? "none" : `1.5px dashed ${accent}`,
            opacity: isOwned ? 1 : 0.55,
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        />
      );
    }
    const isOwned = whole ? whole.owned !== false : false;
    blocks.push(
      <div
        key={n}
        title={whole ? whole.title : `#${n} — not tracked`}
        onClick={whole ? () => onSelect(whole) : undefined}
        style={{
          width: 28, height: 36, borderRadius: 4,
          background: isOwned ? accent : "transparent",
          border: isOwned ? "none" : `1.5px dashed ${accent}`,
          opacity: whole ? (isOwned ? 1 : 0.5) : 0.18,
          cursor: whole ? "pointer" : "default", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 600,
          color: isOwned ? "rgba(255,255,255,0.8)" : accent,
        }}
      >
        {n}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 10 }}>
        Series map
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {blocks}
      </div>
    </div>
  );
}

export function SeriesView({ ctx }) {
  const index = useSearchIndex();
  const [selected, setSelected] = React.useState(null);
  const [sort, setSort] = React.useState("alpha");
  const itemRefs = React.useRef({});

  if (index.loading) return <Loading label="Scanning your series…" />;
  if (index.error) return <ErrorState error={index.error} onRetry={index.refetch} />;

  const idx = index.data || [];
  const itemsWithSeries = idx.filter(i => i.series && i.series.trim());

  if (!itemsWithSeries.length) return (
    <EmptyState
      title="No series tracked yet"
      sub="Add a series name when editing an item — it will appear here so you can browse your collection by story arc, franchise, or set."
    />
  );

  // Build series map
  const seriesMap: Record<string, typeof idx> = {};
  itemsWithSeries.forEach(it => {
    const key = it.series.trim();
    if (!seriesMap[key]) seriesMap[key] = [];
    seriesMap[key].push(it);
  });

  const seriesList = Object.entries(seriesMap).map(([name, items]) => {
    const owned = items.filter(i => i.owned !== false).length;
    const total = items.length;
    const pct = total ? Math.round(owned / total * 100) : 0;
    const accent = items[0]?.color || "var(--accent)";
    return { name, items, owned, total, pct, accent };
  });

  const sorted = [...seriesList].sort((a, b) => {
    if (sort === "alpha") return a.name.localeCompare(b.name);
    if (sort === "count") return b.total - a.total;
    if (sort === "pct")   return b.pct - a.pct;
    return 0;
  });

  if (selected) {
    const series = sorted.find(s => s.name === selected);
    if (!series) { setSelected(null); return null; }
    itemRefs.current = {};
    const sortedItems = [...series.items].sort((a, b) => {
      const an = a.series_number ?? Infinity;
      const bn = b.series_number ?? Infinity;
      return an !== bn ? an - bn : (a.title || "").localeCompare(b.title || "");
    });
    const owned = sortedItems.filter(i => i.owned !== false);
    const missing = sortedItems.filter(i => i.owned === false);
    return (
      <div className="view-enter">
        <div className="back" onClick={() => setSelected(null)}><I.arrowLeft size={16} /> All series</div>
        <div className="detail-head" style={{ marginBottom: 24 }}>
          <CompletionRing pct={series.pct} size={72} stroke={6} color={series.accent} fontSize={16} />
          <div className="titles">
            <div className="eyebrow" style={{ color: "var(--mute)" }}>Series</div>
            <h1>{series.name}</h1>
            <div className="sub">{series.owned} owned · {series.total - series.owned} missing · {series.pct}% complete</div>
          </div>
        </div>
        <SeriesStrip
          items={series.items}
          accent={series.accent}
          onSelect={it => {
            const el = itemRefs.current[it.id];
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.style.outline = "2px solid " + series.accent;
              setTimeout(() => { if (el) el.style.outline = ""; }, 1200);
            }
          }}
        />
        {owned.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 12, color: "var(--mute)" }}>Owned <span style={{ opacity: 0.55, fontSize: 10 }}>· {owned.length}</span></div>
            <div className="items-grid" style={{ marginBottom: 32 }}>
              {owned.map(it => (
                <div className="item-cell" key={it.id}
                  ref={el => { itemRefs.current[it.id] = el; }}
                  onClick={() => ctx.openItem(it)}>
                  <Cover item={it} h={200} />
                  <div className="nm">{it.title}</div>
                  <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
                  <div className="badge badge-owned"><I.check size={12} stroke={2.2} /> Owned</div>
                </div>
              ))}
            </div>
          </>
        )}
        {missing.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 12, color: "var(--mute)" }}>Still hunting <span style={{ opacity: 0.55, fontSize: 10 }}>· {missing.length}</span></div>
            <div className="items-grid">
              {missing.map(it => (
                <div className="item-cell missing" key={it.id}
                  ref={el => { itemRefs.current[it.id] = el; }}
                  onClick={() => ctx.openItem(it)}>
                  <Cover item={it} h={200} ghost />
                  <div className="nm">{it.title}</div>
                  <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
                  <div className="badge badge-missing"><I.plus size={12} stroke={2} /> Missing</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="view-enter">
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div className="eyebrow">{sorted.length} series tracked</div>
        <div className="seg">
          {[["alpha", "A–Z"], ["count", "Most items"], ["pct", "Completion"]].map(([v, l]) => (
            <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="bar-rows">
        {sorted.map(s => (
          <div className="bar-row" key={s.name} onClick={() => setSelected(s.name)}
            style={{ cursor: "pointer", padding: "10px 0" }}>
            <CompletionRing pct={s.pct} size={36} stroke={3.5} color={s.accent} fontSize={10} />
            <div className="bar-row-name" style={{ flex: 1, fontWeight: 500 }}>{s.name}</div>
            <div className="bar-row-count" style={{ color: "var(--dim)", fontSize: 12.5, marginRight: 8 }}>
              {s.owned} / {s.total}
            </div>
            <I.arrowRight size={14} style={{ color: "var(--mute)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
