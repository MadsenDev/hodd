// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useCollection } from '../hooks';
import { deleteCollection } from '../api';

export function CollectionDetail({ collId, ctx }) {
  const { data, loading, error, refetch } = useCollection(collId);
  const [filter, setFilter] = React.useState("all");
  const [sort, setSort] = React.useState("default");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

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
        {data.user && !confirmDelete && (
          <button className="btn" style={{ color: "var(--danger, #cf6b5a)" }} onClick={() => setConfirmDelete(true)}>
            <I.trash size={15} /> Delete
          </button>
        )}
        {data.user && confirmDelete && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--mute)" }}>Delete this collection?</span>
            <button className="btn" style={{ color: "var(--danger, #cf6b5a)" }} onClick={() => { deleteCollection(collId); ctx.back(); }}>
              Yes, delete
            </button>
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
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
