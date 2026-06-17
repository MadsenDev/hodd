import React from 'react';
import { I } from '../icons';
import { Cover, FluidCover, useNarrow, StarRating } from '../components';
import { useCollection, useStory } from '../hooks';
import { saveCatalog, saveStory, saveHolding, removeHolding, removeItem, setItemOwned, toggleFavorite, OllamaClient, saveRating, getCachedSuggestions } from '../api';
import { useFavorite } from '../hooks';
import { ItemEditForm, ItemRecord, SUBLABELS, OWNERSHIP_LABEL } from '../forms';
import { toaster } from '../toaster';

// ── Local interfaces ──────────────────────────────────────────────────────────

interface CollectionLike {
  id?: string;
  name?: string;
  type?: string;
  items?: ItemLike[];
}

// N.B. Many fields allow null because that's what the DB stores for cleared values.
interface ItemLike {
  id: string;
  title?: string | null;
  sub?: string | null;
  type?: string;
  series?: string | null;
  collectionId?: string;
  collName?: string;
  cover_url?: string | null;
  gallery?: string[] | null;
  owned?: boolean | null;
  format?: string | null;
  year?: string | number | null;
  region?: string | null;
  completeness?: string | null;
  completed?: boolean | null;
  grade?: string | null;
  edition?: string | null;
  pressing?: string | null;
  watched?: boolean | null;
  condition?: string | null;
  acquired?: string | null;
  notes?: string | null;
  ownership?: string | null;
  loan_from?: string | null;
  loan_date?: string | null;
  purchase_price?: string | number | null;
  purchase_currency?: string | null;
  current_value?: string | number | null;
  loan_to?: string | null;
  loan_to_date?: string | null;
  custom?: Array<{ label: string; value: string }> | null;
  rating?: number | null;
  [key: string]: unknown;
}

interface AppCtx {
  back: () => void;
  openItem: (item: ItemLike, collection?: CollectionLike | null) => void;
  addSuggested?: (item: ItemLike, collectionId?: string) => void;
}

interface ItemDetailProps {
  item: ItemLike;
  collection?: CollectionLike | null;
  ctx: AppCtx;
  ollamaModel?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fallbackStory(item: ItemLike): string[] {
  return [
    `A treasured part of the ${item.to || item.sub || "collection"}. Every item in the hoard carries its own provenance — when it arrived, where it came from, and why it earned a place on the shelf.`,
    "Add your own notes, acquisition details, and memories to give this entry its full story.",
  ];
}

/** Accept only http/https URLs; reject data: URIs and other schemes. */
const isValidCoverUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ItemDetail({ item: initialItem, collection, ctx, ollamaModel }: ItemDetailProps) {
  const narrow = useNarrow();
  const [item, setItem] = React.useState<ItemLike>(initialItem);
  const [editing, setEditing] = React.useState(false);
  const [storyOv, setStoryOv] = React.useState<string[] | null>(null);
  const [generatingStory, setGeneratingStory] = React.useState(false);
  const [findingCover, setFindingCover] = React.useState(false);
  const [coverCandidates, setCoverCandidates] = React.useState<string[]>([]);
  const [pasteUrlInput, setPasteUrlInput] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [lightboxImg, setLightboxImg] = React.useState<string | null>(null);
  const favState = useFavorite(item.id);
  const isFav = !!favState.data;
  const [favOptimistic, setFavOptimistic] = React.useState<boolean | null>(null);
  const fav = favOptimistic !== null ? favOptimistic : isFav;
  const [ratingOptimistic, setRatingOptimistic] = React.useState<number | null>(null);
  const rating = ratingOptimistic !== null ? ratingOptimistic : (item.rating ?? null);
  const [itemSuggestions, setItemSuggestions] = React.useState<ItemLike[]>([]);
  React.useEffect(() => {
    setItem(initialItem);
    setEditing(false);
    setStoryOv(null);
    setConfirmDelete(false);
    setFavOptimistic(null);
    setRatingOptimistic(null);
    setItemSuggestions([]);
  }, [initialItem]);
  React.useEffect(() => {
    const collId = collection?.id || item.collectionId;
    if (!collId) return;
    getCachedSuggestions(collId).then((all: unknown) => {
      const allItems = (all as ItemLike[]) || [];
      const series = item.series?.toLowerCase();
      const titleWords = item.title?.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
      const owned = new Set([item.title?.toLowerCase()]);
      const filtered = allItems.filter((s: ItemLike) => {
        const sq = (s.series || '').toLowerCase();
        return (series ? sq === series : sq === titleWords) && !owned.has((s.title || '').toLowerCase());
      });
      setItemSuggestions(filtered.slice(0, 8));
    });
  }, [item.id, collection?.id]);

  // Fix 2: proper dependency array so the handler is re-registered only when
  // any of the captured variables change, not on every render.
  const isUserItem = item.id && String(item.id).startsWith("i-");
  const fallback = useCollection(collection ? null : isUserItem ? null : (item.collectionId || "featured"));
  const storyState = useStory(item.id);
  const type = item.type || "game";
  const story = storyOv || storyState.data || fallbackStory(item);
  const pool = (collection && collection.items) ? collection.items : ((fallback.data as { items?: ItemLike[] } | null)?.items ?? []);
  const poolIdx = pool.findIndex((i: ItemLike) => i.id === item.id);
  const prevItem = poolIdx > 0 ? pool[poolIdx - 1] : null;
  const nextItem = poolIdx >= 0 && poolIdx < pool.length - 1 ? pool[poolIdx + 1] : null;
  const relType = collection ? collection.type : type;

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft'  && prevItem) ctx.openItem({ ...prevItem, type: relType }, collection);
      if (e.key === 'ArrowRight' && nextItem) ctx.openItem({ ...nextItem, type: relType }, collection);
      if (e.key === 'f' && item.owned !== false) { toggleFavorite(item.id, fav); setFavOptimistic(!fav); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, prevItem, nextItem, item.id, item.owned, fav, ctx, collection, relType]);

