// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, Loading, ErrorState, EmptyState } from '../components';
import { useSearchIndex } from '../hooks';
import { getFavorites } from '../api';

export function Favorites({ ctx }) {
  const index = useSearchIndex();
  const [favIds, setFavIds] = React.useState(null);
  const [sort, setSort] = React.useState("collection");

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

  const sorted = [...items].sort((a, b) => {
    if (sort === "title") return (a.title || "").localeCompare(b.title || "");
    if (sort === "year")  return (a.year || 9999) - (b.year || 9999);
    return (a.coll || "").localeCompare(b.coll || "") || (a.title || "").localeCompare(b.title || "");
  });

  const groups = {};
  sorted.forEach(it => {
    const key = sort === "collection" ? (it.coll || "Other") : "All favorites";
    if (!groups[key]) groups[key] = [];
    groups[key].push(it);
  });

  return (
    <div className="view-enter">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div className="eyebrow">{items.length} favorite{items.length !== 1 ? "s" : ""}</div>
        <div className="seg">
          {[["collection", "By collection"], ["title", "A–Z"], ["year", "Year"]].map(([v, l]) => (
            <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>
          ))}
        </div>
      </div>
      {Object.entries(groups).map(([groupName, groupItems]) => (
        <div key={groupName} style={{ marginBottom: 36 }}>
          {sort === "collection" && (
            <div className="eyebrow" style={{ marginBottom: 12, color: "var(--mute)" }}>
              {groupName} <span style={{ opacity: 0.55, fontSize: 10 }}>· {groupItems.length}</span>
            </div>
          )}
          <div className="items-grid">
            {groupItems.map(it => (
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
