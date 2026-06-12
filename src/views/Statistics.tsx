// @ts-nocheck
import React from 'react';
import { I, typeIcon } from '../icons';
import { CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useCollections, useStats } from '../hooks';

export function Statistics({ ctx }) {
  const cols = useCollections();
  const stats = useStats();

  if (cols.loading || stats.loading) return <Loading label="Crunching the numbers…" />;
  if (cols.error || stats.error) {
    return <ErrorState error={cols.error || stats.error} onRetry={() => { cols.refetch(); stats.refetch(); }} />;
  }

  const GROWTH = (stats.data && stats.data.growth) || [];
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
    </div>
  );
}