  const others = pool.filter((i: ItemLike) => i.id !== item.id);
  const series = item.series;
  const sub = item.sub;
  const bySeries = series ? others.filter((i: ItemLike) => i.series === series) : [];
  const bySub = sub ? others.filter((i: ItemLike) => i.sub === sub && i.series !== series) : [];
  const byAdjacent = others.filter((i: ItemLike) => !bySeries.includes(i) && !bySub.includes(i));
  const related = [...bySeries, ...bySub, ...byAdjacent].slice(0, 5);
  const owned = item.owned !== false;
  const medium = (item.format && item.format !== "—" && item.format !== "Owned") ? item.format : null;
  const subLabel = SUBLABELS[type] || "Detail";
  const rawFacts: unknown[] = [
    ["Status", owned ? (OWNERSHIP_LABEL[item.ownership as string] || "Owned") : "Wishlist"],
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
    ...(owned && Array.isArray(item.custom) ? item.custom.map((x: { label: string; value: string }) => [x.label, x.value]) : []),
    owned && ["Acquired", item.acquired],
    owned && item.notes && ["Notes", item.notes],
    owned && item.ownership === "borrowed" && item.loan_from && ["Borrowed from", item.loan_from],
    owned && item.ownership === "borrowed" && item.loan_date && ["Since", item.loan_date],
    owned && item.purchase_price && ["Paid", `${item.purchase_currency || "USD"} ${item.purchase_price}`],
    owned && item.current_value && ["Est. value", `${item.purchase_currency || "USD"} ${item.current_value}`],
    owned && item.loan_to && ["Lent to", item.loan_to],
    owned && item.loan_to && item.loan_to_date && ["Since (lent)", item.loan_to_date],
  ];
  const facts: [string, unknown][] = rawFacts.filter(Boolean).filter(
    (f): f is [string, unknown] => Array.isArray(f) && f.length >= 2 && typeof f[0] === 'string' && f[1] != null && f[1] !== ""
  );

