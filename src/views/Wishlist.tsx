// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, Loading, ErrorState, EmptyState } from '../components';
import { useSearchIndex } from '../hooks';

export function Wishlist({ ctx }) {
  const index = useSearchIndex();

  if (index.loading) return <Loading label="Building your wishlist…" />;
  if (index.error) return <ErrorState error={index.error} onRetry={index.refetch} />;

  const items = (index.data || []).filter(i => i.owned === false);

  if (!items.length) return (
    <EmptyState
      title="Nothing missing yet"
      sub="Items you mark as not owned appear here — your hunt list. Browse your collections and track what you're still after."
    />
  );

  // Group by collection name
  const groups = {};
  items.forEach(it => {
    const key = it.coll || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(it);
  });

  return (
    <div className="view-enter">
      <div className="section-head" style={{ marginBottom: 4 }}>
        <div className="eyebrow">{items.length} item{items.length !== 1 ? "s" : ""} still to hunt down</div>
      </div>
      {Object.entries(groups).map(([collName, collItems]) => (
        <div key={collName} style={{ marginBottom: 36 }}>
          <div className="eyebrow" style={{ marginBottom: 12, color: "var(--mute)" }}>{collName}</div>
          <div className="items-grid">
            {collItems.map(it => (
              <div className="item-cell missing" key={it.id} onClick={() => ctx.openItem(it)}>
                <Cover item={it} h={200} ghost />
                <div className="nm">{it.title}</div>
                <div className="yr">
                  {it.platform || it.author || it.artist || it.sub || ""}
                  {it.year ? ` · ${it.year}` : ""}
                </div>
                <div className="badge badge-missing"><I.plus size={12} stroke={2} /> Missing</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
