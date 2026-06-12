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
  const [typeFilter, setTypeFilter] = React.useState("all");

  if (loading) return <Loading label="Building your timeline…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const allItems = data || [];

  if (!allItems.length) return (
    <EmptyState
      title="Your story starts here"
      sub="Add items to your collections and they'll appear here — your hoard, ordered by time."
    />
  );

  const types = [...new Set(allItems.map(i => i.type).filter(Boolean))].sort();
  const items = typeFilter === "all" ? allItems : allItems.filter(i => i.type === typeFilter);

  const groups = [];
  const seen = {};
  items.forEach(it => {
    const label = monthLabel(it.created_at);
    if (!seen[label]) { seen[label] = { label, items: [] }; groups.push(seen[label]); }
    seen[label].items.push(it);
  });

  return (
    <div className="view-enter">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div className="eyebrow">{items.length} item{items.length !== 1 ? 's' : ''} collected</div>
        {types.length > 1 && (
          <div className="seg">
            <button className={typeFilter === "all" ? "on" : ""} onClick={() => setTypeFilter("all")}>All</button>
            {types.map(t => (
              <button key={t} className={typeFilter === t ? "on" : ""} onClick={() => setTypeFilter(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}s
              </button>
            ))}
          </div>
        )}
      </div>
      {groups.length === 0
        ? <EmptyState title={`No ${typeFilter}s in your timeline`} sub="Try a different type filter." />
        : groups.map(g => (
          <div key={g.label} className="tl-month-group">
            <div className="tl-month-head">
              <span className="eyebrow">{g.label}</span>
              <span className="tl-month-count">{g.items.length} added</span>
            </div>
            <div className="items-grid">
              {g.items.map(it => (
                <div className={"item-cell" + (it.owned === false ? " missing" : "")} key={it.id} onClick={() => ctx.openItem(it)}>
                  <Cover item={it} h={200} ghost={it.owned === false} />
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
