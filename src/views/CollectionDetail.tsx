import React from 'react';
import { I } from '../icons';
import { Cover, CompletionRing, Loading, ErrorState, EmptyState, StarRating } from '../components';
import { useCollection } from '../hooks';
import { deleteCollection, saveCatalog, saveHolding, setItemOwned, removeItem, fetchSuggestions } from '../api';

const CONDITIONS = ["Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"];
const STATUSES: [string, string][] = [["owned", "Owned"], ["wishlist", "Wishlist"], ["borrowed", "Borrowed"], ["subscription", "Subscription"]];

interface CollectionDetailProps {
  collId: string;
  ctx: {
    back: () => void;
    addToCollection: (data: any, item?: any) => void;
    openItem: (item: any, collection: any) => void;
  };
}

export function CollectionDetail({ collId, ctx }: CollectionDetailProps) {
  const { data, loading, error, refetch } = useCollection(collId);
  const [filter, setFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sort, setSort] = React.useState<string>("default");
  const [search, setSearch] = React.useState<string>("");
  const [confirmDelete, setConfirmDelete] = React.useState<boolean>(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = React.useState<boolean>(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [activeAction, setActiveAction] = React.useState<string | null>(null); // 'series'|'condition'|'status'|'remove'
  const [seriesValue, setSeriesValue] = React.useState<string>("");
  const [conditionValue, setConditionValue] = React.useState<string>(CONDITIONS[0]);
  const [statusValue, setStatusValue] = React.useState<string>("owned");

  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState<boolean>(false);

  // Fix 3: Memoize ownedCount so it can be used as a stable useEffect dependency
  const ownedCount = React.useMemo(
    () => (data?.items || []).filter((i: any) => i.owned !== false).length,
    [data?.items]
  );

  // Fetch suggestions in background once collection data is loaded
  React.useEffect(() => {
    if (!data || !data.type) return;
    const owned = (data.items || []).filter((i: any) => i.owned !== false);
    if (!owned.length) return;
    let cancelled = false;
    setSuggestionsLoading(true);
    fetchSuggestions(collId, data.type, owned.map((i: any) => ({ title: i.title, series: i.series, sub: i.sub }))).then((results: any[]) => {
      if (!cancelled) {
        const ownedTitles = new Set((data.items || []).map((i: any) => (i.title || '').toLowerCase()));
        setSuggestions((results || []).filter((s: any) => !ownedTitles.has((s.title || '').toLowerCase())));
        setSuggestionsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [collId, data?.type, ownedCount]);

  // Remove newly-added items from suggestions list
  React.useEffect(() => {
    if (!data?.items?.length || !suggestions.length) return;
    const ownedTitles = new Set((data.items || []).map((i: any) => (i.title || '').toLowerCase()));
    setSuggestions((prev: any[]) => prev.filter((s: any) => !ownedTitles.has((s.title || '').toLowerCase())));
  }, [data?.items]);

  const hasSearch = data && data.items && data.items.length > 12;
  React.useEffect(() => {
    if (!hasSearch) return;
    function onKey(e: KeyboardEvent) {
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
    function onKey(e: KeyboardEvent) {
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

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll(ids: string[]) {
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
      const item = data.items.find((i: any) => i.id === id);
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
  const ownedItemCount = items.filter((i: any) => i.owned !== false).length;
  const missingCount = items.filter((i: any) => i.owned === false).length;

  // Fix 5: Memoize expensive filter/sort/progress calculations
  const progressLabel = React.useMemo(
    () => type === "game" ? "Played" : type === "book" ? "Read" : type === "movie" ? "Watched" : null,
    [type]
  );
  const progressField = React.useMemo(
    () => type === "game" ? "completed" : (type === "movie" || type === "book") ? "watched" : null,
    [type]
  );
  const progressDoneLabel = React.useMemo(
    () => type === "game" ? "Completed" : type === "book" ? "Read" : type === "movie" ? "Watched" : null,
    [type]
  );
  const progressNotDoneLabel = React.useMemo(
    () => type === "game" ? "Not completed" : type === "book" ? "Unread" : type === "movie" ? "Unwatched" : null,
    [type]
  );
  const progressCount = React.useMemo(
    () => progressField ? items.filter((i: any) => i.owned !== false && i[progressField]).length : 0,
    [progressField, items]
  );
  const progressNotDoneCount = React.useMemo(
    () => progressField ? items.filter((i: any) => i.owned !== false && !i[progressField]).length : 0,
    [progressField, items]
  );

  const sq = search.trim().toLowerCase();

  // Fix 4: Truncate long search strings in EmptyState title
  const displaySearch = search.length > 60 ? search.slice(0, 60) + '…' : search;

  const { filtered, shown } = React.useMemo(() => {
    const filtered = items.filter((i: any) => {
      // Fix 2: Normalize i.owned — undefined and true both mean owned
      const isOwned = i.owned !== false;
      if (filter !== "all" && (filter === "owned" ? !isOwned : isOwned)) return false;
      if (progressField && statusFilter !== "all") {
        if (i.owned === false) return false;
        if (statusFilter === "done" && !i[progressField]) return false;
        if (statusFilter === "notdone" && i[progressField]) return false;
      }
      if (sq && !(i.title || "").toLowerCase().includes(sq) && !(i.sub || "").toLowerCase().includes(sq)) return false;
      return true;
    });
    const shown = [...filtered].sort((a: any, b: any) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      if (sort === "year")  return (a.year || 9999) - (b.year || 9999);
      if (sort === "status") {
        const aOwned = a.owned !== false ? 1 : 0;
        const bOwned = b.owned !== false ? 1 : 0;
        return bOwned - aOwned;
      }
      if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
      if (sort === "progress") {
        const aP = type === "game" ? (a.completed ? 1 : 0) : (a.watched ? 1 : 0);
        const bP = type === "game" ? (b.completed ? 1 : 0) : (b.watched ? 1 : 0);
        return bP - aP;
      }
      return 0;
    });
    return { filtered, shown };
  }, [items, filter, statusFilter, sort, sq, progressField, type]);

  const shownIds = shown.map((i: any) => i.id);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id: string) => selected.has(id));

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
        <button className="btn" title="Print / Save PDF" onClick={() => (window as any).hoddDesktop?.printToPdf?.(name)}>
          <I.download size={15} /> Print
        </button>
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
      </div>
      <div className="detail-toolbar">
        <div className="seg">
          {([["all", "All", items.length], ["owned", "Owned", ownedItemCount], ["missing", "Missing", missingCount]] as [string, string, number][]).map(([v, l, n]) => (
            <button key={v} className={filter === v ? "on" : ""} onClick={() => setFilter(v)}>
              {l} <span style={{ opacity: 0.55, fontSize: 11, fontWeight: 500 }}>{n}</span>
            </button>
          ))}
        </div>
        {progressField && (
          <div className="seg">
            {([["all", "Any status", null], ["done", progressDoneLabel, progressCount], ["notdone", progressNotDoneLabel, progressNotDoneCount]] as [string, string | null, number | null][]).map(([v, l, n]) => (
              <button key={v} className={statusFilter === v ? "on" : ""} onClick={() => setStatusFilter(v)}>
                {l}{n != null ? <span style={{ opacity: 0.55, fontSize: 11, fontWeight: 500 }}> {n}</span> : null}
              </button>
            ))}
          </div>
        )}
        <div className="seg">
          {([["default", "Default"], ["title", "A–Z"], ["year", "Year"], ["status", "Status"], ...(progressLabel ? [["progress", progressLabel]] : []), ["rating", "Rating"]] as [string, string][]).map(([v, l]) => (
            <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
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
      {items.length === 0 && suggestions.length === 0
        ? <EmptyState title={`${name} is empty`} sub="Add your first item to start the collection." />
        : shown.length === 0 && !sq && filter === "all"
        ? null
        : shown.length === 0
        ? <EmptyState title={sq ? `No matches for "${displaySearch}"` : `No ${filter} items`} sub={sq ? "Try a different search term." : "Try a different filter."} />
        : <div className="items-grid">
            {shown.map((it: any) => (
              <div
                className={"item-cell" + (it.owned !== false ? "" : " missing")}
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
                <Cover item={{ ...it, type }} h={210} ghost={it.owned === false} />
                <div className="nm">{it.title}</div>
                <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
                {it.rating != null && (
                  <div style={{ marginTop: 3 }}>
                    <StarRating value={it.rating} size={10} readonly />
                  </div>
                )}
                {it.owned !== false
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

      {filter === "all" && !sq && (suggestionsLoading || suggestions.length > 0) && (
        <div className="suggested-section">
          <div className="suggested-head">
            <span className="eyebrow">Suggested</span>
            <span className="suggested-desc">{suggestionsLoading ? "Finding related items…" : "Related items you haven't tracked yet"}</span>
          </div>
          {suggestionsLoading
            ? <div className="suggested-loading"><span className="spinner-dot" /><span className="spinner-dot" /><span className="spinner-dot" /></div>
            : <div className="items-grid suggested-grid">
                {suggestions.map((it: any) => (
                  <div
                    className="item-cell missing suggested-item"
                    key={it.id}
                    onClick={() => ctx.addToCollection(data, it)}
                  >
                    <Cover item={{ ...it, type }} h={210} />
                    <div className="nm">{it.title}</div>
                    <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
                    <div className="badge badge-suggested"><I.plus size={12} stroke={2} /> Add to collection</div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

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
