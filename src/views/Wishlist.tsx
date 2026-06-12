// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, Loading, ErrorState, EmptyState } from '../components';
import { useSearchIndex } from '../hooks';

export function Wishlist({ ctx }) {
  const index = useSearchIndex();
  const [sort, setSort] = React.useState("collection");

  if (index.loading) return <Loading label="Building your wishlist…" />;
  if (index.error) return <ErrorState error={index.error} onRetry={index.refetch} />;

  const items = (index.data || []).filter(i => i.owned === false);

  if (!items.length) return (
    <EmptyState
      title="Nothing missing yet"
      sub="Items you mark as not owned appear here — your hunt list. Browse your collections and track what you're still after."
    />
  );

  const sorted = [...items].sort((a, b) => {
    if (sort === "title") return (a.title || "").localeCompare(b.title || "");
    if (sort === "year")  return (a.year || 9999) - (b.year || 9999);
    return (a.coll || "").localeCompare(b.coll || "") || (a.title || "").localeCompare(b.title || "");
  });

  const groups = {};
  sorted.forEach(it => {
    const key = sort === "collection" ? (it.coll || "Other") : "All items";
    if (!groups[key]) groups[key] = [];
    groups[key].push(it);
  });

  return (
    <div className="view-enter">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div className="eyebrow">{items.length} item{items.length !== 1 ? "s" : ""} still to hunt down</div>
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
