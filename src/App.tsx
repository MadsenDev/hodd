import React, { useState, useEffect, useRef } from 'react';
import { I } from './icons';
import { Cover, Sidebar, Topbar, MobileTopBar, MobileTabs, useNarrow, Toaster } from './components';
import { toaster } from './toaster';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakSelect } from './tweaks';
import { useUser, useCollections, useSearchIndex } from './hooks';
import { OllamaClient, addItem, lookupMetadata, invalidateCache, getSettings } from './api';
import { Onboarding, LoadingScreen } from './views/Onboarding';
import { TYPE_COLL, TYPE_COLOR, TYPE_LABEL, parseHoardLines } from './engine';
import { typeIcon } from './icons';
import { CreateCollectionModal, AddItemModal, FORMAT_OPTIONS, CONDITION_OPTIONS, COMPLETENESS_OPTIONS, PLATFORM_OPTS, PLATFORMS_BY_MAKER, makerFor } from './forms';
import { Home, HomeNew } from './views/Home';
import { Collections, CollectionsNew } from './views/Collections';
import { CollectionDetail } from './views/CollectionDetail';
import { ItemDetail } from './views/ItemDetail';
import { SearchView } from './views/SearchView';
import { Statistics } from './views/Statistics';
import { ComingSoon } from './views/ComingSoon';
import { Settings } from './views/Settings';
import { Wishlist } from './views/Wishlist';
import { Favorites } from './views/Favorites';
import { Timeline } from './views/Timeline';
import { Discover } from './views/Discover';
import { SeriesView } from './views/Series';
import { LoanView } from './views/LoanView';

// Each entry: [light accent, light soft, light deep]  /  [dark accent, dark soft, dark deep]
const ACCENTS: Record<string, [string[], string[]]> = {
  "#4f46e5": [["#4f46e5", "#6366f1", "#4338ca"], ["#7c7bff", "#9a99ff", "#6361f0"]],
  "#0d9488": [["#0d9488", "#14b8a6", "#0f766e"], ["#2dd4bf", "#5eead4", "#0f766e"]],
  "#e2503b": [["#e2503b", "#f06a57", "#c43f2c"], ["#f87171", "#fca5a5", "#e2503b"]],
  "#2563eb": [["#2563eb", "#3b82f6", "#1d4ed8"], ["#60a5fa", "#93c5fd", "#3b82f6"]],
  "#7c3aed": [["#7c3aed", "#8b5cf6", "#6d28d9"], ["#a78bfa", "#c4b5fd", "#8b5cf6"]],
  "#d97706": [["#d97706", "#f59e0b", "#b45309"], ["#fbbf24", "#fde68a", "#f59e0b"]],
};

const HEADLINE_FONTS: Record<string, string> = {
  "Bricolage": '"Bricolage Grotesque", "Hanken Grotesk", system-ui, sans-serif',
  "Space Grotesk": '"Space Grotesk", "Hanken Grotesk", system-ui, sans-serif',
};

