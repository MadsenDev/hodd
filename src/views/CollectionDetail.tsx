// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useCollection } from '../hooks';

export function CollectionDetail({ collId, ctx }) {
  const { data, loading, error, refetch } = useCollection(collId);
  const [filter, setFilter] = React.useState("all");
  const [sort, setSort] = React.useState("default");

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="Collection not found" />;

  const { name, sub, accent, owned, missing, pct, type, items } = data;
  const filtered = items.filter(i => filter === "all" ? true : filter === "owned" ? i.owned : !i.owned);
  const shown = [...filtered].sort((a, b) => {
    if (sort === "title") return (a.title || "").localeCompare(b.title || "");
    if (sort === "year")  return (a.year || 9999) - (b.year || 9999);
    if (sort === "status") return (b.owned ? 1 : 0) - (a.owned ? 1 : 0);
    return 0;
  });
  return (
    <div className="view-enter">
      <div className="back" onClick={ctx.back}><I.arrowLeft size={16} /> Back</div>
      <div className="detail-head">
        <CompletionRing pct={pct} size={92} stroke={7} color={accent} fontSize={20} />
        <div className="titles">
          <div className="eyebrow" style={{ color: accent }}>{sub}</div>
          <h1>{name}</h1>
          <div className="sub">{owned} owned · {missing} missing · {pct}% complete</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn solid add-item-btn" onClick={() => ctx.addToCollection(data)}><I.plus size={16} stroke={2} /> Add item</button>
        <div className="seg">
          {["all", "owned", "missing"].map(f => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <div className="seg">
          {[["default", "Default"], ["title", "A–Z"], ["year", "Year"], ["status", "Status"]].map(([v, l]) => (
            <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>
          ))}
        </div>
      </div>
      {items.length === 0
        ? <EmptyState title={`${name} is empty`} sub="Add your first item to start the collection." />
        : shown.length === 0
        ? <EmptyState title={`No ${filter} items`} sub="Try a different filter." />
        : <div className="items-grid">
            {shown.map(it => (
              <div className={"item-cell" + (it.owned ? "" : " missing")} key={it.id} onClick={() => ctx.openItem({ ...it, type }, { name, items, type })}>
                <Cover item={{ ...it, type }} h={210} ghost={!it.owned} />
                <div className="nm">{it.title}</div>
                <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
                {it.owned
                  ? <div className="badge badge-owned"><I.check size={12} stroke={2.2} /> Owned{it.format && it.format !== "—" ? ` · ${it.format}` : ""}</div>
                  : <div className="badge badge-missing"><I.plus size={12} stroke={2} /> Missing</div>}
              </div>
            ))}
          </div>}
    </div>
  );
}
