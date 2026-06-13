// @ts-nocheck
import React from 'react';
import { I, typeIcon } from '../icons';
import { CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useCollections, useStats, useSearchIndex } from '../hooks';

export function Statistics({ ctx }) {
  const cols = useCollections();
  const stats = useStats();
  const index = useSearchIndex();

  if (cols.loading || stats.loading || index.loading) return <Loading label="Crunching the numbers…" />;
  if (cols.error || stats.error) {
    return <ErrorState error={cols.error || stats.error} onRetry={() => { cols.refetch(); stats.refetch(); }} />;
  }

  const GROWTH = (stats.data && stats.data.growth) || [];
  const idx = index.data || [];

  // Condition distribution across all owned items that have a condition set
  const CONDITION_ORDER = ["Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"];
  const CONDITION_COLORS = { "Mint": "#5ba47a", "Near Mint": "#7fb0c4", "Very Good": "#6366f1", "Good": "#c9a24c", "Fair": "#cf6b5a", "Poor": "#C0392B" };
  const conditionCounts: Record<string, number> = {};
  idx.filter(i => i.owned !== false && i.condition).forEach(i => {
    conditionCounts[i.condition] = (conditionCounts[i.condition] || 0) + 1;
  });
  const conditionData = CONDITION_ORDER.filter(c => conditionCounts[c]).map(c => ({
    label: c, count: conditionCounts[c], color: CONDITION_COLORS[c] || "var(--accent)",
  }));
  const conditionTotal = conditionData.reduce((s, c) => s + c.count, 0);

  // Top sub-entries per type (platform for games, author for books, etc.)
  const subLabel = { game: "Platform", book: "Author", movie: "Director", vinyl: "Artist", coin: "Mint", comic: "Publisher" };
  const topCreators: { type: string; label: string; entries: { name: string; count: number }[] }[] = [];
  ["game", "book", "movie", "vinyl"].forEach(type => {
    const owned = idx.filter(i => i.owned !== false && i.type === type && i.sub);
    if (!owned.length) return;
    const counts: Record<string, number> = {};
    owned.forEach(i => { counts[i.sub] = (counts[i.sub] || 0) + 1; });
    const entries = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    if (entries.length >= 2) topCreators.push({ type, label: subLabel[type] || "Sub", entries });
  });
  const consumption = [
    { label: "Games completed", icon: "check", color: "#9B7BD4", done: idx.filter(i => i.type === "game" && i.owned !== false && i.completed === true).length,  total: idx.filter(i => i.type === "game" && i.owned !== false).length },
    { label: "Movies watched",  icon: "check", color: "#5C8AD6", done: idx.filter(i => i.type === "movie" && i.owned !== false && i.watched === true).length, total: idx.filter(i => i.type === "movie" && i.owned !== false).length },
    { label: "Books read",      icon: "check", color: "#5BA47A", done: idx.filter(i => i.type === "book" && i.owned !== false && i.watched === true).length,  total: idx.filter(i => i.type === "book" && i.owned !== false).length },
  ].filter(c => c.total > 0);
  const cols_ = cols.data || [];
  if (!cols_.length) return <EmptyState title="No collections yet" sub="Add your first collection to start tracking your hoard." />;
  const totalOwned = cols_.reduce((s, c) => s + c.owned, 0);
  const totalMissing = cols_.reduce((s, c) => s + c.missing, 0);
  const totalItems = totalOwned + totalMissing;
  const avgPct = totalItems ? Math.round(totalOwned / totalItems * 100) : 0;
  const sorted = [...cols_].sort((a, b) => b.pct - a.pct);
  const closest = sorted[0];
  const needs = sorted[sorted.length - 1];
  const maxGrowth = Math.max(...GROWTH.map(g => g.n), 1);
  const ytd = GROWTH.reduce((s, g) => s + g.n, 0);

  return (
    <div className="view-enter">
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

        <div className="stat-aside">
          <div className="panel highlight-card">
            <div className="eyebrow">Closest to complete</div>
            <div className="highlight-main">
              <CompletionRing pct={closest.pct} size={62} stroke={6} color={closest.accent} fontSize={15} />
              <div><div className="highlight-name">{closest.name}</div><div className="highlight-sub">{closest.missing === 0 ? "Complete!" : `Only ${closest.missing} left to find`}</div></div>
            </div>
            <button className="btn" onClick={() => ctx.openCollection(closest.id)} style={{ marginTop: 4 }}>View collection <I.arrowRight size={14} /></button>
          </div>
          {needs.id !== closest.id && (
            <div className="panel highlight-card">
              <div className="eyebrow">Needs attention</div>
              <div className="highlight-main">
                <CompletionRing pct={needs.pct} size={62} stroke={6} color={needs.accent} fontSize={15} />
                <div><div className="highlight-name">{needs.name}</div><div className="highlight-sub">{needs.missing} items still missing</div></div>
              </div>
              <button className="btn" onClick={() => ctx.openCollection(needs.id)} style={{ marginTop: 4 }}>View collection <I.arrowRight size={14} /></button>
            </div>
          )}
        </div>
      </div>

      <div className="panel stat-panel" style={{ marginTop: 22 }}>
        <div className="section-head" style={{ margin: "0 0 16px" }}><div className="eyebrow">Hoard by type</div><span style={{ fontSize: 12.5, color: "var(--mute)" }}>{totalOwned.toLocaleString()} items owned</span></div>
        <div className="dist-bar">
          {sorted.map(c => <span key={c.id} title={`${c.name} · ${c.owned}`} style={{ width: (c.owned / Math.max(totalOwned, 1) * 100) + "%", background: c.accent }} />)}
        </div>
        <div className="legend">
          {sorted.map(c => (
            <div className="legend-item" key={c.id}>
              <span className="legend-dot" style={{ background: c.accent }} />
              <span className="legend-name">{c.name}</span>
              <span className="legend-val">{Math.round(c.owned / Math.max(totalOwned, 1) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

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

      {conditionData.length > 0 && (
        <div className="panel stat-panel" style={{ marginTop: 22 }}>
          <div className="section-head" style={{ margin: "0 0 16px" }}>
            <div className="eyebrow">Condition distribution</div>
            <span style={{ fontSize: 12.5, color: "var(--mute)" }}>{conditionTotal} graded items</span>
          </div>
          <div className="dist-bar" style={{ marginBottom: 16 }}>
            {conditionData.map(c => (
              <span key={c.label} title={`${c.label} · ${c.count}`}
                style={{ width: (c.count / conditionTotal * 100) + "%", background: c.color }} />
            ))}
          </div>
          <div className="legend">
            {conditionData.map(c => (
              <div className="legend-item" key={c.label}>
                <span className="legend-dot" style={{ background: c.color }} />
                <span className="legend-name">{c.label}</span>
                <span className="legend-val">{c.count} <span style={{ color: "var(--mute)", fontSize: 11 }}>({Math.round(c.count / conditionTotal * 100)}%)</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topCreators.length > 0 && (
        <div className="panel stat-panel" style={{ marginTop: 22 }}>
          <div className="section-head" style={{ margin: "0 0 20px" }}><div className="eyebrow">Top entries by category</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 24 }}>
            {topCreators.map(tc => {
              const max = tc.entries[0].count;
              return (
                <div key={tc.type}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 12 }}>
                    {typeIcon(tc.type, { size: 13, stroke: 1.8, style: { display: "inline-block", verticalAlign: "middle", marginRight: 5 } })}
                    {tc.label}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tc.entries.map(e => (
                      <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                          <div style={{ height: 4, background: "var(--panel-3)", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: (e.count / max * 100) + "%", background: "var(--accent)", borderRadius: 2 }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--dim)", flex: "0 0 auto" }}>{e.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {consumption.length > 0 && (
        <div className="panel stat-panel" style={{ marginTop: 22 }}>
          <div className="section-head" style={{ margin: "0 0 16px" }}><div className="eyebrow">Progress tracking</div></div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {consumption.map(c => {
              const pct = c.total ? Math.round(c.done / c.total * 100) : 0;
              return (
                <div key={c.label} style={{ flex: "1 1 140px", background: "var(--panel-2)", borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 10 }}>{c.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 700, color: c.color, lineHeight: 1 }}>{pct}</span>
                    <span style={{ fontSize: 16, color: "var(--dim)" }}>%</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 4 }}>{c.done} of {c.total}</div>
                  <div style={{ height: 6, background: "var(--panel-3)", borderRadius: 4, marginTop: 12, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: c.color, borderRadius: 4, transition: "width 1s var(--ease)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
