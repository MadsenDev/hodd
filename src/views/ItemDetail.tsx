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
  const favState = useFavorite(item.id);
  const isFav = !!favState.data;
  const [favOptimistic, setFavOptimistic] = React.useState(null);
  const fav = favOptimistic !== null ? favOptimistic : isFav;
  React.useEffect(() => { setItem(initialItem); setEditing(false); setStoryOv(null); setConfirmDelete(false); setFavOptimistic(null); }, [initialItem]);
  const isUserItem = item.id && String(item.id).startsWith("i-");
  const fallback = useCollection(collection ? null : isUserItem ? null : (item.collectionId || "featured"));
  const storyState = useStory(item.id);
  const type = item.type || "game";
  const story = storyOv || storyState.data || fallbackStory(item);
  const pool = (collection && collection.items) ? collection.items : (fallback.data ? fallback.data.items : []);
  const related = pool.filter(i => i.id !== item.id).slice(0, 5);
  const relType = collection ? collection.type : type;
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
    owned && type === "coin" && ["Grade", item.grade],
    owned && type === "book" && ["Edition", item.edition],
    owned && type === "vinyl" && ["Pressing", item.pressing],
    owned && type === "movie" && typeof item.watched === "boolean" && ["Watched", item.watched ? "Yes" : "Not yet"],
    owned && ["Condition", item.condition],
    ...(owned && Array.isArray(item.custom) ? item.custom.map(x => [x.label, x.value]) : []),
    owned && ["Acquired", item.acquired],
  ].filter(f => f && f[1] != null && f[1] !== "");

  return (
    <div className="view-enter">
      <div className="back" onClick={ctx.back}><I.arrowLeft size={16} /> Back</div>
      <div className="item-detail">
        <div className="big-cover">
          <FluidCover item={item} ghost={item.owned === false} maxWidth={narrow ? 300 : 360} />
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
                  if (canonical) saveCatalog(item.id, canonical);
                  if (paras) { saveStory(item.id, paras); setStoryOv(paras); }
                  if (isOwned === false) {
                    removeHolding(item.id);
                    if (isUserItem) setItemOwned(item.id, false);
                    setItem({ ...item, ...(canonical || {}), owned: false, format: null, completeness: null, grade: null, pressing: null, edition: null, condition: null, acquired: null, watched: undefined });
                  } else {
                    saveHolding(item.id, holding);
                    if (isUserItem && item.owned === false) setItemOwned(item.id, true);
                    setItem({ ...item, ...(canonical || {}), owned: true, ...holding });
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
    </div>
  );
}
