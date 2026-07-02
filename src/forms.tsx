import React from 'react';
import { I, typeIcon } from './icons';
import { createCollection, addItem } from './api';

// ── TypeScript interfaces ─────────────────────────────────────────────────────

interface CollectionRecord {
  id: string;
  name: string;
  type: string;
  accent: string;
  template?: string[];
  [key: string]: unknown;
}

export interface ItemRecord {
  id?: string;
  title?: string | null;
  sub?: string | null;
  year?: number | null;
  type?: string | null;
  series?: string | null;
  series_number?: number | null;
  region?: string | null;
  cover_url?: string | null;
  gallery?: string[] | null;
  color?: string | null;
  format?: string | null;
  condition?: string | null;
  acquired?: string | null;
  completeness?: string | null;
  grade?: string | null;
  pressing?: string | null;
  edition?: string | null;
  notes?: string | null;
  loan_from?: string | null;
  loan_date?: string | null;
  purchase_price?: number | null;
  purchase_currency?: string | null;
  current_value?: number | null;
  loan_to?: string | null;
  loan_to_date?: string | null;
  watched?: boolean | null;
  completed?: boolean | null;
  owned?: boolean | null;
  ownership?: string | null;
  custom?: Array<{ label: string; value: string }> | null;
  [key: string]: unknown;
}

interface ItemEditFormProps {
  item: ItemRecord;
  type?: string;
  subLabel?: string;
  story?: string[];
  onCancel: () => void;
  onSave: (data: {
    owned: boolean;
    holding?: Record<string, unknown>;
    canonical: Record<string, unknown>;
    story: string[];
  }) => void;
}

export interface ItemEditFormHandle {
  trySave: () => void;
}

interface AddItemModalProps {
  collection: CollectionRecord;
  onClose: () => void;
  onAdded: (rec: ItemRecord) => void;
  prefill?: Partial<ItemRecord> | null;
}

interface CreateCollectionModalProps {
  onClose: () => void;
  onCreated: (rec: CollectionRecord) => void;
}

interface CustomRow {
  id: string;
  label: string;
  value: string;
}

export const FORMAT_OPTIONS: Record<string, string[]> = {
  game:  ["Cartridge", "Disc", "Steam", "Epic Games", "GOG", "Xbox Game Pass", "PS Plus", "Nintendo eShop", "Battle.net", "Ubisoft Connect", "EA App", "itch.io", "Local file (ROM/ISO)"],
  book:  ["Hardcover", "Paperback", "Mass market", "Kindle", "Kobo", "Apple Books", "Google Play Books", "Local file (EPUB/PDF)"],
  movie: ["4K Blu-ray", "Blu-ray", "DVD", "VHS", "Apple TV+", "Amazon", "Disney+", "Vudu", "Google Play", "Local file (MKV/MP4)"],
  coin:  ["Silver dollar", "Gold", "Silver", "Copper", "Proof set"],
  vinyl: ["Vinyl LP", "7\" single", "Boxed set", "Picture disc"],
  comic: ["Single issue", "Trade paperback", "Hardcover", "Omnibus", "Comixology", "Local file (CBZ/PDF)"],
};
export const CONDITION_OPTIONS = ["Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"];
export const COMPLETENESS_OPTIONS = ["Complete in box", "Loose", "Sealed", "Manual only"];
export const TYPE_OPTIONS = [["game", "Game"], ["book", "Book"], ["movie", "Movie"], ["coin", "Coin"], ["vinyl", "Vinyl"], ["comic", "Comic"], ["other", "Other / custom"]];
export const OWNERSHIP_OPTIONS: [string, string][] = [
  ["owned",        "Owned"],
  ["borrowed",     "Borrowed"],
  ["subscription", "Subscription"],
  ["wishlist",     "Wishlist"],
];
export const OWNERSHIP_LABEL: Record<string, string> = Object.fromEntries(OWNERSHIP_OPTIONS);
export const SUBLABELS: Record<string, string> = { book: "Author", game: "Platform", coin: "Mint", vinyl: "Artist", movie: "Director", comic: "Publisher", other: "Detail" };

export const PLATFORMS_BY_MAKER: Record<string, string[]> = {
  Nintendo: ["NES", "SNES", "Nintendo 64", "GameCube", "Wii", "Wii U", "Switch", "Nintendo Switch 2", "Game Boy", "Game Boy Color", "Game Boy Advance", "DS", "3DS", "Game & Watch"],
  Sony:     ["PS1", "PS2", "PS3", "PS4", "PS5", "PSP", "PS Vita"],
  Microsoft: ["Xbox", "Xbox 360", "Xbox One", "Xbox Series X", "Xbox Series S"],
  Sega:     ["Sega Master System", "Sega Genesis", "Sega Saturn", "Dreamcast", "Game Gear"],
  Atari:    ["Atari 2600", "Atari 5200", "Atari 7800", "Atari Lynx", "Atari Jaguar"],
  Other:    ["Neo Geo", "TurboGrafx-16", "Steam Deck", "PC", "Mac", "Arcade"],
};

