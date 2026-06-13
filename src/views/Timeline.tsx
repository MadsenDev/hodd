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

function itemYear(dateStr) {
  if (!dateStr) return null;
  try { return new Date(dateStr).getFullYear(); } catch (_) { return null; }
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

  // Build year→month groups (descending year, months in original order)
  const yearMap = {};
  items.forEach(it => {
    const year = itemYear(it.created_at) || 'Unknown';
    const label = monthLabel(it.created_at);
    if (!yearMap[year]) yearMap[year] = { year, monthMap: {} };
    if (!yearMap[year].monthMap[label]) yearMap[year].monthMap[label] = { label, items: [] };
    yearMap[year].monthMap[label].items.push(it);
  });

  const yearGroups = Object.entries(yearMap)
    .sort((a, b) => (b[0] === 'Unknown' ? -1 : a[0] === 'Unknown' ? 1 : Number(b[0]) - Number(a[0])))
    .map(([year, { monthMap }]) => {
      const months = Object.values(monthMap);
      const yearItems = months.flatMap(m => m.items);
      const totalYear = yearItems.length;
      const typeCounts = {};
      yearItems.forEach(i => { if (i.type) typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });
      const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      return { year, totalYear, topType, months };
    });

  // Compute average monthly count for busy-month detection
  const allMonths = yearGroups.flatMap(yg => yg.months);
  const avgMonthCount = allMonths.length ? allMonths.reduce((s, m) => s + m.items.length, 0) / allMonths.length : 0;

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
      {yearGroups.length === 0
        ? <EmptyState title={`No ${typeFilter}s in your timeline`} sub="Try a different type filter." />
        : yearGroups.map(yg => (
          <div key={yg.year}>
            {/* Year divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '32px 0 16px', borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)' }}>{yg.year}</span>
              <span style={{ fontSize: 12, color: 'var(--mute)' }}>{yg.totalYear} item{yg.totalYear !== 1 ? 's' : ''}</span>
              {yg.topType && (
                <span style={{ fontSize: 11, color: 'var(--mute)', background: 'var(--panel)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '2px 8px', textTransform: 'capitalize' }}>
                  mostly {yg.topType}s
                </span>
              )}
            </div>
            {yg.months.map(g => {
              const isBusy = avgMonthCount > 0 && g.items.length > avgMonthCount * 2;
              return (
                <div key={g.label} className="tl-month-group">
                  <div className="tl-month-head">
                    <span className="eyebrow">{g.label}</span>
                    <span className="tl-month-count">{g.items.length} added</span>
                    {isBusy && (
                      <span style={{ fontSize: 11, color: '#C9A24C', marginLeft: 8, fontWeight: 600 }}>⬆ Busy month</span>
                    )}
                  </div>
                  <div className="items-grid">
                    {g.items.map(it => (
                      <div className={"item-cell" + (it.owned === false ? " missing" : "")} key={it.id} onClick={() => ctx.openItem(it)}>
                        <Cover item={it} h={200} ghost={it.owned === false} />
                        <div className="nm">{it.title}</div>
                        <div className="yr">
                          {it.sub || it.collName || ''}
                          {it.year ? ` · ${it.year}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
