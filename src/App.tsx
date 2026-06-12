// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { I } from './icons';
import { Cover, Sidebar, Topbar, MobileTopBar, MobileTabs, useNarrow } from './components';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakSelect } from './tweaks';
import { useUser } from './hooks';
import { OllamaClient } from './api';
import { TYPE_COLL, TYPE_LABEL, parseHoardLines } from './engine';
import { typeIcon } from './icons';
import { CreateCollectionModal, AddItemModal } from './forms';
import { Home, HomeNew } from './views/Home';
import { Collections, CollectionsNew } from './views/Collections';
import { CollectionDetail } from './views/CollectionDetail';
import { ItemDetail } from './views/ItemDetail';
import { SearchView } from './views/SearchView';
import { Statistics } from './views/Statistics';
import { ComingSoon } from './views/ComingSoon';

const ACCENTS = {
  "#4f46e5": ["#4f46e5", "#6366f1", "#4338ca"],
  "#0d9488": ["#0d9488", "#14b8a6", "#0f766e"],
  "#e2503b": ["#e2503b", "#f06a57", "#c43f2c"],
  "#2563eb": ["#2563eb", "#3b82f6", "#1d4ed8"],
};

const HEADLINE_FONTS = {
  "Bricolage": '"Bricolage Grotesque", "Hanken Grotesk", system-ui, sans-serif',
  "Space Grotesk": '"Space Grotesk", "Hanken Grotesk", system-ui, sans-serif',
};

function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
  return `rgba(${(n>>16)&255}, ${(n>>8)&255}, ${n&255}, ${a})`;
}

const TWEAK_DEFAULTS = {
  "theme": "light",
  "accent": "#4f46e5",
  "headline": "Bricolage",
  "homeStyle": "Collection-first",
  "collStyle": "Shelves",
  "shelfArt": "Covers",
  "ollamaModel": ""
};

const ADD_EXAMPLES = ["Pokemon Red CIB", "Morgan Dollar 1884-O", "Dune hardcover", "Blade Runner 2049 4K", "Kind of Blue 180g"];

function ConfBadge({ c }) {
  return <span className={"conf " + c}>{c === "high" ? "Confident" : "Confirm"}</span>;
}