export const PLATFORM_OPTS = Object.values(PLATFORMS_BY_MAKER).flat();

export function makerFor(platform: string): string {
  for (const [maker, consoles] of Object.entries(PLATFORMS_BY_MAKER)) {
    if (consoles.includes(platform)) return maker;
  }
  return "";
}

export function PlatformPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const knownMaker = makerFor(value);
  const [maker, setMaker] = React.useState(knownMaker);
  const consoles = maker ? (PLATFORMS_BY_MAKER[maker] || []) : [];
  const makerOptions = Object.keys(PLATFORMS_BY_MAKER);

  function handleMaker(m: string) {
    setMaker(m);
    onChange("");
  }

  function handleConsole(c: string) {
    onChange(c);
  }

  return (
    <div className="ef-platform-picker">
      <label className="ef-field">
        <span className="ef-k">Maker</span>
        <div className="ef-select-wrap">
          <select className="ef-control" value={maker} onChange={e => handleMaker(e.target.value)}>
            <option value="">—</option>
            {makerOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="ef-chev">▾</span>
        </div>
      </label>
      <label className="ef-field">
        <span className="ef-k">Platform</span>
        <div className="ef-select-wrap">
          <select className="ef-control" value={value || ""} onChange={e => handleConsole(e.target.value)} disabled={!maker}>
            <option value="">—</option>
            {consoles.map(c => {
              const prefix = maker + ' ';
              const label = c.startsWith(prefix) ? c.slice(prefix.length) : c;
              return <option key={c} value={c}>{label}</option>;
            })}
            {value && !consoles.includes(value) && <option value={value}>{value}</option>}
          </select>
          <span className="ef-chev">▾</span>
        </div>
      </label>
    </div>
  );
}

export const ACCENT_SWATCHES = ["#6366f1", "#5BA47A", "#5C8AD6", "#C9A24C", "#CF6B5A", "#7FB0C4", "#9B7BD4", "#C0392B"];
export const COVER_COLORS = [
  "#6366f1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#14B8A6", "#3B82F6", "#6B7280",
  "#92400E", "#1E3A5F", "#7B2D8B", "#C0392B", "#2D5016",
];

function withCurrent(options: string[] = [], current: string): string[] {
  if (current && options.indexOf(current) === -1) return [current].concat(options);
  return options;
}

function parseSeriesNumber(title: string): number | null {
  if (!title) return null;
  const m =
    title.match(/\s#\s*(\d+(?:\.\d+)?)/i) ||
    title.match(/\s(?:vol\.?|volume)\s*(\d+(?:\.\d+)?)/i) ||
    title.match(/\s(?:book|part|ep\.?|episode|chapter)\s+(\d+(?:\.\d+)?)/i);
  if (m) return parseFloat(m[1]);
  const ROMAN: Record<string, number> = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13,XIV:14,XV:15,XVI:16,XVII:17,XVIII:18,XIX:19,XX:20 };
  const rm = title.match(/\s+((?:X{0,2})(?:IX|IV|V?I{0,3}))\s*$/i);
  if (rm && ROMAN[rm[1].toUpperCase()]) return ROMAN[rm[1].toUpperCase()];
  return null;
}

interface EFSelectProps {
  label: string;
  value: string;
  options?: string[];
  pairs?: [string, string][];
  placeholder?: string | false;
  onChange: (v: string) => void;
}

export function EFSelect({ label, value, options, pairs, placeholder, onChange }: EFSelectProps) {
  const opts = pairs || withCurrent(options ?? [], value).map(o => [o, o] as [string, string]);
  return (
    <label className="ef-field">
      <span className="ef-k">{label}</span>
      <div className="ef-select-wrap">
        <select className="ef-control" value={value || ""} onChange={e => onChange(e.target.value)}>
          {placeholder !== false && <option value="">{placeholder || "—"}</option>}
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="ef-chev">▾</span>
      </div>
    </label>
  );
}

interface EFTextProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  wide?: boolean;
}

export function EFText({ label, value, placeholder, onChange, wide }: EFTextProps) {
  return (
    <label className={"ef-field" + (wide ? " ef-wide" : "")}>
      <span className="ef-k">{label}</span>
      <input className="ef-control" type="text" value={value || ""} placeholder={placeholder || ""}
        onChange={e => onChange(e.target.value)} />
    </label>
  );
}

interface EFComboboxProps {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
}