function hexA(hex: string, a: number): string {
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

const COLL_NAME_TO_ID: Record<string, string> = {
  "Games": "games", "Books": "books", "Movies": "movies",
  "Coins": "coins", "Comics": "comics", "Vinyl": "vinyl",
};

const ENRICH_FIELD_MAP: Record<string, string> = {
  year: "Year", platform: "Platform", author: "Author", artist: "Artist",
  mint: "Mint", director: "Director", publisher: "Publisher",
  edition: "Edition", completeness: "Completeness", grade: "Grade", pressing: "Pressing",
  series: "Series", region: "Region",
};

const AI_OVERRIDE_FIELDS = new Set(["Year"]);

// NavigationContext is the shared navigation object passed to views.
export interface NavigationContext {
  go(v: string): void;
  openCollection(id: string): void;
  openItem(it: any, coll?: any): void;
  back(): void;
  search(q: string): void;
  newCollection(): void;
  addToCollection(coll: any, prefill?: any): void;
}

function applyEnrichment(item: any, enrich: any, aiPass = false, skipTitle = false) {
  if (!enrich) return item;
  let fields = [...item.fields];
  let title = item.title;

  if (!skipTitle && enrich.title && typeof enrich.title === "string" && enrich.title !== item.title) {
    title = enrich.title;
    fields = fields.map((f: any) => f.k === "Title" ? { ...f, v: enrich.title, c: "high" } : f);
  }
  const cover_url = enrich.cover_url || item.cover_url || null;
  Object.entries(enrich).forEach(([key, val]) => {
    if (!val || val === "null" || key === "title") return;
    const fieldKey = ENRICH_FIELD_MAP[key];
    if (!fieldKey) return;
    const idx = fields.findIndex((f: any) => f.k === fieldKey);
    const canOverride = fields[idx]?.c === "ask" || (aiPass && AI_OVERRIDE_FIELDS.has(fieldKey));
    if (idx >= 0 && canOverride) {
      fields = fields.map((f: any, i: number) => i === idx ? { ...f, v: String(val), c: "high" } : f);
    } else if (idx < 0) {
      fields = [...fields, { k: fieldKey, v: String(val), c: "high" }];
    }
  });
  return { ...item, title, fields, cover_url, askCount: fields.filter((f: any) => f.c === "ask").length };
}

function buildDraft(item: any) {
  const byKey: Record<string, any> = {};
  item.fields.forEach((f: any) => { byKey[f.k] = f.v; });
  const yearRaw = byKey["Year"];
  const year = typeof yearRaw === "number" ? yearRaw
    : (yearRaw && !/^Confirm/i.test(String(yearRaw))) ? parseInt(String(yearRaw), 10) : null;
  const sub = ["Platform", "Author", "Artist", "Mint", "Director", "Publisher"]
    .map(k => byKey[k]).find(v => v && !/^Confirm/i.test(String(v)));
  const editionRaw = byKey["Edition"];
  const completeness = byKey["Completeness"];
  const grade = byKey["Grade"];
  const pressing = byKey["Pressing"];
  const series = byKey["Series"];
  const region = byKey["Region"];
  const ownership = byKey["Ownership"];
  const typeFormatOpts = FORMAT_OPTIONS[item.type] || [];
  const isFormatVal = editionRaw && typeFormatOpts.includes(String(editionRaw));
  const format = isFormatVal ? String(editionRaw) : null;
  const edition = !isFormatVal ? editionRaw : null;
  return {
    title: item.title, type: item.type, color: item.color,
    year: Number.isFinite(year) ? year : null,
    sub: sub || null, owned: true,
    ...(item.cover_url ? { cover_url: item.cover_url } : {}),
    ...(ownership ? { ownership } : {}),
    ...(format ? { format } : {}),
    ...(edition && !/^Standard$|^Confirm/i.test(String(edition)) ? { edition: String(edition) } : {}),
    ...(completeness && !/^Confirm/i.test(String(completeness)) ? { completeness: String(completeness) } : {}),
    ...(grade && !/^Confirm|^Add/i.test(String(grade)) ? { grade: String(grade) } : {}),
    ...(pressing && !/^Confirm/i.test(String(pressing)) ? { pressing: String(pressing) } : {}),
    ...(series && !/^Confirm/i.test(String(series)) ? { series: String(series) } : {}),
    ...(region && !/^Confirm/i.test(String(region)) ? { region: String(region) } : {}),
  };
}

function normalizeTitle(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Simple CSV parser — handles basic quoted fields but does not support:
// - Escaped double-quotes ("") within quoted fields
// - Embedded newlines within quoted fields
// Consider using papaparse for complex CSV input.
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCSVItems(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase());
  const idx = (k: string) => headers.indexOf(k);
  const items: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const get = (k: string) => { const j = idx(k); return j >= 0 ? (cols[j] || '') : ''; };
    const title = get('title');
    if (!title) continue;
    const type = get('type') || 'game';
    const year = get('year') ? parseInt(get('year'), 10) : null;
    const sub = get('platform') || null;
    const series = get('series') || null;
    const format = get('format') || null;
    const condition = get('condition') || null;
    const ownership = get('status') || 'owned';
    const notes = get('notes') || null;
    const color = TYPE_COLOR[type] || TYPE_COLOR['game'];
    const collection = TYPE_COLL[type] || 'Games';
    const fields = [
      { k: 'Title', v: title, c: 'high' },
      { k: 'Type', v: TYPE_LABEL[type] || type, c: 'high' },
      ...(type === 'game' ? [{ k: 'Platform', v: sub || 'Confirm platform', c: sub ? 'high' : 'ask' }] : []),
      ...(type === 'book' ? [{ k: 'Author', v: sub || 'Confirm author', c: sub ? 'high' : 'ask' }] : []),
      ...(type === 'vinyl' ? [{ k: 'Artist', v: sub || 'Confirm artist', c: sub ? 'high' : 'ask' }] : []),
      ...(type === 'coin' ? [{ k: 'Mint', v: sub || 'Confirm mint', c: sub ? 'high' : 'ask' }] : []),
      { k: 'Year', v: year || 'Confirm year', c: year ? 'high' : 'ask' },
      ...(format ? [{ k: 'Edition', v: format, c: 'high' }] : [{ k: 'Edition', v: 'Standard', c: 'ask' }]),
      ...(condition ? [{ k: 'Condition', v: condition, c: 'high' }] : []),
      ...(series ? [{ k: 'Series', v: series, c: 'high' }] : []),
      ...(notes ? [{ k: 'Notes', v: notes, c: 'high' }] : []),
    ];
    items.push({
      id: 'csv-' + Math.random().toString(36).slice(2, 8),
      raw: title, title, type, color, collection,
      sub, series, format, condition, ownership,
      fields,
      askCount: fields.filter(f => f.c === 'ask').length,
    });
  }
  return items;
}

