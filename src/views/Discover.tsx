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