export function EFCombobox({ label, value, options, placeholder, onChange }: EFComboboxProps) {
  const listId = "dl-" + (label || "").toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="ef-field">
      <span className="ef-k">{label}</span>
      <input
        className="ef-control"
        list={listId}
        value={value || ""}
        placeholder={placeholder || ""}
        onChange={e => onChange(e.target.value)}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </label>
  );
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return s;
}

interface EFDateProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function EFDate({ label, value, onChange }: EFDateProps) {
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
  return (
    <label className="ef-field">
      <span className="ef-k">{label}</span>
      <input className="ef-control ef-date" type="date" value={isoValue}
        onChange={e => onChange(e.target.value)} />
    </label>
  );
}

interface EFTextareaProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}

export function EFTextarea({ label, value, placeholder, onChange }: EFTextareaProps) {
  return (
    <label className="ef-field ef-wide">
      <span className="ef-k">{label}</span>
      <textarea className="ef-control ef-textarea" rows={5} value={value || ""} placeholder={placeholder || ""}
        onChange={e => onChange(e.target.value)} />
      <span className="ef-hint">Separate paragraphs with a blank line.</span>
    </label>
  );
}

interface EFToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: [string, string];
}

export function EFToggle({ label, value, onChange, hint }: EFToggleProps) {
  return (
    <div className="ef-field">
      <span className="ef-k">{label}</span>
      <button type="button" className={"ef-toggle" + (value ? " on" : "")} onClick={() => onChange(!value)}>
        <span className="ef-knob" />
        <span className="ef-toggle-lbl">{value ? (hint ? hint[0] : "Yes") : (hint ? hint[1] : "No")}</span>
      </button>
    </div>
  );
}

const ipc = () => (window as any).hoddDesktop?.api;

