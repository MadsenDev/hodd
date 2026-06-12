// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useCollection } from '../hooks';

export function CollectionDetail({ collId, ctx }) {
  const { data, loading, error, refetch } = useCollection(collId);
  const [filter, setFilter] = React.useState("all");

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="Collection not found" />;

  const { name, sub, accent, owned, missing, pct, type, items } = data;
  const shown = items.filter(i => filter === "all" ? true : filter === "owned" ? i.owned : !i.owned);
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
      </div>
      {items.length === 0
        ? <EmptyState title={`${name} is empty`} sub="Add your first item to start the collection." />
        : shown.length === 0
        ? <EmptyState title={`No ${filter} items`} sub="Try a different filter." />
        : <div className="items-grid">
            {shown.map(it => (
              <div className={"item-cell" + (it.owned ? "" : " missing")} key={it.id}>
                <Cover item={{ ...it, type }} h={210} ghost={!it.owned} onClick={() => ctx.openItem({ ...it, type }, { name, items, type })} />
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
