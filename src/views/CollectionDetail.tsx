// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, CompletionRing, Loading, ErrorState, EmptyState } from '../components';
import { useCollection } from '../hooks';
import { deleteCollection, saveCatalog, saveHolding, setItemOwned, removeItem } from '../api';

const CONDITIONS = ["Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"];
const STATUSES = [["owned", "Owned"], ["wishlist", "Wishlist"], ["borrowed", "Borrowed"], ["subscription", "Subscription"]];

export function CollectionDetail({ collId, ctx }) {
  const { data, loading, error, refetch } = useCollection(collId);
  const [filter, setFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sort, setSort] = React.useState("default");
  const [search, setSearch] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const searchRef = React.useRef(null);

  // Multi-select state
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set());
  const [activeAction, setActiveAction] = React.useState(null); // 'series'|'condition'|'status'|'remove'
  const [seriesValue, setSeriesValue] = React.useState("");
  const [conditionValue, setConditionValue] = React.useState(CONDITIONS[0]);
  const [statusValue, setStatusValue] = React.useState("owned");

  const hasSearch = data && data.items && data.items.length > 12;
  React.useEffect(() => {
    if (!hasSearch) return;
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current && searchRef.current.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSearch]);

  // Escape key exits select mode
  React.useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (activeAction) { setActiveAction(null); return; }
        if (selectMode) { exitSelectMode(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode, activeAction]);

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setActiveAction(null);
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll(ids) {
    setSelected(new Set(ids));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function applySetSeries() {
    const val = seriesValue.trim();
    for (const id of selected) {
      saveCatalog(id, { series: val });
    }
    setActiveAction(null);
    refetch();
    exitSelectMode();
  }

  async function applySetCondition() {
    // Only apply to owned items
    for (const id of selected) {
      const item = data.items.find(i => i.id === id);
      if (item && item.owned !== false) {
        saveHolding(id, { condition: conditionValue });
      }
    }
    setActiveAction(null);
    refetch();
    exitSelectMode();
  }

  async function applySetStatus() {
    for (const id of selected) {
      if (statusValue === "wishlist") {
        setItemOwned(id, false);
      } else {
        setItemOwned(id, true);
        saveHolding(id, { ownership: statusValue });
      }
    }
    setActiveAction(null);
    refetch();
    exitSelectMode();
  }

  async function applyRemove() {
    for (const id of selected) {
      removeItem(id);
    }
    setActiveAction(null);
    refetch();
    exitSelectMode();
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="Collection not found" />;

  const { name, sub, accent, owned, missing, pct, type, items } = data;
  const ownedCount = items.filter(i => i.owned !== false).length;
  const missingCount = items.filter(i => i.owned === false).length;

  const progressLabel = type === "game" ? "Played" : type === "book" ? "Read" : type === "movie" ? "Watched" : null;
  const progressField = type === "game" ? "completed" : (type === "movie" || type === "book") ? "watched" : null;
  const progressDoneLabel = type === "game" ? "Completed" : type === "book" ? "Read" : type === "movie" ? "Watched" : null;
  const progressNotDoneLabel = type === "game" ? "Not completed" : type === "book" ? "Unread" : type === "movie" ? "Unwatched" : null;
  const progressCount = progressField ? items.filter(i => i.owned !== false && i[progressField]).length : 0;
  const progressNotDoneCount = progressField ? items.filter(i => i.owned !== false && !i[progressField]).length : 0;

  const sq = search.trim().toLowerCase();
  const filtered = items.filter(i => {
    if (filter !== "all" && (filter === "owned" ? !i.owned : i.owned)) return false;
    if (progressField && statusFilter !== "all") {
      if (i.owned === false) return false;
      if (statusFilter === "done" && !i[progressField]) return false;
      if (statusFilter === "notdone" && i[progressField]) return false;
    }
    if (sq && !(i.title || "").toLowerCase().includes(sq) && !(i.sub || "").toLowerCase().includes(sq)) return false;
    return true;
  });
  const shown = [...filtered].sort((a, b) => {
    if (sort === "title") return (a.title || "").localeCompare(b.title || "");
    if (sort === "year")  return (a.year || 9999) - (b.year || 9999);
    if (sort === "status") return (b.owned ? 1 : 0) - (a.owned ? 1 : 0);
    if (sort === "progress") {
      const aP = type === "game" ? (a.completed ? 1 : 0) : (a.watched ? 1 : 0);
      const bP = type === "game" ? (b.completed ? 1 : 0) : (b.watched ? 1 : 0);
      return bP - aP;
    }
    return 0;
  });

  const shownIds = shown.map(i => i.id);
  const allShownSelected = shownIds.length > 0 && shownIds.every(id => selected.has(id));

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
          {[["all", "All", items.length], ["owned", "Owned", ownedCount], ["missing", "Missing", missingCount]].map(([v, l, n]) => (
            <button key={v} className={filter === v ? "on" : ""} onClick={() => setFilter(v)}>
              {l} <span style={{ opacity: 0.55, fontSize: 11, fontWeight: 500 }}>{n}</span>
            </button>
          ))}
        </div>
        {progressField && (
          <div className="seg">
            {[["all", "Any status"], ["done", progressDoneLabel, progressCount], ["notdone", progressNotDoneLabel, progressNotDoneCount]].map(([v, l, n]) => (
              <button key={v} className={statusFilter === v ? "on" : ""} onClick={() => setStatusFilter(v)}>
                {l}{n != null ? <span style={{ opacity: 0.55, fontSize: 11, fontWeight: 500 }}> {n}</span> : null}
              </button>
            ))}
          </div>
        )}
        <div className="seg">
          {[["default", "Default"], ["title", "A–Z"], ["year", "Year"], ["status", "Status"], ...(progressLabel ? [["progress", progressLabel]] : [])].map(([v, l]) => (
            <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>
          ))}
        </div>
        {/* Select mode toggle */}
        <button
          className={"btn" + (selectMode ? " solid" : "")}
          style={selectMode ? { background: "var(--accent)", color: "#fff" } : {}}
          onClick={() => { if (selectMode) exitSelectMode(); else setSelectMode(true); }}
        >
          {selectMode ? "Done" : "Select"}
        </button>
        {selectMode && (
          <button
            className="btn"
            onClick={() => allShownSelected ? deselectAll() : selectAll(shownIds)}
            style={{ fontSize: 12 }}
          >
            {allShownSelected ? "Deselect all" : "Select all"}
          </button>
        )}
        {hasSearch && (
          <div className="coll-search">
            <I.search size={14} stroke={1.8} />
            <input ref={searchRef} placeholder="Filter items…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")}><I.close size={13} /></button>}
          </div>
        )}
      </div>
      {items.length === 0
        ? <EmptyState title={`${name} is empty`} sub="Add your first item to start the collection." />
        : shown.length === 0
        ? <EmptyState title={sq ? `No matches for "${search}"` : `No ${filter} items`} sub={sq ? "Try a different search term." : "Try a different filter."} />
        : <div className="items-grid">
            {shown.map(it => (
              <div
                className={"item-cell" + (it.owned ? "" : " missing")}
                key={it.id}
                style={selectMode && selected.has(it.id) ? { outline: "2px solid var(--accent)", borderRadius: 8, position: "relative" } : selectMode ? { position: "relative", cursor: "pointer" } : {}}
                onClick={() => {
                  if (selectMode) { toggleSelect(it.id); return; }
                  ctx.openItem({ ...it, type }, { name, items, type });
                }}
              >
                {selectMode && (
                  <div style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    zIndex: 10,
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: selected.has(it.id) ? "2px solid var(--accent)" : "2px solid rgba(255,255,255,0.6)",
                    background: selected.has(it.id) ? "var(--accent)" : "rgba(0,0,0,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}>
                    {selected.has(it.id) && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 5.5L4.5 8L9 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                )}
                <Cover item={{ ...it, type }} h={210} ghost={!it.owned} />
                <div className="nm">{it.title}</div>
                <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
                {it.owned
                  ? <div className="badge badge-owned"><I.check size={12} stroke={2.2} /> {
                      (type === "game" && it.completed) ? "Played" :
                      (type === "movie" && it.watched) ? "Watched" :
                      (type === "book" && it.watched) ? "Read" :
                      "Owned" + (it.format && it.format !== "—" ? ` · ${it.format}` : "")
                    }</div>
                  : <div className="badge badge-missing"><I.plus size={12} stroke={2} /> Missing</div>}
              </div>
            ))}
          </div>}

      {/* Floating action bar */}
      {selectMode && selected.size > 0 && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "10px 16px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,.18)",
          zIndex: 100,
          flexDirection: "column",
          minWidth: 420,
        }}>
          {/* Action popover */}
          {activeAction === "series" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--mute)", whiteSpace: "nowrap" }}>Set series:</span>
              <input
                autoFocus
                value={seriesValue}
                onChange={e => setSeriesValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") applySetSeries(); if (e.key === "Escape") setActiveAction(null); }}
                placeholder="Series name…"
                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
              />
              <button className="btn solid" style={{ padding: "5px 12px", fontSize: 13 }} onClick={applySetSeries}>Apply</button>
              <button className="btn" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setActiveAction(null)}>Cancel</button>
            </div>
          )}
          {activeAction === "condition" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--mute)", whiteSpace: "nowrap" }}>Set condition:</span>
              <select
                value={conditionValue}
                onChange={e => setConditionValue(e.target.value)}
                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
              >
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="btn solid" style={{ padding: "5px 12px", fontSize: 13 }} onClick={applySetCondition}>Apply</button>
              <button className="btn" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setActiveAction(null)}>Cancel</button>
            </div>
          )}
          {activeAction === "status" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--mute)", whiteSpace: "nowrap" }}>Set status:</span>
              <select
                value={statusValue}
                onChange={e => setStatusValue(e.target.value)}
                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
              >
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button className="btn solid" style={{ padding: "5px 12px", fontSize: 13 }} onClick={applySetStatus}>Apply</button>
              <button className="btn" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setActiveAction(null)}>Cancel</button>
            </div>
          )}
          {activeAction === "remove" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--mute)" }}>Remove {selected.size} item{selected.size !== 1 ? "s" : ""}?</span>
              <div style={{ flex: 1 }} />
              <button className="btn solid" style={{ padding: "5px 12px", fontSize: 13, background: "var(--danger, #cf6b5a)", border: "none" }} onClick={applyRemove}>Remove</button>
              <button className="btn" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setActiveAction(null)}>Cancel</button>
            </div>
          )}
          {/* Main action row */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>
              {selected.size} item{selected.size !== 1 ? "s" : ""} selected
            </span>
            <div style={{ flex: 1 }} />
            <button className="btn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => { setActiveAction(activeAction === "series" ? null : "series"); setSeriesValue(""); }}>
              Set series
            </button>
            <button className="btn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setActiveAction(activeAction === "condition" ? null : "condition")}>
              Set condition
            </button>
            <button className="btn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setActiveAction(activeAction === "status" ? null : "status")}>
              Set owned/wishlist
            </button>
            <button className="btn" style={{ fontSize: 12, padding: "5px 10px", color: "var(--danger, #cf6b5a)" }} onClick={() => setActiveAction(activeAction === "remove" ? null : "remove")}>
              Remove
            </button>
            <button className="btn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={exitSelectMode}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