function ConfBadge({ c }: { c: string }) {
  return <span className={"conf " + c}>{c === "high" ? "Confident" : "Confirm"}</span>;
}

const FIELD_OPTS: Record<string, string[]> = {
  Completeness: COMPLETENESS_OPTIONS,
  Condition: CONDITION_OPTIONS,
};

function AddCard({ item, onChange, onRemove, collOpts }: {
  item: any;
  onChange: (item: any) => void;
  onRemove: () => void;
  collOpts: any[];
}) {
  const [showAlt, setShowAlt] = React.useState(false);
  const platformField = item.fields.find((f: any) => f.k === "Platform");
  const platformVal = platformField && !/^Confirm/i.test(String(platformField.v)) ? String(platformField.v || "") : "";
  const [selectedMaker, setSelectedMaker] = React.useState(() => makerFor(platformVal) || "");

  const setField = (i: number, v: string) => {
    const fields = item.fields.map((f: any, j: number) => j === i ? { ...f, v, c: "high" } : f);
    onChange({ ...item, fields, askCount: fields.filter((f: any) => f.c === "ask").length });
  };

  function applyLookupResult(alt: any) {
    let fields = item.fields.map((f: any) => {
      if (f.k === "Year" && alt.year) return { ...f, v: String(alt.year), c: "high" };
      if ((f.k === "Platform" || f.k === "Author" || f.k === "Artist") && alt.sub) return { ...f, v: alt.sub, c: "high" };
      return f;
    });
    onChange({ ...item, fields, cover_url: alt.cover_url || item.cover_url, askCount: fields.filter((f: any) => f.c === "ask").length });
    setShowAlt(false);
  }
  const opts = collOpts && collOpts.length ? collOpts.map((c: any) => c.name) : [...new Set(Object.values(TYPE_COLL))];
  const extras = item.duplicate || (item._lookupResults || []).length > 1;
  return (
    <div className="add-card">
      <div className="add-card-row">
        <div className="add-card-cover"><Cover item={{ title: item.title, type: item.type, color: item.color, cover_url: item.cover_url || null }} h={84} /></div>
        <div className="add-card-body">
          <div className="add-card-head">
            <input className="add-title" value={item.title} onChange={e => onChange({ ...item, title: e.target.value, fields: item.fields.map((f: any) => f.k === "Title" ? { ...f, v: e.target.value } : f) })} />
            <div className="add-card-meta">
              <span className="add-type">{typeIcon(item.type, { size: 13, stroke: 1.8 })} {TYPE_LABEL[item.type]}</span>
              <span className="add-arrow">→</span>
              <select className="add-coll" value={item.collection} onChange={e => onChange({ ...item, collection: e.target.value })}>
                {(opts as string[]).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="add-fields">
            {item.fields.filter((f: any) => f.k !== "Title" && f.k !== "Type").map((f: any) => {
              const i = item.fields.indexOf(f);
              const isAsk = f.c === "ask";
              const isPlatform = f.k === "Platform" && item.type === "game";
              const dropOpts = !isPlatform && (FIELD_OPTS[f.k] || (f.k === "Edition" && FORMAT_OPTIONS[item.type] ? FORMAT_OPTIONS[item.type] : null));
              if (isPlatform) {
                const curVal = /^Confirm/i.test(String(f.v)) ? "" : String(f.v || "");
                const consoles = selectedMaker ? (PLATFORMS_BY_MAKER[selectedMaker] || []) : [];
                const makerOptions = Object.keys(PLATFORMS_BY_MAKER);
                return (
                  <React.Fragment key={f.k}>
                    <div className={"add-field" + (isAsk ? " ask" : "")}>
                      <span className="afk">Maker</span>
                      <select className="afv-input" value={selectedMaker} onChange={e => { setSelectedMaker(e.target.value); setField(i, ""); }}>
                        <option value="">—</option>
                        {makerOptions.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className={"add-field" + (isAsk ? " ask" : "")}>
                      <span className="afk">Platform</span>
                      <select className="afv-input" value={curVal} onChange={e => setField(i, e.target.value)} disabled={!selectedMaker}>
                        <option value="">—</option>
                        {consoles.map(c => {
                          const prefix = selectedMaker + ' ';
                          const label = c.startsWith(prefix) ? c.slice(prefix.length) : c;
                          return <option key={c} value={c}>{label}</option>;
                        })}
                        {curVal && !consoles.includes(curVal) && <option value={curVal}>{curVal}</option>}
                      </select>
                      {!isAsk && curVal && <I.check size={12} stroke={2.6} className="af-ok" />}
                    </div>
                  </React.Fragment>
                );
              }
              return (
                <div className={"add-field" + (isAsk ? " ask" : "")} key={f.k}>
                  <span className="afk">{f.k}</span>
                  {dropOpts ? (
                    <select
                      className="afv-input"
                      value={/^Confirm/i.test(String(f.v)) ? "" : f.v}
                      onChange={e => setField(i, e.target.value)}
                    >
                      <option value="">{isAsk ? `Choose ${f.k.toLowerCase()}` : "—"}</option>
                      {dropOpts.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      className="afv-input"
                      value={/^Confirm/i.test(String(f.v)) ? "" : f.v}
                      placeholder={isAsk ? f.v : ""}
                      onChange={e => setField(i, e.target.value)}
                    />
                  )}
                  {!isAsk && f.v && !/^Confirm/i.test(String(f.v)) && <I.check size={12} stroke={2.6} className="af-ok" />}
                </div>
              );
            })}
          </div>
        </div>
        <button className="add-remove" onClick={onRemove} title="Remove"><I.close size={15} /></button>
      </div>
      {extras && (
        <div className="add-card-extras">
          {item.duplicate && (
            <div style={{ background: "rgba(207,107,90,0.10)", border: "1px solid rgba(207,107,90,0.25)", borderRadius: 8, padding: "7px 11px", fontSize: 12, color: "#cf6b5a", display: "flex", alignItems: "center", gap: 7 }}>
              <span>⚠ Already in your hoard — "{item.duplicate.title}" · {item.duplicate.type}</span>
              <button onClick={() => onChange({ ...item, duplicate: null })} style={{ marginLeft: "auto", fontSize: 11, color: "#cf6b5a", background: "rgba(207,107,90,0.15)", border: "1px solid rgba(207,107,90,0.30)", borderRadius: 5, padding: "2px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>Add anyway</button>
            </div>
          )}
          {(item._lookupResults || []).length > 1 && (
            <div>
              <button className="alt-toggle" onClick={() => setShowAlt(v => !v)}>
                {showAlt ? "Hide alternatives" : `Wrong match? See ${item._lookupResults.length - 1} other result${item._lookupResults.length > 2 ? "s" : ""}`}
              </button>
              {showAlt && (
                <div className="alt-list">
                  {item._lookupResults.map((alt: any, i: number) => (
                    <button key={i} className="alt-item" onClick={() => applyLookupResult(alt)}>
                      {alt.cover_url
                        ? <img src={alt.cover_url} className="alt-thumb" />
                        : <div className="alt-thumb-ph" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="alt-name">{alt.title}</div>
                        {(alt.year || alt.sub) && <div className="alt-sub">{[alt.year, alt.sub].filter(Boolean).join(" · ")}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickCapture({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
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
          {/* Fix 4: Renamed "Save" to "Done" — notes are held in local state only and
              are not persisted until processed on desktop. "Save" was misleading. */}
          <button className="btn solid" disabled={!notes.length} onClick={onClose}><I.check size={16} /> Done</button>
        </div>
      </div>
    </div>
  );
}

function AddDesktop({ onClose, onAdded, ctx, ollamaModel }: {
  onClose: () => void;
  onAdded?: () => void;
  ctx: NavigationContext;
  ollamaModel: string;
}) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState("input"); // input | thinking | review
  const [statusMsg, setStatusMsg] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [isCSVImport, setIsCSVImport] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  const colls = useCollections();
  const collOpts = colls.data || [];
  const searchIndex = useSearchIndex();

  function applyDuplicateDetection(parsed: any[]) {
    const idx = searchIndex.data || [];
    return parsed.map(item => {
      const normItem = normalizeTitle(item.title);
      const existing = idx.find((e: any) => normalizeTitle(e.title || "") === normItem);
      if (existing) return { ...item, duplicate: { id: (existing as any).id, title: (existing as any).title, type: (existing as any).type } };
      return item;
    });
  }

  const lineCount = text.split("\n").map(s => s.trim()).filter(Boolean).length;

  async function analyze() {
    if (!text.trim()) return;
    setStage("thinking");
    setStatusMsg("Parsing shorthand…");

    // 1. Heuristic parse (instant)
    let parsed = parseHoardLines(text);

    // 2. Enrich each item in parallel: Ollama + online lookup
    setStatusMsg("Enriching with AI and metadata sources…");
    let metaFailed = false, ollamaFailed = false;
    parsed = await Promise.all(parsed.map(async (item: any) => {
      const [aiEnrich, onlineLookup] = await Promise.all([
        ollamaModel ? OllamaClient.enrichItem(item.raw, item.type, ollamaModel).catch(() => { ollamaFailed = true; return null; }) : null,
        lookupMetadata(item.type, item.raw).catch(() => { metaFailed = true; return null; }),
      ]);
      // Apply online lookup first (lower confidence), then AI on top (higher confidence)
      const lookupArr = onlineLookup as any[] | null;
      const afterLookup = lookupArr && lookupArr.length
        ? applyEnrichment(item, lookupArr[0], false, true)
        : item;
      const enriched = aiEnrich ? applyEnrichment(afterLookup, aiEnrich, true) : afterLookup;
      // Stash all lookup candidates so the user can switch if the top match is wrong
      return { ...enriched, _lookupResults: onlineLookup || [] };
    }));

    if (ollamaFailed) toaster.error("Ollama enrichment failed — check that Ollama is running and a model is selected.");
    if (metaFailed) toaster.error("Online metadata lookup failed — items will need manual review.");
    setIsCSVImport(false);
    setItems(applyDuplicateDetection(parsed));
    setStage("review");
  }

  async function importCSV() {
    const desktop = (window as any).hoddDesktop;
    if (desktop?.api?.pickFile) {
      const result = await desktop.api.pickFile({ filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (!result || result.canceled || !result.content) return;
      const parsed = parseCSVItems(result.content);
      if (!parsed.length) { toaster.error("No valid rows found in the CSV file."); return; }
      setIsCSVImport(true);
      setItems(applyDuplicateDetection(parsed));
      setStage("review");
    } else {
      csvFileRef.current && csvFileRef.current.click();
    }
  }

  function onCSVFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = (ev.target as any).result as string;
      const parsed = parseCSVItems(content);
      if (!parsed.length) { toaster.error("No valid rows found in the CSV file."); return; }
      setIsCSVImport(true);
      setItems(applyDuplicateDetection(parsed));
      setStage("review");
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function addExample(s: string) {
    setText(prev => (prev.trim() ? prev.replace(/\n*$/, "") + "\n" : "") + s);
    inputRef.current && inputRef.current.focus();
  }

  function confirmAdd() {
    const nameToId = Object.fromEntries(collOpts.map((c: any) => [c.name, c.id]));
    items.forEach(it => {
      const collId = nameToId[it.collection] || COLL_NAME_TO_ID[it.collection] || "games";
      addItem(collId, buildDraft(it));
    });
    invalidateCache();
    if (onAdded) onAdded();
    onClose();
    const firstName = items[0]?.collection;
    const firstCollId = (firstName && (nameToId[firstName] || COLL_NAME_TO_ID[firstName])) || "games";
    ctx.openCollection(firstCollId);
  }

  const totalAsk = items.reduce((n, it) => n + it.askCount, 0);
  const dupCount = items.filter(it => it.duplicate).length;
  const enrichLabel = ollamaModel ? "Ollama + metadata" : "online metadata";

  return (
    <div className="modal-scrim" onClick={onClose}>
      <datalist id="hodd-platform-list">
        {PLATFORM_OPTS.map((o: string) => <option key={o} value={o} />)}
      </datalist>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="t">
            <I.sparkle size={20} style={{ color: "var(--accent)" }} />
            <div>
              <div className="lbl">Add to your hoard</div>
              <h3>
                {stage === "review" ? `${items.length} item${items.length !== 1 ? "s" : ""} ready to add` : "What did you collect?"}
                {stage === "review" && isCSVImport && (
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, background: "var(--accent-wash)", color: "var(--accent)", borderRadius: 6, padding: "2px 8px", verticalAlign: "middle" }}>Import CSV</span>
                )}
              </h3>
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
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                <div className="ai-hint" style={{ margin: 0 }}><I.sparkle size={13} /> Shorthand is parsed on-device, then enriched via {enrichLabel}. Nothing saves until you confirm.</div>
                <button onClick={importCSV} style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", padding: 0, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "underline", flexShrink: 0 }}>or import from CSV</button>
              </div>
              <input ref={csvFileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onCSVFileChange} />
              <div className="add-examples">
                <span className="add-examples-lbl">Try</span>
                {ADD_EXAMPLES.map(s => <div className="chip" key={s} onClick={() => addExample(s)}>{s}</div>)}
              </div>
              {stage === "thinking" && (
                <div className="parse-status" style={{ marginTop: 20 }}>
                  <span className="ai-spinner" /> {statusMsg}
                </div>
              )}
            </>
          )}

          {stage === "review" && (
            <div className="parse">
              <div className="parse-status">
                <I.check size={16} stroke={2.4} /> Ready.{" "}
                {dupCount > 0 && (
                  <span style={{ color: "#cf6b5a" }}>{dupCount} possible duplicate{dupCount !== 1 ? "s" : ""} detected.{" "}</span>
                )}
                {totalAsk > 0
                  ? <span>{totalAsk} field{totalAsk !== 1 ? "s" : ""} still need a confirm — fill them in or leave blank.</span>
                  : <span>All fields filled in — looking good.</span>}
              </div>
              <div className="add-list">
                {items.map((it, i) => (
                  <AddCard key={it.id} item={it} collOpts={collOpts}
                    onChange={u => setItems(items.map((x, j) => j === i ? u : x))}
                    onRemove={() => setItems(items.filter((_, j) => j !== i))} />
                ))}
              </div>
              <button className="add-more" onClick={() => { setStage("input"); setIsCSVImport(false); }}><I.plus size={15} /> Add more shorthand</button>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 12, color: "var(--mute)", display: "flex", alignItems: "center", gap: 7 }}>
            <I.lock size={13} /> Runs on-device · Nothing saved until you confirm
          </div>
          {stage === "review"
            ? <button className="btn solid" disabled={!items.length} onClick={confirmAdd}><I.check size={16} /> Add {items.length} item{items.length !== 1 ? "s" : ""}</button>
            : <button className="btn solid" disabled={!lineCount || stage === "thinking"} onClick={analyze}>
                <I.sparkle size={15} /> {stage === "thinking" ? "Analysing…" : `Parse ${lineCount || ""} item${lineCount !== 1 ? "s" : ""}`}
              </button>}
        </div>
      </div>
    </div>
  );
}

function AddModal({ onClose, onAdded, ctx, ollamaModel }: {
  onClose: () => void;
  onAdded?: () => void;
  ctx: NavigationContext;
  ollamaModel: string;
}) {
  const narrow = useNarrow();
  if (narrow) return <QuickCapture onClose={onClose} />;
  return <AddDesktop onClose={onClose} onAdded={onAdded} ctx={ctx} ollamaModel={ollamaModel} />;
}

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function App() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [bootReady, setBootReady] = useState(false);

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Load persisted state, while guaranteeing the splash shows long enough to
  // breathe rather than flashing past.
  useEffect(() => {
    const minSplash = new Promise(res => setTimeout(res, 900));
    Promise.all([getSettings(), minSplash]).then(([s]) => {
      setOnboarded(s["onboarded"] === "1");
      const edits: Record<string, string> = {};
      if (s["theme"]) edits.theme = s["theme"];
      if (s["accent"] && ACCENTS[s["accent"]]) edits.accent = s["accent"];
      if (Object.keys(edits).length) setTweak(edits);
      setBootReady(true);
    });
  }, []);

  // Fix 7: Multi-window cache coherency via IPC notification.
  // Requires the preload bridge to expose on/off. If it doesn't, this is a no-op.
  // To enable: extend the preload to expose bridge.on('data-changed', handler).
  useEffect(() => {
    const bridge = (window as any).hoddDesktop;
    if (!bridge?.on) return;
    const handler = () => {
      invalidateCache();
      bumpData();
    };
    bridge.on('data-changed', handler);
    return () => bridge.off?.('data-changed', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", t.theme === "dark" ? "dark" : "light");
    const isDark = t.theme === "dark";
    const [lightVars, darkVars] = ACCENTS[t.accent] || ACCENTS["#4f46e5"];
    const [a, soft, deep] = isDark ? darkVars : lightVars;
    root.style.setProperty("--accent", a);
    root.style.setProperty("--accent-soft", soft);
    root.style.setProperty("--accent-deep", deep);
    root.style.setProperty("--accent-wash", hexA(a, isDark ? 0.20 : 0.10));
    root.style.setProperty("--gold-soft", soft);
    root.style.setProperty("--gold-deep", deep);
    root.style.setProperty("--display", HEADLINE_FONTS[t.headline] || HEADLINE_FONTS.Bricolage);
    (window as any).hoddDesktop?.setTitleBarTheme?.(t.theme === "dark" ? "dark" : "light");
  }, [t.theme, t.accent, t.headline]);

  const [view, setView] = useState("home");
  const [collId, setCollId] = useState<string | null>(null);
  const [item, setItem] = useState<any>(null);
  const [itemColl, setItemColl] = useState<any>(null);
  const [searchInit, setSearchInit] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [createCollOpen, setCreateCollOpen] = useState(false);
  const [addItemColl, setAddItemColl] = useState<{ coll: any; prefill?: any } | null>(null);
  const [dataVer, setDataVer] = useState(0);
  const bumpData = () => setDataVer(v => v + 1);
  const [topSearch, setTopSearch] = useState("");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  useEffect(() => {
    OllamaClient.getModels().then(setOllamaModels).catch(() => {});
  }, []);
  const activeOllamaModel = t.ollamaModel || ollamaModels[0] || "";
  const histRef = useRef<{ view: string; collId: string | null; item: any; itemColl: any }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchNavRef = useRef(0);

  function push(v: string) { histRef.current.push({ view, collId, item, itemColl }); setView(v); }
  function scrollTop() { if (scrollRef.current) scrollRef.current.scrollTop = 0; window.scrollTo(0, 0); }

  // Fix 2: Memoize ctx to prevent a new object reference on every render,
  // which would cause all child components receiving ctx to re-render unnecessarily.
  const ctx = React.useMemo<NavigationContext>(() => ({
    go(v: string) { push(v); scrollTop(); },
    openCollection(id: string) { histRef.current.push({ view, collId, item, itemColl }); setCollId(id); setView("collection"); scrollTop(); },
    openItem(it: any, coll: any) { histRef.current.push({ view, collId, item, itemColl }); setItem(it); setItemColl(coll || null); setView("item"); scrollTop(); },
    back() {
      const h = histRef.current.pop();
      if (h) { setView(h.view); setCollId(h.collId); setItem(h.item); setItemColl(h.itemColl); }
      else setView("home");
      scrollTop();
    },
    search(q: string) { setSearchInit(q || ""); push("search"); scrollTop(); },
    newCollection() { setCreateCollOpen(true); },
    addToCollection(coll: any, prefill?: any) { setAddItemColl({ coll, prefill }); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [view, collId, item, itemColl]);

  useEffect(() => { scrollTop(); }, [view]);

  // Fix 3: ctx added to dep array so keyboard handler always uses the current ctx.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (addOpen) { setAddOpen(false); return; }
        if (createCollOpen) { setCreateCollOpen(false); return; }
        if (addItemColl) { setAddItemColl(null); return; }
        if (view === "item") { ctx.back(); return; }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setAddOpen(v => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addOpen, createCollOpen, addItemColl, view, ctx]);

  const user = useUser();
  const greeting = greetingFor(new Date());
  const name = user.data ? user.data.name : "";
  let bar: { title?: string; subtitle?: string | null; bare?: boolean };
  if (view === "home") {
    const h = new Date().getHours();
    const homeSub = h < 5  ? "Still awake? Your hoard never sleeps."
      : h < 12 ? "Good collections start with good mornings."
      : h < 18 ? "A good afternoon to explore the hoard."
      : "Every item has a story. What will you discover tonight?";
    bar = { title: name ? `${greeting}, ${name}.` : `${greeting}.`, subtitle: homeSub };
  }
  else if (view === "collections") bar = { title: "Collections", subtitle: "Everything you value, gathered in one place." };
  else if (view === "search") bar = { title: "Search", subtitle: "Ask in plain language — Hodd translates it into your hoard." };
  else if (view === "wishlist")   bar = { title: "Wishlist", subtitle: "What's still out there." };
  else if (view === "favorites")  bar = { title: "Favorites", subtitle: "Your most treasured pieces." };
  else if (view === "timeline") bar = { title: "Timeline", subtitle: "How your collection has grown." };
  else if (view === "discover") bar = { title: "Discover", subtitle: "Find what connects, and what's missing." };
  else if (view === "series") bar = { title: "Series", subtitle: "Browse by franchise, arc, or set." };
  else if (view === "loans") bar = { title: "Loans", subtitle: "What you've borrowed and lent." };
  else if (view === "statistics") bar = { title: "Statistics", subtitle: "The shape of your hoard." };
  else if (view === "settings") bar = { title: "Settings", subtitle: null };
  else bar = { bare: true };

  let body: React.ReactNode;
  if (view === "home") body = t.homeStyle === "Dashboard" ? <Home ctx={ctx} /> : <HomeNew ctx={ctx} art={t.shelfArt} />;
  else if (view === "collections") body = t.collStyle === "Cards" ? <Collections ctx={ctx} /> : <CollectionsNew ctx={ctx} art={t.shelfArt} />;
  else if (view === "collection") body = <CollectionDetail collId={collId ?? ""} ctx={ctx} />;
  else if (view === "item") body = <ItemDetail item={item} collection={itemColl} ctx={ctx} ollamaModel={activeOllamaModel} />;
  else if (view === "search") body = <SearchView initial={searchInit} ctx={ctx} ollamaModel={activeOllamaModel} />;
  else if (view === "statistics") body = <Statistics ctx={ctx} />;
  else if (view === "wishlist")   body = <Wishlist ctx={ctx} />;
  else if (view === "favorites")  body = <Favorites ctx={ctx} />;
  else if (view === "timeline")   body = <Timeline ctx={ctx} />;
  else if (view === "discover")   body = <Discover ctx={ctx} />;
  else if (view === "series")     body = <SeriesView ctx={ctx} />;
  else if (view === "loans")      body = <LoanView ctx={ctx} />;
  else if (view === "settings")   body = <Settings onSaved={user.refetch} />;
  else body = <ComingSoon name={bar.title || "Coming soon"} />;

  const activeNav = ["collection"].includes(view) ? "collections" : ["item"].includes(view) ? null : view;

  const navTo = (id: string) => {
    if (id === "search") { ctx.search(""); return; }
    setCollId(null); setItem(null); setItemColl(null);
    histRef.current = []; setView(id); scrollTop();
  };

  if (!bootReady || onboarded === null) return <LoadingScreen />;
  if (onboarded === false) return (
    <Onboarding onDone={(prefs: any) => {
      if (prefs) setTweak({ theme: prefs.theme, accent: prefs.accent });
      user.refetch();
      setOnboarded(true);
    }} />
  );

  return (
    <div className="app">
      <Sidebar active={activeNav} onNav={navTo} user={user.data ?? undefined} onSettings={() => navTo("settings")} />
      <MobileTopBar onAdd={() => setAddOpen(true)} />
      <div className="main" ref={scrollRef} style={{ height: "100vh", overflowY: "auto" }}>
        <div className="canvas">
          <Topbar {...bar}
            onAdd={() => setAddOpen(true)}
            onSearch={() => {
              // Fix 5: Renamed local timestamp variable from `t` to `ts` to avoid
              // shadowing the outer `t` (tweak values) variable.
              const ts = Date.now();
              if (view !== "search" && ts - searchNavRef.current > 50) { searchNavRef.current = ts; ctx.search(""); }
            }}
            searchValue={topSearch}
            onSearchChange={setTopSearch}
            onSearchSubmit={(q: string) => { setTopSearch(""); ctx.search(q); }} />
          <div key={view + ":" + collId + ":" + dataVer}>{body}</div>
        </div>
      </div>
      <MobileTabs active={activeNav} onNav={navTo} />
      {addOpen && <AddModal onClose={() => setAddOpen(false)} onAdded={bumpData} ctx={ctx} ollamaModel={activeOllamaModel} />}
      {createCollOpen && <CreateCollectionModal
        onClose={() => setCreateCollOpen(false)}
        onCreated={(rec: any) => { setCreateCollOpen(false); bumpData(); ctx.openCollection(rec.id); }} />}
      {addItemColl && <AddItemModal collection={addItemColl.coll} prefill={addItemColl.prefill}
        onClose={() => setAddItemColl(null)}
        onAdded={(_rec: any) => { setAddItemColl(null); bumpData(); }} />}
      <Toaster />
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
          options={["#4f46e5", "#0d9488", "#e2503b", "#2563eb", "#7c3aed", "#d97706"]}
          onChange={v => setTweak("accent", v as string)} />
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
