// @ts-nocheck
import React from 'react';
import { Cover, Loading, ErrorState, EmptyState } from '../components';
import { useTimeline } from '../hooks';

function monthLabel(dateStr) {
  if (!dateStr) return 'Unknown';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch (_) { return 'Unknown'; }
}

export function Timeline({ ctx }) {
  const { data, loading, error, refetch } = useTimeline();

  if (loading) return <Loading label="Building your timeline…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const items = data || [];

  if (!items.length) return (
    <EmptyState
      title="Your story starts here"
      sub="Add items to your collections and they'll appear here — your hoard, ordered by time."
    />
  );

  const groups = [];
  const seen = {};
  items.forEach(it => {
    const label = monthLabel(it.created_at);
    if (!seen[label]) { seen[label] = { label, items: [] }; groups.push(seen[label]); }
    seen[label].items.push(it);
  });

  return (
    <div className="view-enter">
      <div className="section-head" style={{ marginBottom: 4 }}>
        <div className="eyebrow">{items.length} item{items.length !== 1 ? 's' : ''} collected</div>
      </div>
      {groups.map(g => (
        <div key={g.label} className="tl-month-group">
          <div className="tl-month-head">
            <span className="eyebrow">{g.label}</span>
            <span className="tl-month-count">{g.items.length} added</span>
          </div>
          <div className="items-grid">
            {g.items.map(it => (
              <div className="item-cell" key={it.id} onClick={() => ctx.openItem(it)}>
                <Cover item={it} h={200} />
                <div className="nm">{it.title}</div>
                <div className="yr">
                  {it.collName || ''}
                  {it.year ? ` · ${it.year}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
