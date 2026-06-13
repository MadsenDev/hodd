// @ts-nocheck
import React from 'react';
import { I, typeIcon } from '../icons';
import { CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useCollectionsFull } from '../hooks';

export function Discover({ ctx }) {
  const { data, loading, error, refetch } = useCollectionsFull();

  if (loading) return <Loading label="Analyzing your hoard…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const colls = (data || []).filter(c => c.owned + c.missing > 0);

  if (!colls.length) return (
    <EmptyState
      title="Nothing to discover yet"
      sub="Add collections and items to start seeing patterns across your hoard."
    />
  );

  const totalOwned   = colls.reduce((s, c) => s + c.owned, 0);
  const totalMissing = colls.reduce((s, c) => s + c.missing, 0);
  const totalItems   = totalOwned + totalMissing;
  const overallPct   = totalItems ? Math.round(totalOwned / totalItems * 100) : 0;

  const byCompletion  = [...colls].sort((a, b) => b.pct - a.pct);
  const almostDone    = colls.filter(c => c.pct >= 75 && c.pct < 100 && c.missing > 0);
  const biggestGaps   = [...colls].sort((a, b) => b.missing - a.missing).slice(0, 3).filter(c => c.missing > 0);

  // Flatten all items across all collections
  const allItems = colls.flatMap(c => c.items || []);

  // Acquisition pace: items added in last 30 days vs prev 30 days
  const now = Date.now();
  const MS30 = 30 * 24 * 60 * 60 * 1000;
  const thisMonth = allItems.filter(i => i.created_at && (now - new Date(i.created_at).getTime()) < MS30).length;
  const prevMonth = allItems.filter(i => {
    if (!i.created_at) return false;
    const age = now - new Date(i.created_at).getTime();
    return age >= MS30 && age < MS30 * 2;
  }).length;
  const paceTrend = thisMonth > prevMonth ? "up" : thisMonth < prevMonth ? "down" : "flat";

  // Type breakdown
  const TYPE_COLORS = { game: "#9B7BD4", book: "#5BA47A", movie: "#5C8AD6", coin: "#C9A24C", comic: "#CF6B5A", vinyl: "#7FB0C4" };
  const typeCounts = {};
  allItems.forEach(i => { if (i.type) typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const maxTypeCount = typeEntries.length ? typeEntries[0][1] : 1;

  // Most active series
  const seriesCounts = {};
  allItems.forEach(i => { if (i.series) seriesCounts[i.series] = (seriesCounts[i.series] || 0) + 1; });
  const topSeries = Object.entries(seriesCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="view-enter">
      <div className="discover-hero">
        <div className="discover-big-ring">
          <CompletionRing pct={overallPct} size={96} stroke={10} color="var(--accent)" fontSize={22} />
        </div>
        <div className="discover-hero-stats">
          <div className="d-stat"><div className="d-big">{totalOwned}</div><div className="d-lbl">items owned</div></div>
          <div className="d-stat"><div className="d-big">{totalMissing}</div><div className="d-lbl">still to find</div></div>
          <div className="d-stat"><div className="d-big">{colls.length}</div><div className="d-lbl">collections</div></div>
        </div>
      </div>

      {almostDone.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 32 }}>
            <div className="eyebrow">Almost there</div>
          </div>
          <div className="discover-section">
            {almostDone.map(c => (
              <div key={c.id} className="discover-row" onClick={() => ctx.openCollection(c.id)}>
                <CompletionRing pct={c.pct} size={52} stroke={6} color={c.accent} fontSize={13} />
                <div className="dr-info">
                  <div className="dr-name">
                    <span style={{ color: c.accent, display: 'inline-flex', verticalAlign: 'middle', marginRight: 5 }}>
                      {typeIcon(c.type, { size: 14, stroke: 1.8 })}
                    </span>
                    {c.name}
                  </div>
                  <div className="dr-sub">{c.missing} item{c.missing !== 1 ? 's' : ''} left to complete</div>
                  <div className="pbar" style={{ marginTop: 5 }}><i style={{ width: c.pct + '%', background: c.accent }} /></div>
                </div>
                <I.arrowRight size={16} style={{ color: 'var(--mute)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </>
      )}

      {biggestGaps.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 32 }}>
            <div className="eyebrow">Biggest gaps</div>
          </div>
          <div className="discover-section">
            {biggestGaps.map(c => (
              <div key={c.id} className="discover-row" onClick={() => ctx.openCollection(c.id)}>
                <div className="dr-gap-count" style={{ color: c.accent }}>{c.missing}</div>
                <div className="dr-info">
                  <div className="dr-name">
                    <span style={{ color: c.accent, display: 'inline-flex', verticalAlign: 'middle', marginRight: 5 }}>
                      {typeIcon(c.type, { size: 14, stroke: 1.8 })}
                    </span>
                    {c.name}
                  </div>
                  <div className="dr-sub">{c.owned} owned · {c.missing} to find</div>
                </div>
                <I.arrowRight size={16} style={{ color: 'var(--mute)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Acquisition pace */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <div className="eyebrow">Acquisition pace</div>
      </div>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--fg)' }}>{thisMonth}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
            item{thisMonth !== 1 ? 's' : ''} added this month
            {paceTrend === 'up' && <span style={{ marginLeft: 8, color: '#5BA47A' }}>▲ up from {prevMonth}</span>}
            {paceTrend === 'down' && <span style={{ marginLeft: 8, color: '#CF6B5A' }}>▼ down from {prevMonth}</span>}
            {paceTrend === 'flat' && prevMonth > 0 && <span style={{ marginLeft: 8, color: 'var(--mute)', fontSize: 11 }}>same as last month</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>compared to {prevMonth} item{prevMonth !== 1 ? 's' : ''} the month before</div>
        </div>
      </div>

      {/* Type breakdown */}
      {typeEntries.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 32 }}>
            <div className="eyebrow">Type breakdown</div>
          </div>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {typeEntries.map(([type, count]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 52, fontSize: 11, color: 'var(--mute)', textAlign: 'right', textTransform: 'capitalize', flexShrink: 0 }}>{type}</div>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(count / maxTypeCount * 100)}%`, height: '100%', background: TYPE_COLORS[type] || 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: 28, fontSize: 12, fontWeight: 600, color: 'var(--fg)', textAlign: 'right', flexShrink: 0 }}>{count}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Most active series */}
      {topSeries.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 32 }}>
            <div className="eyebrow">Most active series</div>
          </div>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {topSeries.map(([series, count]) => (
              <div key={series} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border-soft)', borderRadius: 20, padding: '5px 12px', fontSize: 12 }}>
                <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{series}</span>
                <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-head" style={{ marginTop: 32 }}>
        <div className="eyebrow">All collections</div>
      </div>
      <div className="discover-section">
        {byCompletion.map(c => (
          <div key={c.id} className="discover-row" onClick={() => ctx.openCollection(c.id)}>
            <CompletionRing pct={c.pct} size={44} stroke={5} color={c.accent} fontSize={11} />
            <div className="dr-info">
              <div className="dr-name">
                <span style={{ color: c.accent, display: 'inline-flex', verticalAlign: 'middle', marginRight: 5 }}>
                  {typeIcon(c.type, { size: 14, stroke: 1.8 })}
                </span>
                {c.name}
              </div>
              <div className="dr-sub">{c.owned} owned · {c.missing} to find</div>
            </div>
            <I.arrowRight size={16} style={{ color: 'var(--mute)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