function AddCard({ item, onChange, onRemove }) {
  const setField = (i, v) => {
    const fields = item.fields.map((f, j) => j === i ? { ...f, v, c: "high" } : f);
    onChange({ ...item, fields, askCount: fields.filter(f => f.c === "ask").length });
  };
  const collections = [...new Set(Object.values(TYPE_COLL))];
  return (
    <div className="add-card">
      <div className="add-card-cover"><Cover item={{ title: item.title, type: item.type, color: item.color }} h={84} /></div>
      <div className="add-card-body">
        <div className="add-card-head">
          <input className="add-title" value={item.title} onChange={e => onChange({ ...item, title: e.target.value, fields: item.fields.map(f => f.k === "Title" ? { ...f, v: e.target.value } : f) })} />
          <div className="add-card-meta">
            <span className="add-type">{typeIcon(item.type, { size: 13, stroke: 1.8 })} {TYPE_LABEL[item.type]}</span>
            <span className="add-arrow">→</span>
            <select className="add-coll" value={item.collection} onChange={e => onChange({ ...item, collection: e.target.value })}>
              {collections.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="add-fields">
          {item.fields.filter(f => f.k !== "Title" && f.k !== "Type").map((f, i0) => {
            const i = item.fields.indexOf(f);
            return (
              <div className={"add-field" + (f.c === "ask" ? " ask" : "")} key={f.k}>
                <span className="afk">{f.k}</span>
                {f.c === "ask"
                  ? <input className="afv-input" placeholder={f.v} onChange={e => setField(i, e.target.value)} />
                  : <span className="afv">{f.v}</span>}
                {f.c === "high" && <I.check size={12} stroke={2.6} className="af-ok" />}
              </div>
            );
          })}
        </div>
      </div>
      <button className="add-remove" onClick={onRemove} title="Remove"><I.close size={15} /></button>
    </div>
  );
}

function QuickCapture({ onClose }) {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState([]);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  function commit() { const v = text.trim(); if (!v) return; setNotes(n => [v, ...n]); setText(""); inputRef.current && inputRef.current.focus(); }
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div>
            <div className="lbl" style={{ color: "var(--accent)" }}>Quick capture</div>
            <h3>Jot it down</h3>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: 38, height: 38 }}><I.close size={18} /></button>
        </div>
        <div className="sheet-body">
          <div className="ai-input-wrap">
            <input ref={inputRef} className="ai-input" placeholder="e.g. Pokemon Red CIB"
              value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commit(); }} />
            <button className="ai-go" onClick={commit}><I.enter size={18} /></button>
          </div>
          <div className="ai-hint"><I.sparkle size={13} /> Capture the shorthand now — Hodd parses it into full records on your desktop.</div>
          {notes.length > 0 && (
            <div className="capture-list">
              {notes.map((n, i) => (
                <div className="capture-item" key={i}>
                  <I.tag size={14} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
                  <span>{n}</span>
                  <button onClick={() => setNotes(notes.filter((_, j) => j !== i))}><I.close size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sheet-foot">
          <span style={{ fontSize: 12, color: "var(--mute)" }}>{notes.length} note{notes.length !== 1 ? "s" : ""} captured</span>
          <button className="btn solid" disabled={!notes.length} onClick={onClose}><I.check size={16} /> Save</button>
        </div>
      </div>
    </div>
  );
}

function AddDesktop({ onClose, ctx }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState("input");
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const lineCount = text.split("\n").map(s => s.trim()).filter(Boolean).length;

  function analyze() {
    if (!text.trim()) return;
    setStage("thinking");
    setTimeout(() => { setItems(parseHoardLines(text)); setStage("review"); }, 1000);
  }
  function addExample(s) {
    setText(t => (t.trim() ? t.replace(/\n*$/, "") + "\n" : "") + s);
    inputRef.current && inputRef.current.focus();
  }
  const totalAsk = items.reduce((n, it) => n + it.askCount, 0);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="t">
            <I.sparkle size={20} style={{ color: "var(--accent)" }} />
            <div>
              <div className="lbl">Add to your hoard</div>
              <h3>{stage === "review" ? `${items.length} item${items.length !== 1 ? "s" : ""} recognized` : "What did you collect?"}</h3>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: 38, height: 38 }}><I.close size={18} /></button>
        </div>

        <div className="modal-body">
          {stage !== "review" && (
            <>
              <textarea ref={inputRef} className="ai-textarea" rows={5}
                placeholder={"Type or paste — one item per line\n\nPokemon Red CIB\nMorgan Dollar 1884-O\nDune hardcover"}
                value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) analyze(); }} />
              <div className="ai-hint"><I.sparkle size={13} /> Local AI reads your shorthand line by line and fills in the details. Nothing is saved until you confirm.</div>
              <div className="add-examples">
                <span className="add-examples-lbl">Try</span>
                {ADD_EXAMPLES.map(s => <div className="chip" key={s} onClick={() => addExample(s)}>{s}</div>)}
              </div>
              {stage === "thinking" && (
                <div className="parse-status" style={{ marginTop: 20 }}>
                  <span className="ai-spinner" /> Reading locally — extracting titles, platforms, editions…
                </div>
              )}
            </>
          )}

          {stage === "review" && (
            <div className="parse">
              <div className="parse-status">
                <I.check size={16} stroke={2.4} /> Parsed on-device.{" "}
                {totalAsk > 0 ? <span>{totalAsk} field{totalAsk !== 1 ? "s" : ""} need a quick confirm.</span> : <span>Everything looks confident.</span>}
              </div>
              <div className="add-list">
                {items.map((it, i) => (
                  <AddCard key={it.id} item={it}
                    onChange={u => setItems(items.map((x, j) => j === i ? u : x))}
                    onRemove={() => setItems(items.filter((_, j) => j !== i))} />
                ))}
              </div>
              <button className="add-more" onClick={() => { setStage("input"); }}><I.plus size={15} /> Add more shorthand</button>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 12, color: "var(--mute)", display: "flex", alignItems: "center", gap: 7 }}>
            <I.lock size={13} /> Runs on-device · Nothing saved until you confirm
          </div>
          {stage === "review"
            ? <button className="btn solid" disabled={!items.length} onClick={() => { onClose(); ctx.openCollection("featured"); }}><I.check size={16} /> Add {items.length} item{items.length !== 1 ? "s" : ""}</button>
            : <button className="btn solid" disabled={!lineCount} onClick={analyze}><I.sparkle size={15} /> Parse {lineCount || ""} item{lineCount !== 1 ? "s" : ""}</button>}
        </div>
      </div>
    </div>
  );
}