export const ItemEditForm = React.forwardRef<ItemEditFormHandle, ItemEditFormProps>(
function ItemEditForm({ item, type, subLabel, story, onCancel, onSave }, ref) {
  const init = {
    format: item.format && item.format !== "—" && item.format !== "Owned" ? item.format : "",
    completeness: item.completeness || "",
    grade: item.grade || "",
    pressing: item.pressing || "",
    edition: item.edition || "",
    condition: item.condition || "",
    acquired: item.acquired || "",
    watched: !!item.watched,
    completed: !!item.completed,
    notes: item.notes || "",
    loan_from: item.loan_from || "",
    loan_date: item.loan_date || "",
    purchase_price: item.purchase_price ? String(item.purchase_price) : "",
    purchase_currency: item.purchase_currency || "USD",
    current_value: item.current_value ? String(item.current_value) : "",
    loan_to: item.loan_to || "",
    loan_to_date: item.loan_to_date || "",
  };
  const initOwnership = item.ownership || (item.owned !== false ? "owned" : "wishlist");
  const [ownership, setOwnership] = React.useState(initOwnership);
  const [f, setF] = React.useState(init);
  const [c, setC] = React.useState({
    title: item.title || "",
    sub: item.sub || "",
    year: item.year != null ? String(item.year) : "",
    type: item.type || type || "other",
    series: item.series || "",
    region: item.region || "",
    series_number: item.series_number != null ? String(item.series_number) : "",
  });
  const [custom, setCustom] = React.useState<CustomRow[]>(
    Array.isArray(item.custom) && item.custom.length
      ? item.custom.map(x => ({ id: crypto.randomUUID(), label: x.label || "", value: x.value || "" }))
      : []
  );
  const [storyText, setStoryText] = React.useState((story || []).join("\n\n"));
  const [color, setColor] = React.useState(item.color || COVER_COLORS[0]);
  const [titleEmpty, setTitleEmpty] = React.useState(false);

  // Photo state
  const originalGallery = React.useRef(Array.isArray(item.gallery) ? item.gallery : []);
  const [coverUrl, setCoverUrl] = React.useState(item.cover_url || null);
  const [gallery, setGallery] = React.useState(Array.isArray(item.gallery) ? item.gallery : []);

  // Track if user explicitly cleared the series_number field
  const userClearedSeriesRef = React.useRef(false);

  const set = (k: string, v: unknown) => setF(prev => ({ ...prev, [k]: v }));
  const setCan = (k: string, v: unknown) => setC(prev => ({ ...prev, [k]: v as string }));
  const setRow = (id: string, k: string, v: string) => setCustom(p => p.map(r => r.id === id ? { ...r, [k]: v } : r));
  const addRow = () => setCustom(p => [...p, { id: crypto.randomUUID(), label: "", value: "" }]);
  const delRow = (id: string) => setCustom(p => p.filter(r => r.id !== id));

  React.useEffect(() => {
    if (userClearedSeriesRef.current) return; // don't override user's intent
    if (c.series.trim() && !c.series_number) {
      const n = parseSeriesNumber(c.title);
      if (n !== null) setCan("series_number", String(n));
    }
  }, [c.title, c.series]);

  async function pickCoverPhoto() {
    const a = ipc(); if (!a) return;
    const result = await a.pickImage(false);
    if (result?.canceled || !result?.files?.length) return;
    const filename = result.files[0];
    setCoverUrl(filename);
    setGallery((g: string[]) => g.includes(filename) ? g : [filename, ...g]);
  }

  async function addGalleryPhotos() {
    const a = ipc(); if (!a) return;
    const result = await a.pickImage(true);
    if (result?.canceled || !result?.files?.length) return;
    setGallery((g: string[]) => {
      const existing = new Set(g);
      return [...g, ...result.files.filter((f: string) => !existing.has(f))];
    });
  }

  function removeGalleryPhoto(filename: string) {
    setGallery((g: string[]) => g.filter(f => f !== filename));
    if (coverUrl === filename) setCoverUrl(null);
  }

  function handleCancel() {
    // Delete any newly picked images (they'd be orphaned if we don't save)
    const a = ipc();
    if (a) {
      const orig = new Set(originalGallery.current);
      gallery.filter((f: string) => !orig.has(f)).forEach((f: string) => a.deleteImage(f));
      if (coverUrl && !orig.has(coverUrl) && !gallery.includes(coverUrl)) a.deleteImage(coverUrl);
    }
    onCancel();
  }

  const etype = c.type || "other";
  const eSub = SUBLABELS[etype] || "Detail";

  const yearRaw = c.year.trim();
  const yearNum = yearRaw ? parseInt(yearRaw, 10) : null;
  const yearError = yearRaw && (!Number.isFinite(yearNum) || yearNum! < 1000 || yearNum! > 2099)
    ? "Year must be a number between 1000 and 2099"
    : null;
  const titleError = c.title.trim().length > 300 ? "Title is too long (max 300 characters)" : null;

  React.useImperativeHandle(ref, () => ({
    trySave: () => { if (c.title.trim() && !yearError && !titleError) handleSave(); },
  }));

  function handleSave() {
    if (!c.title.trim()) {
      setTitleEmpty(true);
      return;
    }
    setTitleEmpty(false);
    if (yearError || titleError) return;
    const canonical = {
      title: c.title.trim() || item.title,
      sub: c.sub.trim() || null,
      year: Number.isFinite(yearNum) ? yearNum : (yearRaw ? item.year : null),
      type: etype,
      series: c.series.trim() || null,
      series_number: c.series_number !== "" ? (parseFloat(c.series_number) || null) : null,
      region: c.region.trim() || null,
      cover_url: coverUrl || null,
      gallery: gallery.length ? gallery : null,
      color: color || null,
    };
    const customClean = custom
      .map(r => ({ label: r.label.trim(), value: r.value.trim() }))
      .filter(r => r.label && r.value);
    const paragraphs = storyText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    // Delete images that were removed during this edit session
    const a = ipc();
    if (a) {
      const next = new Set(gallery);
      originalGallery.current.filter((f: string) => !next.has(f)).forEach((f: string) => a.deleteImage(f));
    }
    if (ownership === "wishlist") { onSave({ owned: false, canonical, story: paragraphs }); return; }
    const holding: Record<string, unknown> = {
      ownership,
      format: f.format || null,
      condition: f.condition || null,
      acquired: f.acquired || null,
      custom: customClean.length ? customClean : null,
      notes: f.notes || null,
      loan_from: ownership === "borrowed" ? (f.loan_from || null) : null,
      loan_date: ownership === "borrowed" ? (f.loan_date || null) : null,
      purchase_price: f.purchase_price ? parseFloat(f.purchase_price) || null : null,
      purchase_currency: f.purchase_currency || "USD",
      current_value: f.current_value ? parseFloat(f.current_value) || null : null,
      loan_to: ownership === "owned" ? (f.loan_to || null) : null,
      loan_to_date: ownership === "owned" ? (f.loan_to_date || null) : null,
    };
    if (etype === "game")  { holding.completeness = f.completeness || null; holding.completed = f.completed; }
    if (etype === "coin")  holding.grade = f.grade || null;
    if (etype === "vinyl") holding.pressing = f.pressing || null;
    if (etype === "book")  { holding.edition = f.edition || null; holding.watched = f.watched; }
    if (etype === "movie") holding.watched = f.watched;
    onSave({ owned: true, holding, canonical, story: paragraphs });
  }

  return (
    <div className="edit-form">
      <div className="ef-head">
        <div className="ef-title">Edit item</div>
        <EFSelect label="Status" value={ownership} pairs={OWNERSHIP_OPTIONS} placeholder={false} onChange={setOwnership} />
      </div>

      <div className="ef-section ef-section-row">
        <span>Photos</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="ef-add" onClick={pickCoverPhoto}>
            <I.image size={14} stroke={1.8} /> {coverUrl ? "Change cover" : "Set cover"}
          </button>
          <button type="button" className="ef-add" onClick={addGalleryPhotos}>
            <I.plus size={14} stroke={2} /> Add photos
          </button>
        </div>
      </div>
      {gallery.length > 0 ? (
        <div className="ef-gallery">
          {gallery.map((filename: string) => (
            <div key={filename} className={"ef-gallery-thumb" + (filename === coverUrl ? " is-cover" : "")}>
              <img src={`hodd-img://${filename}`} alt="" />
              {filename !== coverUrl && (
                <button type="button" className="ef-gallery-set" title="Set as cover"
                  onClick={() => setCoverUrl(filename)}>
                  <I.image size={11} stroke={2} />
                </button>
              )}
              {filename === coverUrl && (
                <span className="ef-gallery-cover-badge">Cover</span>
              )}
              <button type="button" className="ef-gallery-del" title="Remove photo"
                onClick={() => removeGalleryPhoto(filename)}>
                <I.close size={12} stroke={2.2} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="ef-empty">No photos yet — add a cover photo or gallery shots for this item.</div>
      )}

      <div className="ef-section">Item details</div>
      <div className="ef-grid">
        <EFText label="Title" value={c.title} placeholder="Item title" onChange={v => { setCan("title", v); if (v.trim()) setTitleEmpty(false); }} wide />
        {titleEmpty && <div className="ef-error">Title is required</div>}
        {titleError && <div className="ef-error">{titleError}</div>}
        <EFSelect label="Type" value={etype} pairs={TYPE_OPTIONS as [string, string][]} placeholder={false} onChange={v => setCan("type", v)} />
        {!coverUrl && <ColorPicker value={color} onChange={setColor} />}
        {etype === "game"
          ? <PlatformPicker value={c.sub || ""} onChange={v => setCan("sub", v)} />
          : <EFText label={eSub} value={c.sub} placeholder={eSub} onChange={v => setCan("sub", v)} />}
        <EFText label="Year" value={c.year} placeholder="e.g. 1996" onChange={v => setCan("year", v)} />
        {yearError && <div className="ef-error">{yearError}</div>}
        <EFText label="Series" value={c.series} placeholder="e.g. Dune, Pokémon" onChange={v => setCan("series", v)} />
        <EFText
          label="# in series"
          value={c.series_number}
          placeholder="e.g. 4 or 4.5"
          onChange={v => {
            if (!v.trim()) {
              userClearedSeriesRef.current = true;
            }
            setCan("series_number", v);
          }}
        />
        {etype === "game" && <EFText label="Region" value={c.region} placeholder="e.g. NTSC, PAL, JPN" onChange={v => setCan("region", v)} />}
      </div>

      {ownership !== "wishlist" ? (
        <>
          <div className="ef-section">Your copy</div>
          <div className="ef-grid">
            <EFSelect label="Format" value={f.format} options={FORMAT_OPTIONS[etype] ?? []} placeholder="Medium" onChange={v => set("format", v)} />
            {etype === "game"  && <EFSelect label="Completeness" value={f.completeness} options={COMPLETENESS_OPTIONS} placeholder="How complete" onChange={v => set("completeness", v)} />}
            {etype === "coin"  && <EFText label="Grade" value={f.grade} placeholder="e.g. MS-63" onChange={v => set("grade", v)} />}
            {etype === "vinyl" && <EFText label="Pressing" value={f.pressing} placeholder="e.g. 180g" onChange={v => set("pressing", v)} />}
            {etype === "book"  && <EFText label="Edition" value={f.edition} placeholder="e.g. First Edition" onChange={v => set("edition", v)} />}
            <EFSelect label="Condition" value={f.condition} options={CONDITION_OPTIONS} placeholder="Condition" onChange={v => set("condition", v)} />
            <EFDate label="Acquired" value={f.acquired} onChange={v => set("acquired", v)} />
            <EFText label="Purchase price" value={f.purchase_price} placeholder="e.g. 25.00" onChange={v => set("purchase_price", v)} />
            <EFSelect label="Currency" value={f.purchase_currency} options={["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "DKK", "SEK", "NOK", "CHF"]} placeholder={false} onChange={v => set("purchase_currency", v)} />
            <EFText label="Current value" value={f.current_value} placeholder="Estimated market value" onChange={v => set("current_value", v)} />
            {etype === "movie" && <EFToggle label="Watched" value={f.watched} onChange={v => set("watched", v)} hint={["Yes", "Not yet"]} />}
            {etype === "book"  && <EFToggle label="Read" value={f.watched} onChange={v => set("watched", v)} hint={["Yes", "Not yet"]} />}
            {etype === "game"  && <EFToggle label="Completed" value={f.completed} onChange={v => set("completed", v)} hint={["Yes", "Not yet"]} />}
            {ownership === "borrowed" && (
              <>
                <EFText label="Borrowed from" value={f.loan_from} placeholder="Name or place" onChange={v => set("loan_from", v)} />
                <EFDate label="Since" value={f.loan_date} onChange={v => set("loan_date", v)} />
              </>
            )}
            {ownership === "owned" && (
              <>
                <EFText label="Lent to" value={f.loan_to} placeholder="Who has it?" onChange={v => set("loan_to", v)} />
                <EFDate label="Since (lent)" value={f.loan_to_date} onChange={v => set("loan_to_date", v)} />
              </>
            )}
            <EFText label="Notes" value={f.notes} placeholder="Quick note about this copy…" onChange={v => set("notes", v)} wide />
          </div>

          <div className="ef-section ef-section-row">
            <span>More details</span>
            <button type="button" className="ef-add" onClick={addRow}><I.plus size={14} stroke={2} /> Add field</button>
          </div>
          {custom.length === 0
            ? <div className="ef-empty">Collecting something unusual? Add your own fields — Movement, Reference, Colorway, Size, anything.</div>
            : <div className="ef-custom">
                {custom.map((r) => (
                  <div className="ef-custom-row" key={r.id}>
                    <input className="ef-control" placeholder="Field name" value={r.label} onChange={e => setRow(r.id, "label", e.target.value)} />
                    <input className="ef-control" placeholder="Value" value={r.value} onChange={e => setRow(r.id, "value", e.target.value)} />
                    <button type="button" className="ef-del" onClick={() => delRow(r.id)} title="Remove field"><I.trash size={16} /></button>
                  </div>
                ))}
              </div>}
        </>
      ) : (
        <div className="ef-removed">This item will be marked as missing — its personal details are cleared, but it stays in the catalog so you can re-add it anytime.</div>
      )}

      <div className="ef-section">The story</div>
      <div className="ef-grid">
        <EFTextarea label="" value={storyText} placeholder={"Write what this piece means to you — how you found it, why it matters…"} onChange={setStoryText} />
      </div>

      <div className="ef-actions">
        <button className="btn" onClick={handleCancel}>Cancel</button>
        <button className="btn solid" disabled={!!(yearError || titleError)} onClick={handleSave}><I.check size={16} stroke={2.2} /> Save changes</button>
      </div>
    </div>
  );
});

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="ef-field">
      <span className="ef-k">Cover color</span>
      <div className="accent-swatches">
        {COVER_COLORS.map(c => (
          <button type="button" key={c} className={"swatch" + (value === c ? " on" : "")}
            style={{ background: c }} onClick={() => onChange(c)} aria-label={c}>
            {value === c && <I.check size={15} stroke={2.6} />}
          </button>
        ))}
      </div>
    </div>
  );
}

interface AccentPickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function AccentPicker({ value, onChange }: AccentPickerProps) {
  return (
    <div className="ef-field">
      <span className="ef-k">Accent</span>
      <div className="accent-swatches">
        {ACCENT_SWATCHES.map(c => (
          <button type="button" key={c} className={"swatch" + (value === c ? " on" : "")}
            style={{ background: c }} onClick={() => onChange(c)} aria-label={c}>
            {value === c && <I.check size={15} stroke={2.6} />}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TemplateEditorProps {
  rows: string[];
  setRows: (rows: string[]) => void;
}

export function TemplateEditor({ rows, setRows }: TemplateEditorProps) {
  const setRow = (i: number, v: string) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const add = () => setRows([...rows, ""]);
  const del = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  return (
    <div>
      <div className="ef-section ef-section-row" style={{ marginTop: 4 }}>
        <span>Default fields</span>
        <button type="button" className="ef-add" onClick={add}><I.plus size={14} stroke={2} /> Add field</button>
      </div>
      <div className="ef-hint" style={{ marginBottom: 12 }}>Every item you add to this collection starts with these — e.g. Movement, Reference, Colorway, Scale.</div>
      {rows.length === 0
        ? <div className="ef-empty">No default fields yet. Built-in details (format, condition, acquired) are always included.</div>
        : <div className="ef-custom">
            {rows.map((r, i) => (
              <div className="tmpl-row" key={i}>
                <input className="ef-control" placeholder="Field name" value={r} onChange={e => setRow(i, e.target.value)} />
                <button type="button" className="ef-del" onClick={() => del(i)} title="Remove"><I.trash size={16} /></button>
              </div>
            ))}
          </div>}
    </div>
  );
}

export function CreateCollectionModal({ onClose, onCreated }: CreateCollectionModalProps) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("other");
  const [accent, setAccent] = React.useState(ACCENT_SWATCHES[0]);
  const [tmpl, setTmpl] = React.useState<string[]>([]);

  function create() {
    if (!name.trim()) return;
    const rec = createCollection({
      name, type, accent,
      template: tmpl.map(s => s.trim()).filter(Boolean),
    });
    onCreated(rec as CollectionRecord);
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="t">
            <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: accent, color: "#fff", flex: "0 0 auto" }}>
              {typeIcon(type, { size: 20, stroke: 1.8 })}
            </span>
            <div>
              <div className="lbl">New collection</div>
              <h3>{name.trim() || "Name your collection"}</h3>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: 38, height: 38 }}><I.close size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="ef-grid">
            <EFText label="Name" value={name} placeholder="e.g. Wristwatches" onChange={setName} wide />
            <EFSelect label="Type" value={type} pairs={TYPE_OPTIONS as [string, string][]} placeholder={false} onChange={setType} />
            <AccentPicker value={accent} onChange={setAccent} />
          </div>
          <TemplateEditor rows={tmpl} setRows={setTmpl} />
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 12, color: "var(--mute)", display: "flex", alignItems: "center", gap: 7 }}>
            <I.lock size={13} /> Saved on this device
          </div>
          <button className="btn solid" disabled={!name.trim()} onClick={create}><I.check size={16} /> Create collection</button>
        </div>
      </div>
    </div>
  );
}

export function AddItemModal({ collection, onClose, onAdded, prefill = null }: AddItemModalProps) {
  const type = collection.type || "other";
  const subLabel = SUBLABELS[type] || "Detail";
  const [owned, setOwned] = React.useState(true);
  const [c, setC] = React.useState({
    title:  prefill?.title  ?? "",
    sub:    prefill?.sub    ?? "",
    year:   prefill?.year   ? String(prefill.year) : "",
    series: prefill?.series ?? "",
    region: "",
  });
  const [f, setF] = React.useState({ format: "", completeness: "", grade: "", pressing: "", edition: "", condition: "", acquired: "", watched: false, completed: false, purchase_price: "", purchase_currency: "USD", current_value: "" });
  const [custom, setCustom] = React.useState<CustomRow[]>((collection.template || []).map(l => ({ id: crypto.randomUUID(), label: l, value: "" })));
  const [addError, setAddError] = React.useState<string | null>(null);
  const setCan = (k: string, v: string) => setC(p => ({ ...p, [k]: v }));
  const set = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));
  const setRow = (id: string, k: string, v: string) => setCustom(p => p.map(r => r.id === id ? { ...r, [k]: v } : r));
  const addRow = () => setCustom(p => [...p, { id: crypto.randomUUID(), label: "", value: "" }]);
  const delRow = (id: string) => setCustom(p => p.filter(r => r.id !== id));

  const addYearRaw = c.year.trim();
  const addYearNum = addYearRaw ? parseInt(addYearRaw, 10) : null;
  const addYearError = addYearRaw && (!Number.isFinite(addYearNum) || addYearNum! < 1000 || addYearNum! > 2099)
    ? "Year must be a number between 1000 and 2099"
    : null;

  function add() {
    if (!c.title.trim() || addYearError) return;
    const customClean = custom.map(r => ({ label: r.label.trim(), value: r.value.trim() })).filter(r => r.label && r.value);
    const draft: Record<string, unknown> = {
      title: c.title.trim(), sub: c.sub.trim() || null, type,
      year: Number.isFinite(addYearNum) ? addYearNum : null, owned,
      ...(c.series.trim() ? { series: c.series.trim() } : {}),
      ...(c.region.trim() ? { region: c.region.trim() } : {}),
      ...(prefill?.cover_url ? { cover_url: prefill.cover_url } : {}),
    };
    if (owned) {
      draft.format = f.format || null;
      draft.condition = f.condition || null;
      draft.acquired = f.acquired || null;
      draft.purchase_price = f.purchase_price ? parseFloat(f.purchase_price) || null : null;
      draft.purchase_currency = f.purchase_currency || "USD";
      draft.current_value = f.current_value ? parseFloat(f.current_value) || null : null;
      if (type === "game")  { draft.completeness = f.completeness || null; draft.completed = f.completed; }
      if (type === "coin")  draft.grade = f.grade || null;
      if (type === "vinyl") draft.pressing = f.pressing || null;
      if (type === "book")  { draft.edition = f.edition || null; draft.watched = f.watched; }
      if (type === "movie") draft.watched = f.watched;
      if (customClean.length) draft.custom = customClean;
    }
    try {
      const rec = addItem(collection.id, draft);
      onAdded(rec as ItemRecord);
    } catch (err) {
      console.error('[AddItemModal] addItem failed:', err);
      setAddError('Failed to add item. Please try again.');
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="t">
            <span style={{ color: collection.accent, display: "flex", flex: "0 0 auto" }}>{typeIcon(type, { size: 22, stroke: 1.7 })}</span>
            <div>
              <div className="lbl">Add to {collection.name}</div>
              <h3>{c.title.trim() || "New item"}</h3>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ width: 38, height: 38 }}><I.close size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="ef-head" style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border-soft)" }}>
            <div className="ef-title">Item details</div>
            <EFToggle label="In collection" value={owned} onChange={setOwned} hint={["Owned", "Wishlist"]} />
          </div>
          {addError && (
            <div className="ef-error" style={{ marginBottom: 12 }}>{addError}</div>
          )}
          <div className="ef-grid">
            <EFText label="Title" value={c.title} placeholder="Item title" onChange={v => setCan("title", v)} wide />
            {type === "game"
              ? <PlatformPicker value={c.sub || ""} onChange={v => setCan("sub", v)} />
              : <EFText label={subLabel} value={c.sub} placeholder={subLabel} onChange={v => setCan("sub", v)} />}
            <EFText label="Year" value={c.year} placeholder="e.g. 1996" onChange={v => setCan("year", v)} />
            {addYearError && <div className="ef-error">{addYearError}</div>}
            <EFText label="Series" value={c.series} placeholder="e.g. Dune, Pokémon" onChange={v => setCan("series", v)} />
            {type === "game" && <EFText label="Region" value={c.region} placeholder="e.g. NTSC, PAL, JPN" onChange={v => setCan("region", v)} />}
          </div>

          {owned && (
            <>
              <div className="ef-section">Your copy</div>
              <div className="ef-grid">
                <EFSelect label="Format" value={f.format} options={FORMAT_OPTIONS[type] ?? []} placeholder="Medium" onChange={v => set("format", v)} />
                {type === "game"  && <EFSelect label="Completeness" value={f.completeness} options={COMPLETENESS_OPTIONS} placeholder="How complete" onChange={v => set("completeness", v)} />}
                {type === "coin"  && <EFText label="Grade" value={f.grade} placeholder="e.g. MS-63" onChange={v => set("grade", v)} />}
                {type === "vinyl" && <EFText label="Pressing" value={f.pressing} placeholder="e.g. 180g" onChange={v => set("pressing", v)} />}
                {type === "book"  && <EFText label="Edition" value={f.edition} placeholder="e.g. First Edition" onChange={v => set("edition", v)} />}
                <EFSelect label="Condition" value={f.condition} options={CONDITION_OPTIONS} placeholder="Condition" onChange={v => set("condition", v)} />
                <EFDate label="Acquired" value={f.acquired} onChange={v => set("acquired", v)} />
                <EFText label="Purchase price" value={f.purchase_price || ""} placeholder="e.g. 25.00" onChange={v => set("purchase_price", v)} />
                <EFSelect label="Currency" value={f.purchase_currency || "USD"} options={["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "DKK", "SEK", "NOK", "CHF"]} placeholder={false} onChange={v => set("purchase_currency", v)} />
                <EFText label="Current value" value={f.current_value || ""} placeholder="Estimated market value" onChange={v => set("current_value", v)} />
                {type === "movie" && <EFToggle label="Watched" value={f.watched} onChange={v => set("watched", v)} hint={["Yes", "Not yet"]} />}
                {type === "book"  && <EFToggle label="Read" value={f.watched} onChange={v => set("watched", v)} hint={["Yes", "Not yet"]} />}
                {type === "game"  && <EFToggle label="Completed" value={f.completed} onChange={v => set("completed", v)} hint={["Yes", "Not yet"]} />}
              </div>

              <div className="ef-section ef-section-row">
                <span>More details</span>
                <button type="button" className="ef-add" onClick={addRow}><I.plus size={14} stroke={2} /> Add field</button>
              </div>
              {custom.length === 0
                ? <div className="ef-empty">Add your own fields for anything specific to this piece.</div>
                : <div className="ef-custom">
                    {custom.map((r) => (
                      <div className="ef-custom-row" key={r.id}>
                        <input className="ef-control" placeholder="Field name" value={r.label} onChange={e => setRow(r.id, "label", e.target.value)} />
                        <input className="ef-control" placeholder="Value" value={r.value} onChange={e => setRow(r.id, "value", e.target.value)} />
                        <button type="button" className="ef-del" onClick={() => delRow(r.id)} title="Remove field"><I.trash size={16} /></button>
                      </div>
                    ))}
                  </div>}
            </>
          )}
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 12, color: "var(--mute)" }}>{collection.template && collection.template.length ? `${collection.template.length} template field${collection.template.length !== 1 ? "s" : ""} ready` : "Saved on this device"}</div>
          <button className="btn solid" disabled={!c.title.trim() || !!addYearError} onClick={add}><I.check size={16} /> Add item</button>
        </div>
      </div>
    </div>
  );
}
