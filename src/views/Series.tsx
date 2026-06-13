// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useSearchIndex } from '../hooks';

export function SeriesView({ ctx }) {
  const index = useSearchIndex();
  const [selected, setSelected] = React.useState(null);
  const [sort, setSort] = React.useState("alpha");

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
    const owned = series.items.filter(i => i.owned !== false);
    const missing = series.items.filter(i => i.owned === false);
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
        {owned.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 12, color: "var(--mute)" }}>Owned <span style={{ opacity: 0.55, fontSize: 10 }}>· {owned.length}</span></div>
            <div className="items-grid" style={{ marginBottom: 32 }}>
              {owned.map(it => (
                <div className="item-cell" key={it.id} onClick={() => ctx.openItem(it)}>
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
                <div className="item-cell missing" key={it.id} onClick={() => ctx.openItem(it)}>
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