function AddModal({ onClose, ctx }) {
  const narrow = useNarrow();
  if (narrow) return <QuickCapture onClose={onClose} />;
  return <AddDesktop onClose={onClose} ctx={ctx} />;
}

function greetingFor(d) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", t.theme === "dark" ? "dark" : "light");
    const [a, soft, deep] = ACCENTS[t.accent] || ACCENTS["#4f46e5"];
    root.style.setProperty("--accent", a);
    root.style.setProperty("--accent-soft", soft);
    root.style.setProperty("--accent-deep", deep);
    root.style.setProperty("--accent-wash", hexA(a, t.theme === "dark" ? 0.20 : 0.10));
    root.style.setProperty("--display", HEADLINE_FONTS[t.headline] || HEADLINE_FONTS.Bricolage);
  }, [t.theme, t.accent, t.headline]);

  const [view, setView] = useState("home");
  const [collId, setCollId] = useState(null);
  const [item, setItem] = useState(null);
  const [itemColl, setItemColl] = useState(null);
  const [searchInit, setSearchInit] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [createCollOpen, setCreateCollOpen] = useState(false);
  const [addItemColl, setAddItemColl] = useState(null);
  const [dataVer, setDataVer] = useState(0);
  const bumpData = () => setDataVer(v => v + 1);
  const [topSearch, setTopSearch] = useState("");
  const [ollamaModels, setOllamaModels] = useState([]);
  useEffect(() => {
    OllamaClient.getModels().then(setOllamaModels).catch(() => {});
  }, []);
  const histRef = useRef([]);
  const scrollRef = useRef(null);

  function push(v) { histRef.current.push({ view, collId, item, itemColl }); setView(v); }
  function scrollTop() { if (scrollRef.current) scrollRef.current.scrollTop = 0; window.scrollTo(0, 0); }

  const ctx = {
    go(v) { push(v); scrollTop(); },
    openCollection(id) { histRef.current.push({ view, collId, item, itemColl }); setCollId(id); setView("collection"); scrollTop(); },
    openItem(it, coll) { histRef.current.push({ view, collId, item, itemColl }); setItem(it); setItemColl(coll || null); setView("item"); scrollTop(); },
    back() {
      const h = histRef.current.pop();
      if (h) { setView(h.view); setCollId(h.collId); setItem(h.item); setItemColl(h.itemColl); }
      else setView("home");
      scrollTop();
    },
    search(q) { setSearchInit(q || ""); push("search"); scrollTop(); },
    newCollection() { setCreateCollOpen(true); },
    addToCollection(coll) { setAddItemColl(coll); },
  };

  useEffect(() => { scrollTop(); }, [view]);

  const user = useUser();
  const greeting = greetingFor(new Date());
  const name = user.data ? user.data.name : "";
  let bar;
  if (view === "home") bar = { title: name ? `${greeting}, ${name}.` : `${greeting}.`, subtitle: "Every item has a story. What will you discover tonight?" };
  else if (view === "collections") bar = { title: "Collections", subtitle: "Everything you value, gathered in one place." };
  else if (view === "search") bar = { title: "Search", subtitle: "Ask in plain language — Hodd translates it into your hoard." };
  else if (view === "wishlist") bar = { title: "Wishlist", subtitle: "What's still out there." };
  else if (view === "timeline") bar = { title: "Timeline", subtitle: "How your collection has grown." };
  else if (view === "discover") bar = { title: "Discover", subtitle: "Find what connects, and what's missing." };
  else if (view === "statistics") bar = { title: "Statistics", subtitle: "The shape of your hoard." };
  else if (view === "settings") bar = { title: "Settings", subtitle: null };
  else bar = { bare: true };

  let body;
  if (view === "home") body = t.homeStyle === "Dashboard" ? <Home ctx={ctx} /> : <HomeNew ctx={ctx} art={t.shelfArt} />;
  else if (view === "collections") body = t.collStyle === "Cards" ? <Collections ctx={ctx} /> : <CollectionsNew ctx={ctx} art={t.shelfArt} />;
  else if (view === "collection") body = <CollectionDetail collId={collId} ctx={ctx} />;
  else if (view === "item") body = <ItemDetail item={item} collection={itemColl} ctx={ctx} ollamaModel={t.ollamaModel} />;
  else if (view === "search") body = <SearchView initial={searchInit} ctx={ctx} ollamaModel={t.ollamaModel} />;
  else if (view === "statistics") body = <Statistics ctx={ctx} />;
  else body = <ComingSoon name={bar.title || "Coming soon"} />;

  const activeNav = ["collection"].includes(view) ? "collections" : ["item"].includes(view) ? null : view;

  const navTo = (id) => {
    if (id === "search") { ctx.search(""); return; }
    setCollId(null); setItem(null); setItemColl(null);
    histRef.current = []; setView(id); scrollTop();
  };

  return (
    <div className="app">
      <Sidebar active={activeNav} onNav={navTo} />
      <MobileTopBar onAdd={() => setAddOpen(true)} />
      <div className="main" ref={scrollRef} style={{ height: "100vh", overflowY: "auto" }}>
        <div className="canvas">
          <Topbar {...bar}
            onAdd={() => setAddOpen(true)}
            onSearch={() => { if (view !== "search") ctx.search(""); }}
            searchValue={topSearch}
            onSearchChange={setTopSearch}
            onSearchSubmit={(q) => { setTopSearch(""); ctx.search(q); }} />
          <div key={view + ":" + collId + ":" + dataVer}>{body}</div>
        </div>
      </div>
      <MobileTabs active={activeNav} onNav={navTo} />
      {addOpen && <AddModal onClose={() => setAddOpen(false)} ctx={ctx} />}
      {createCollOpen && <CreateCollectionModal
        onClose={() => setCreateCollOpen(false)}
        onCreated={(rec) => { setCreateCollOpen(false); bumpData(); ctx.openCollection(rec.id); }} />}
      {addItemColl && <AddItemModal collection={addItemColl}
        onClose={() => setAddItemColl(null)}
        onAdded={() => { setAddItemColl(null); bumpData(); }} />}
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Home" value={t.homeStyle} options={["Collection-first", "Dashboard"]}
          onChange={v => setTweak("homeStyle", v)} />
        <TweakRadio label="Collections" value={t.collStyle} options={["Shelves", "Cards"]}
          onChange={v => setTweak("collStyle", v)} />
        <TweakRadio label="Shelf art" value={t.shelfArt} options={["Covers", "Spines"]}
          onChange={v => setTweak("shelfArt", v)} />
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={["light", "dark"]}
          onChange={v => setTweak("theme", v)} />
        <TweakColor label="Accent" value={t.accent}
          options={["#4f46e5", "#0d9488", "#e2503b", "#2563eb"]}
          onChange={v => setTweak("accent", v)} />
        <TweakSection label="Typography" />
        <TweakRadio label="Headline" value={t.headline} options={["Bricolage", "Space Grotesk"]}
          onChange={v => setTweak("headline", v)} />
        <TweakSection label="Local AI" />
        <TweakSelect label="Ollama model" value={t.ollamaModel}
          options={ollamaModels.length ? ["", ...ollamaModels] : [""]}
          onChange={v => setTweak("ollamaModel", v)} />
      </TweaksPanel>
    </div>
  );
}