  return (
    <div className="view-enter">
      <div className="back" style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {/* Fix 6: semantic <button> instead of <span> for keyboard/AT accessibility */}
        <button
          type="button"
          onClick={ctx.back}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: "none", border: "none", padding: 0 }}>
          <I.arrowLeft size={16} /> Back
        </button>
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
              {item.gallery.map((filename: string) => (
                <div key={filename}
                  className={"gallery-thumb" + (filename === item.cover_url ? " is-cover" : "")}
                  onClick={() => setLightboxImg(filename)}
                  title={filename === item.cover_url ? "Cover photo" : "View photo"}>
                  <img src={`hodd-img://${filename}`} alt="" />
                </div>
              ))}
            </div>
          )}
          {!item.cover_url && !editing && (
            <div style={{ marginTop: 10, textAlign: "center" }}>
              {!findingCover ? (
                <button className="btn" style={{ fontSize: 11, padding: "3px 10px" }}
                  onClick={async () => {
                    setFindingCover(true);
                    setCoverCandidates([]);
                    setPasteUrlInput("");
                    if (type === "book" && item.title) {
                      try {
                        const q = `https://openlibrary.org/search.json?title=${encodeURIComponent(item.title)}${item.sub ? `&author=${encodeURIComponent(item.sub)}` : ""}&limit=3`;
                        const res = await fetch(q);
                        const data = await res.json();
                        const ids = (data.docs || []).map((d: { cover_i?: number }) => d.cover_i).filter(Boolean).slice(0, 3);
                        setCoverCandidates(ids.map((id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`));
                      } catch (_) {}
                    }
                  }}>
                  <I.image size={12} /> Find cover online
                </button>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {type === "book" ? (
                    coverCandidates.length > 0 ? (
                      <div>
                        <div style={{ fontSize: 11, color: "var(--mute)", marginBottom: 6 }}>Select a cover:</div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                          {coverCandidates.map((url: string) => (
                            <img key={url} src={url} alt="" style={{ height: 90, borderRadius: 4, cursor: "pointer", border: "2px solid transparent", objectFit: "cover" }}
                              onClick={() => {
                                saveCatalog(item.id, { cover_url: url });
                                setItem(prev => ({ ...prev, cover_url: url }));
                                setFindingCover(false);
                                setCoverCandidates([]);
                              }} />
                          ))}
                        </div>
                        <button className="btn" style={{ fontSize: 11, padding: "3px 8px", marginTop: 8 }} onClick={() => setFindingCover(false)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--mute)" }}>
                        No covers found on Open Library.{" "}
                        <button className="btn" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => setFindingCover(false)}>Close</button>
                      </div>
                    )
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                      <input style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel-2)", color: "var(--fg)", width: 220 }}
                        placeholder="Paste image URL…"
                        value={pasteUrlInput}
                        onChange={e => setPasteUrlInput(e.target.value)} />
                      {/* Fix 7: validate URL scheme properly, not just startsWith("http") */}
                      <button className="btn solid" style={{ fontSize: 11, padding: "4px 10px" }}
                        disabled={!isValidCoverUrl(pasteUrlInput.trim())}
                        onClick={() => {
                          const url = pasteUrlInput.trim();
                          if (!isValidCoverUrl(url)) return;
                          saveCatalog(item.id, { cover_url: url });
                          setItem(prev => ({ ...prev, cover_url: url }));
                          setFindingCover(false);
                          setPasteUrlInput("");
                        }}>
                        Use this URL
                      </button>
                      <button className="btn" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setFindingCover(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="eyebrow" style={{ color: "var(--gold-deep)" }}>{collection ? collection.name : (item.collName || item.sub || type)}</div>
          <h1>{item.title}</h1>
          {type !== "game" && <div className="byline">{item.sub || subLabel}</div>}
          {!editing && (
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
              {item.owned === false
                ? <span className="badge badge-missing" style={{ fontSize: 12, padding: "8px 14px", border: "1px solid var(--border-soft)", borderRadius: 20 }}><I.plus size={13} stroke={2} /> Wishlist</span>
                : <span className="badge badge-owned" style={{ fontSize: 12, padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 20, background: "var(--accent-wash)" }}><I.check size={13} stroke={2.2} /> {OWNERSHIP_LABEL[item.ownership as string] || "Owned"}</span>}
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
            ? <ItemEditForm item={item as ItemRecord} type={type} subLabel={subLabel} story={story}
                onCancel={() => setEditing(false)}
                onSave={({ owned: isOwned, holding, canonical, story: paras }) => {
                  if (canonical) {
                    // Fix 5: pass gallery as an array directly — db.ts (jsonOrNull) handles
                    // JSON stringification for the SQLite TEXT column. Stringifying here
                    // would cause db.ts to double-encode it.
                    const patch: Record<string, unknown> = { ...canonical };
                    saveCatalog(item.id, patch);
                  }
                  if (paras) { saveStory(item.id, paras); setStoryOv(paras); }
                  const photoUpdate = {
                    cover_url: typeof canonical?.cover_url === 'string' ? canonical.cover_url : null,
                    gallery: Array.isArray(canonical?.gallery) ? (canonical.gallery as string[])
                      : (canonical?.gallery ? (() => { try { return JSON.parse(canonical.gallery as string) as string[]; } catch (_) { return item.gallery; } })() : null),
                  };
                  if (isOwned === false) {
                    removeHolding(item.id);
                    if (isUserItem) setItemOwned(item.id, false);
                    setItem({ ...item, ...(canonical || {}), ...photoUpdate, owned: false, format: null, completeness: null, completed: null, grade: null, pressing: null, edition: null, condition: null, acquired: null, watched: undefined, notes: null, ownership: null, loan_from: null, loan_date: null, purchase_price: null, purchase_currency: null, current_value: null, loan_to: null, loan_to_date: null });
                  } else {
                    if (holding) saveHolding(item.id, holding as Parameters<typeof saveHolding>[1]);
                    if (isUserItem && item.owned === false) setItemOwned(item.id, true);
                    setItem({ ...item, ...(canonical || {}), ...photoUpdate, owned: true, ...(holding || {}) });
                  }
                  setEditing(false);
                }} />
            : <div className="facts">
                {/* Fix 3: use index as key tiebreaker since custom field labels may not be unique */}
                {facts.map(([k, v], i) => (
                  <div className={"fact" + (facts.length % 2 === 1 && i === facts.length - 1 ? " full" : "")} key={`${k}-${i}`}><div className="k">{k}</div><div className="v">{String(v)}</div></div>
                ))}
              </div>}

          {owned && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--mute)", minWidth: 80 }}>Rating</div>
              <StarRating
                value={rating}
                size={20}
                onChange={(v: number | null) => {
                  if (v !== null) {
                    setRatingOptimistic(v);
                    saveRating(item.id, v);
                  }
                }}
              />
              {rating && (
                <span style={{ fontSize: 12, color: "var(--dim)" }}>{rating}/5</span>
              )}
            </div>
          )}

          <div style={{ marginTop: 30, display: "flex", alignItems: "baseline", gap: 12 }}>
            <div className="eyebrow">The story</div>
            {ollamaModel && (
              <button className="btn" style={{ padding: "3px 10px", fontSize: 11 }}
                disabled={generatingStory}
                onClick={async () => {
                  setGeneratingStory(true);
                  try {
                    const storyItem = { ...item, year: typeof item.year === 'number' ? item.year : (item.year ? Number(item.year) || null : null) };
                    const paras = await OllamaClient.generateStory(storyItem, ollamaModel);
                    saveStory(item.id, paras);
                    setStoryOv(paras);
                  } catch (e) {
                    // Fix 4: surface story generation failure to the user
                    toaster.error('Story generation failed — is Ollama running?');
                  }
                  setGeneratingStory(false);
                }}>
                <I.sparkle size={12} /> {generatingStory ? "Writing…" : "Generate with AI"}
              </button>
            )}
          </div>
          <div className="story">{story.map((p: string, i: number) => <p key={i}>{p}</p>)}</div>

          {related.length > 0 && (
            <div style={{ marginTop: 30 }}>
              <div className="eyebrow">{collection ? `More in ${collection.name}` : "Related"}</div>
              <div className="related-strip" style={{ marginTop: 14 }}>
                {related.map((r: ItemLike) => <Cover key={r.id} item={{ ...r, type: relType }} h={130} ghost={r.owned === false} onClick={() => ctx.openItem({ ...r, type: relType }, collection)} />)}
              </div>
            </div>
          )}

          {itemSuggestions.length > 0 && (
            <div style={{ marginTop: 30 }}>
              <div className="eyebrow">You might also want</div>
              <div className="related-strip" style={{ marginTop: 14 }}>
                {itemSuggestions.map((s: ItemLike) => (
                  <Cover key={s.id} item={{ ...s, type: relType }} h={130} ghost onClick={() => ctx.addSuggested && ctx.addSuggested(s, collection?.id || item.collectionId)} />
                ))}
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
