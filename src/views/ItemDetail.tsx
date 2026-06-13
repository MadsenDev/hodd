// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, FluidCover, useNarrow } from '../components';
import { useCollection, useStory } from '../hooks';
import { saveCatalog, saveStory, saveHolding, removeHolding, removeItem, setItemOwned, toggleFavorite, OllamaClient } from '../api';
import { useFavorite } from '../hooks';
import { ItemEditForm, SUBLABELS } from '../forms';

function fallbackStory(item) {
  return [
    `A treasured part of the ${item.to || item.sub || "collection"}. Every item in the hoard carries its own provenance — when it arrived, where it came from, and why it earned a place on the shelf.`,
    "Add your own notes, acquisition details, and memories to give this entry its full story.",
  ];
}

export function ItemDetail({ item: initialItem, collection, ctx, ollamaModel }) {
  const narrow = useNarrow();
  const [item, setItem] = React.useState(initialItem);
  const [editing, setEditing] = React.useState(false);
  const [storyOv, setStoryOv] = React.useState(null);
  const [generatingStory, setGeneratingStory] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [lightboxImg, setLightboxImg] = React.useState(null);
  const favState = useFavorite(item.id);
  const isFav = !!favState.data;
  const [favOptimistic, setFavOptimistic] = React.useState(null);
  const fav = favOptimistic !== null ? favOptimistic : isFav;
  React.useEffect(() => { setItem(initialItem); setEditing(false); setStoryOv(null); setConfirmDelete(false); setFavOptimistic(null); }, [initialItem]);
  React.useEffect(() => {
    function onKey(e) {
      if (editing || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft'  && prevItem) ctx.openItem({ ...prevItem, type: relType }, collection);
      if (e.key === 'ArrowRight' && nextItem) ctx.openItem({ ...nextItem, type: relType }, collection);
      if (e.key === 'f' && item.owned !== false) { toggleFavorite(item.id, fav); setFavOptimistic(!fav); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const isUserItem = item.id && String(item.id).startsWith("i-");
  const fallback = useCollection(collection ? null : isUserItem ? null : (item.collectionId || "featured"));
  const storyState = useStory(item.id);
  const type = item.type || "game";
  const story = storyOv || storyState.data || fallbackStory(item);
  const pool = (collection && collection.items) ? collection.items : (fallback.data ? fallback.data.items : []);
  const others = pool.filter(i => i.id !== item.id);
  const series = item.series;
  const sub = item.sub;
  const bySeries = series ? others.filter(i => i.series === series) : [];
  const bySub = sub ? others.filter(i => i.sub === sub && i.series !== series) : [];
  const byAdjacent = others.filter(i => !bySeries.includes(i) && !bySub.includes(i));
  const related = [...bySeries, ...bySub, ...byAdjacent].slice(0, 5);
  const relType = collection ? collection.type : type;
  const poolIdx = pool.findIndex(i => i.id === item.id);
  const prevItem = poolIdx > 0 ? pool[poolIdx - 1] : null;
  const nextItem = poolIdx >= 0 && poolIdx < pool.length - 1 ? pool[poolIdx + 1] : null;
  const owned = item.owned !== false;
  const medium = (item.format && item.format !== "—" && item.format !== "Owned") ? item.format : null;
  const subLabel = SUBLABELS[type] || "Detail";
  const facts = [
    ["Status", owned ? "Owned" : "Missing"],
    owned && ["Format", medium],
    ["Year", item.year],
    [subLabel, item.sub],
    ["Series", item.series],
    type === "game" && ["Region", item.region],
    owned && type === "game" && ["Completeness", item.completeness],
    owned && type === "game" && typeof item.completed === "boolean" && ["Completed", item.completed ? "Yes" : "Not yet"],
    owned && type === "coin" && ["Grade", item.grade],
    owned && type === "book" && ["Edition", item.edition],
    owned && type === "vinyl" && ["Pressing", item.pressing],
    owned && type === "movie" && typeof item.watched === "boolean" && ["Watched", item.watched ? "Yes" : "Not yet"],
    owned && type === "book"  && typeof item.watched === "boolean" && ["Read",    item.watched ? "Yes" : "Not yet"],
    owned && ["Condition", item.condition],
    ...(owned && Array.isArray(item.custom) ? item.custom.map(x => [x.label, x.value]) : []),
    owned && ["Acquired", item.acquired],
  ].filter(f => f && f[1] != null && f[1] !== "");

  return (
    <div className="view-enter">
      <div className="back" style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <span onClick={ctx.back} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <I.arrowLeft size={16} /> Back
        </span>
        {(prevItem || nextItem) && (
          <span style={{ display: "inline-flex", gap: 2, marginLeft: 16 }}>
            <button
              onClick={() => prevItem && ctx.openItem({ ...prevItem, type: relType }, collection)}
              disabled={!prevItem}
              style={{ background: "none", border: "none", cursor: prevItem ? "pointer" : "default",
                color: prevItem ? "var(--text-2)" : "var(--mute)", padding: "2px 6px", borderRadius: 6,
                display: "flex", alignItems: "center" }}
              title="Previous item (←)">
              <I.arrowLeft size={15} />
            </button>
            <button
              onClick={() => nextItem && ctx.openItem({ ...nextItem, type: relType }, collection)}
              disabled={!nextItem}
              style={{ background: "none", border: "none", cursor: nextItem ? "pointer" : "default",
                color: nextItem ? "var(--text-2)" : "var(--mute)", padding: "2px 6px", borderRadius: 6,
                display: "flex", alignItems: "center" }}
              title="Next item (→)">
              <I.arrowRight size={15} />
            </button>
            {pool.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--mute)", marginLeft: 4, alignSelf: "center" }}>
                {poolIdx + 1} / {pool.length}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="item-detail">
        <div className="big-cover">
          <FluidCover item={item} ghost={item.owned === false} maxWidth={narrow ? 300 : 360} />
          {Array.isArray(item.gallery) && item.gallery.length > 0 && (
            <div className="gallery-strip">
              {item.gallery.map(filename => (
                <div key={filename}
                  className={"gallery-thumb" + (filename === item.cover_url ? " is-cover" : "")}
                  onClick={() => setLightboxImg(filename)}
                  title={filename === item.cover_url ? "Cover photo" : "View photo"}>
                  <img src={`hodd-img://${filename}`} alt="" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="eyebrow" style={{ color: "var(--gold-deep)" }}>{collection ? collection.name : (item.collName || item.sub || type)}</div>
          <h1>{item.title}</h1>
          <div className="byline">{item.sub || subLabel}</div>
          {!editing && (
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
              {item.owned === false
                ? <span className="badge badge-missing" style={{ fontSize: 12, padding: "8px 14px", border: "1px solid var(--border-soft)", borderRadius: 20 }}><I.plus size={13} stroke={2} /> Not in collection</span>
                : <span className="badge badge-owned" style={{ fontSize: 12, padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 20, background: "var(--accent-wash)" }}><I.check size={13} stroke={2.2} /> In your collection</span>}
              <button className="btn" onClick={() => setEditing(true)}><I.edit size={16} /> Edit details</button>
              {item.owned === false
                ? <button className="btn solid" onClick={() => setEditing(true)}><I.plus size={16} /> Add to collection</button>
                : <button
                    className={"btn" + (fav ? " active-fav" : "")}
                    onClick={() => { toggleFavorite(item.id, fav); setFavOptimistic(!fav); }}>
                    {fav ? <I.heartFill size={16} /> : <I.heart size={16} />}
                    {fav ? "Favorited" : "Mark favorite"}
                  </button>}
              {isUserItem && !confirmDelete && (
                <button className="btn" style={{ marginLeft: "auto", color: "var(--danger, #cf6b5a)" }} onClick={() => setConfirmDelete(true)}>
                  <I.trash size={15} /> Remove
                </button>
              )}
              {isUserItem && confirmDelete && (
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--mute)" }}>Remove this item?</span>
                  <button className="btn" style={{ color: "var(--danger, #cf6b5a)" }} onClick={() => { removeItem(item.id); ctx.back(); }}>
                    Yes, remove
                  </button>
                  <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              )}
            </div>
          )}

          {editing
            ? <ItemEditForm item={item} type={type} subLabel={subLabel} story={story}
                onCancel={() => setEditing(false)}
                onSave={({ owned: isOwned, holding, canonical, story: paras }) => {
                  if (canonical) {
                    const patch = { ...canonical };
                    if (Array.isArray(patch.gallery)) patch.gallery = JSON.stringify(patch.gallery);
                    saveCatalog(item.id, patch);
                  }
                  if (paras) { saveStory(item.id, paras); setStoryOv(paras); }
                  const photoUpdate = {
                    cover_url: canonical?.cover_url ?? null,
                    gallery: Array.isArray(canonical?.gallery) ? canonical.gallery
                      : (canonical?.gallery ? (() => { try { return JSON.parse(canonical.gallery); } catch (_) { return item.gallery; } })() : null),
                  };
                  if (isOwned === false) {
                    removeHolding(item.id);
                    if (isUserItem) setItemOwned(item.id, false);
                    setItem({ ...item, ...(canonical || {}), ...photoUpdate, owned: false, format: null, completeness: null, completed: null, grade: null, pressing: null, edition: null, condition: null, acquired: null, watched: undefined });
                  } else {
                    saveHolding(item.id, holding);
                    if (isUserItem && item.owned === false) setItemOwned(item.id, true);
                    setItem({ ...item, ...(canonical || {}), ...photoUpdate, owned: true, ...holding });
                  }
                  setEditing(false);
                }} />
            : <div className="facts">
                {facts.map(([k, v], i) => (
                  <div className={"fact" + (facts.length % 2 === 1 && i === facts.length - 1 ? " full" : "")} key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
                ))}
              </div>}

          <div style={{ marginTop: 30, display: "flex", alignItems: "baseline", gap: 12 }}>
            <div className="eyebrow">The story</div>
            {ollamaModel && (
              <button className="btn" style={{ padding: "3px 10px", fontSize: 11 }}
                disabled={generatingStory}
                onClick={async () => {
                  setGeneratingStory(true);
                  try {
                    const paras = await OllamaClient.generateStory(item, ollamaModel);
                    saveStory(item.id, paras);
                    setStoryOv(paras);
                  } catch (e) { console.warn("[HODD] story gen failed:", e); }
                  setGeneratingStory(false);
                }}>
                <I.sparkle size={12} /> {generatingStory ? "Writing…" : "Generate with AI"}
              </button>
            )}
          </div>
          <div className="story">{story.map((p, i) => <p key={i}>{p}</p>)}</div>

          {related.length > 0 && (
            <div style={{ marginTop: 30 }}>
              <div className="eyebrow">{collection ? `More in ${collection.name}` : "Related"}</div>
              <div className="related-strip" style={{ marginTop: 14 }}>
                {related.map(r => <Cover key={r.id} item={{ ...r, type: relType }} h={130} ghost={r.owned === false} onClick={() => ctx.openItem({ ...r, type: relType }, collection)} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {lightboxImg && (
        <div className="lightbox-scrim" onClick={() => setLightboxImg(null)}>
          <button className="lightbox-close" onClick={() => setLightboxImg(null)} title="Close">
            <I.close size={22} stroke={2} />
          </button>
          <img
            src={`hodd-img://${lightboxImg}`}
            alt=""
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
