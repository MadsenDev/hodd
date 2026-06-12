// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, Loading, ErrorState, EmptyState } from '../components';
import { useSearchIndex } from '../hooks';
import { getFavorites } from '../api';

export function Favorites({ ctx }) {
  const index = useSearchIndex();
  const [favIds, setFavIds] = React.useState(null);

  React.useEffect(() => {
    getFavorites().then(setFavIds).catch(() => setFavIds([]));
  }, []);

  if (index.loading || favIds === null) return <Loading label="Loading favorites…" />;
  if (index.error) return <ErrorState error={index.error} onRetry={index.refetch} />;

  const items = (index.data || []).filter(i => favIds.includes(i.id));

  if (!items.length) return (
    <EmptyState
      title="No favorites yet"
      sub="Open any item you own and tap 'Mark favorite' — your most treasured pieces show up here."
    />
  );

  const groups = {};
  items.forEach(it => {
    const key = it.coll || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(it);
  });

  return (
    <div className="view-enter">
      <div className="section-head" style={{ marginBottom: 4 }}>
        <div className="eyebrow">{items.length} favorite{items.length !== 1 ? "s" : ""}</div>
      </div>
      {Object.entries(groups).map(([collName, collItems]) => (
        <div key={collName} style={{ marginBottom: 36 }}>
          <div className="eyebrow" style={{ marginBottom: 12, color: "var(--mute)" }}>{collName}</div>
          <div className="items-grid">
            {collItems.map(it => (
              <div className="item-cell" key={it.id} onClick={() => ctx.openItem(it)}>
                <Cover item={it} h={200} />
                <div className="nm">{it.title}</div>
                <div className="yr">
                  {it.platform || it.author || it.artist || it.sub || ""}
                  {it.year ? ` · ${it.year}` : ""}
                </div>
                <div className="badge badge-owned"><I.heartFill size={12} /> Favorite</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
