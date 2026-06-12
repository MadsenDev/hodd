// @ts-nocheck
import React from 'react';
import { I, typeIcon } from './icons';
import { createCollection, addItem } from './api';

export const FORMAT_OPTIONS = {
  game:  ["Cartridge", "Disc", "Digital", "Boxed set"],
  book:  ["Hardcover", "Paperback", "Mass market", "Ebook", "Audiobook"],
  movie: ["4K Blu-ray", "Blu-ray", "DVD", "Digital", "VHS"],
  coin:  ["Silver dollar", "Gold", "Silver", "Copper", "Proof set"],
  vinyl: ["Vinyl LP", "7\" single", "Boxed set", "Picture disc"],
  comic: ["Single issue", "Trade paperback", "Hardcover", "Omnibus"],
};
export const CONDITION_OPTIONS = ["Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"];
export const COMPLETENESS_OPTIONS = ["Complete in box", "Loose", "Sealed", "Manual only"];
export const TYPE_OPTIONS = [["game", "Game"], ["book", "Book"], ["movie", "Movie"], ["coin", "Coin"], ["vinyl", "Vinyl"], ["comic", "Comic"], ["other", "Other / custom"]];
export const SUBLABELS = { book: "Author", game: "Platform", coin: "Mint", vinyl: "Artist", movie: "Director", comic: "Publisher", other: "Detail" };

export const ACCENT_SWATCHES = ["#6366f1", "#5BA47A", "#5C8AD6", "#C9A24C", "#CF6B5A", "#7FB0C4", "#9B7BD4", "#C0392B"];

function withCurrent(options, current) {
  if (current && options.indexOf(current) === -1) return [current].concat(options);
  return options;
}

export function EFSelect({ label, value, options, pairs, placeholder, onChange }) {
  const opts = pairs || withCurrent(options, value).map(o => [o, o]);
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

export function EFText({ label, value, placeholder, onChange, wide }) {
  return (
    <label className={"ef-field" + (wide ? " ef-wide" : "")}>
      <span className="ef-k">{label}</span>
      <input className="ef-control" type="text" value={value || ""} placeholder={placeholder || ""}
        onChange={e => onChange(e.target.value)} />
    </label>
  );
}

export function EFTextarea({ label, value, placeholder, onChange }) {
  return (
    <label className="ef-field ef-wide">
      <span className="ef-k">{label}</span>
      <textarea className="ef-control ef-textarea" rows={5} value={value || ""} placeholder={placeholder || ""}
        onChange={e => onChange(e.target.value)} />
      <span className="ef-hint">Separate paragraphs with a blank line.</span>
    </label>
  );
}

export function EFToggle({ label, value, onChange, hint }) {
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

export function ItemEditForm({ item, type, subLabel, story, onCancel, onSave }) {
  const init = {
    format: item.format && item.format !== "—" && item.format !== "Owned" ? item.format : "",
    completeness: item.completeness || "",
    grade: item.grade || "",
    pressing: item.pressing || "",
    edition: item.edition || "",
    condition: item.condition || "",
    acquired: item.acquired || "",
    watched: !!item.watched,
  };
  const [owned, setOwned] = React.useState(item.owned !== false);
  const [f, setF] = React.useState(init);
  const [c, setC] = React.useState({
    title: item.title || "",
    sub: item.sub || "",
    year: item.year != null ? String(item.year) : "",
    type: item.type || type || "other",
    series: item.series || "",
    region: item.region || "",
  });
  const [custom, setCustom] = React.useState(
    Array.isArray(item.custom) && item.custom.length
      ? item.custom.map(x => ({ label: x.label || "", value: x.value || "" }))
      : []
  );
  const [storyText, setStoryText] = React.useState((story || []).join("\n\n"));
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const setCan = (k, v) => setC(prev => ({ ...prev, [k]: v }));
  const setRow = (i, k, v) => setCustom(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setCustom(p => [...p, { label: "", value: "" }]);
  const delRow = (i) => setCustom(p => p.filter((_, idx) => idx !== i));

  const etype = c.type || "other";
  const eSub = SUBLABELS[etype] || "Detail";

  function handleSave() {
    const yearNum = c.year.trim() ? parseInt(c.year, 10) : null;
    const canonical = {
      title: c.title.trim() || item.title,
      sub: c.sub.trim() || null,
      year: Number.isFinite(yearNum) ? yearNum : (c.year.trim() ? item.year : null),
      type: etype,
      series: c.series.trim() || null,
      region: c.region.trim() || null,
    };
    const customClean = custom
      .map(r => ({ label: r.label.trim(), value: r.value.trim() }))
      .filter(r => r.label && r.value);
    const paragraphs = storyText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (!owned) { onSave({ owned: false, canonical, story: paragraphs }); return; }
    const holding = {
      format: f.format || null,
      condition: f.condition || null,
      acquired: f.acquired || null,
      custom: customClean.length ? customClean : null,
    };
    if (etype === "game")  holding.completeness = f.completeness || null;
    if (etype === "coin")  holding.grade = f.grade || null;
    if (etype === "vinyl") holding.pressing = f.pressing || null;
    if (etype === "book")  holding.edition = f.edition || null;
    if (etype === "movie") holding.watched = f.watched;
    onSave({ owned: true, holding, canonical, story: paragraphs });
  }

  return (
    <div className="edit-form">
      <div className="ef-head">
        <div className="ef-title">Edit item</div>
        <EFToggle label="In collection" value={owned} onChange={setOwned} hint={["Owned", "Missing"]} />
      </div>

      <div className="ef-section">Item details</div>
      <div className="ef-grid">
        <EFText label="Title" value={c.title} placeholder="Item title" onChange={v => setCan("title", v)} wide />
        <EFSelect label="Type" value={etype} pairs={TYPE_OPTIONS} placeholder={false} onChange={v => setCan("type", v)} />
        <EFText label={eSub} value={c.sub} placeholder={eSub} onChange={v => setCan("sub", v)} />
        <EFText label="Year" value={c.year} placeholder="e.g. 1996" onChange={v => setCan("year", v)} />
        <EFText label="Series" value={c.series} placeholder="e.g. Dune, Pokémon" onChange={v => setCan("series", v)} />
        {etype === "game" && <EFText label="Region" value={c.region} placeholder="e.g. NTSC, PAL, JPN" onChange={v => setCan("region", v)} />}
      </div>

      {owned ? (
        <>
          <div className="ef-section">Your copy</div>
          <div className="ef-grid">
            <EFSelect label="Format" value={f.format} options={FORMAT_OPTIONS[etype] || []} placeholder="Medium" onChange={v => set("format", v)} />
            {etype === "game"  && <EFSelect label="Completeness" value={f.completeness} options={COMPLETENESS_OPTIONS} placeholder="How complete" onChange={v => set("completeness", v)} />}
            {etype === "coin"  && <EFText label="Grade" value={f.grade} placeholder="e.g. MS-63" onChange={v => set("grade", v)} />}
            {etype === "vinyl" && <EFText label="Pressing" value={f.pressing} placeholder="e.g. 180g" onChange={v => set("pressing", v)} />}
            {etype === "book"  && <EFText label="Edition" value={f.edition} placeholder="e.g. First Edition" onChange={v => set("edition", v)} />}
            <EFSelect label="Condition" value={f.condition} options={CONDITION_OPTIONS} placeholder="Condition" onChange={v => set("condition", v)} />
            <EFText label="Acquired" value={f.acquired} placeholder="e.g. May 2024" onChange={v => set("acquired", v)} />
            {etype === "movie" && <EFToggle label="Watched" value={f.watched} onChange={v => set("watched", v)} hint={["Yes", "Not yet"]} />}
          </div>

          <div className="ef-section ef-section-row">
            <span>More details</span>
            <button type="button" className="ef-add" onClick={addRow}><I.plus size={14} stroke={2} /> Add field</button>
          </div>
          {custom.length === 0
            ? <div className="ef-empty">Collecting something unusual? Add your own fields — Movement, Reference, Colorway, Size, anything.</div>
            : <div className="ef-custom">
                {custom.map((r, i) => (
                  <div className="ef-custom-row" key={i}>
                    <input className="ef-control" placeholder="Field name" value={r.label} onChange={e => setRow(i, "label", e.target.value)} />
                    <input className="ef-control" placeholder="Value" value={r.value} onChange={e => setRow(i, "value", e.target.value)} />
                    <button type="button" className="ef-del" onClick={() => delRow(i)} title="Remove field"><I.trash size={16} /></button>
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
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn solid" onClick={handleSave}><I.check size={16} stroke={2.2} /> Save changes</button>
      </div>
    </div>
  );
}

export function AccentPicker({ value, onChange }) {
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

export function TemplateEditor({ rows, setRows }) {
  const setRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const add = () => setRows([...rows, ""]);
  const del = (i) => setRows(rows.filter((_, idx) => idx !== i));
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

export function CreateCollectionModal({ onClose, onCreated }) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("other");
  const [accent, setAccent] = React.useState(ACCENT_SWATCHES[0]);
  const [tmpl, setTmpl] = React.useState(["", ""]);

  function create() {
    if (!name.trim()) return;
    const rec = createCollection({
      name, type, accent,
      template: tmpl.map(s => s.trim()).filter(Boolean),
    });
    onCreated(rec);
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
            <EFSelect label="Type" value={type} pairs={TYPE_OPTIONS} placeholder={false} onChange={setType} />
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

export function AddItemModal({ collection, onClose, onAdded }) {
  const type = collection.type || "other";
  const subLabel = SUBLABELS[type] || "Detail";
  const [owned, setOwned] = React.useState(true);
  const [c, setC] = React.useState({ title: "", sub: "", year: "" });
  const [f, setF] = React.useState({ format: "", completeness: "", grade: "", pressing: "", edition: "", condition: "", acquired: "", watched: false });
  const [custom, setCustom] = React.useState((collection.template || []).map(l => ({ label: l, value: "" })));
  const setCan = (k, v) => setC(p => ({ ...p, [k]: v }));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setRow = (i, k, v) => setCustom(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setCustom(p => [...p, { label: "", value: "" }]);
  const delRow = (i) => setCustom(p => p.filter((_, idx) => idx !== i));

  function add() {
    if (!c.title.trim()) return;
    const yearNum = c.year.trim() ? parseInt(c.year, 10) : null;
    const customClean = custom.map(r => ({ label: r.label.trim(), value: r.value.trim() })).filter(r => r.label && r.value);
    const draft = {
      title: c.title.trim(), sub: c.sub.trim() || null, type,
      year: Number.isFinite(yearNum) ? yearNum : null, owned,
    };
    if (owned) {
      draft.format = f.format || null;
      draft.condition = f.condition || null;
      draft.acquired = f.acquired || null;
      if (type === "game")  draft.completeness = f.completeness || null;
      if (type === "coin")  draft.grade = f.grade || null;
      if (type === "vinyl") draft.pressing = f.pressing || null;
      if (type === "book")  draft.edition = f.edition || null;
      if (type === "movie") draft.watched = f.watched;
      if (customClean.length) draft.custom = customClean;
    }
    const rec = addItem(collection.id, draft);
    onAdded(rec);
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
          <div className="ef-grid">
            <EFText label="Title" value={c.title} placeholder="Item title" onChange={v => setCan("title", v)} wide />
            <EFText label={subLabel} value={c.sub} placeholder={subLabel} onChange={v => setCan("sub", v)} />
            <EFText label="Year" value={c.year} placeholder="e.g. 1996" onChange={v => setCan("year", v)} />
          </div>

          {owned && (
            <>
              <div className="ef-section">Your copy</div>
              <div className="ef-grid">
                <EFSelect label="Format" value={f.format} options={FORMAT_OPTIONS[type] || []} placeholder="Medium" onChange={v => set("format", v)} />
                {type === "game"  && <EFSelect label="Completeness" value={f.completeness} options={COMPLETENESS_OPTIONS} placeholder="How complete" onChange={v => set("completeness", v)} />}
                {type === "coin"  && <EFText label="Grade" value={f.grade} placeholder="e.g. MS-63" onChange={v => set("grade", v)} />}
                {type === "vinyl" && <EFText label="Pressing" value={f.pressing} placeholder="e.g. 180g" onChange={v => set("pressing", v)} />}
                {type === "book"  && <EFText label="Edition" value={f.edition} placeholder="e.g. First Edition" onChange={v => set("edition", v)} />}
                <EFSelect label="Condition" value={f.condition} options={CONDITION_OPTIONS} placeholder="Condition" onChange={v => set("condition", v)} />
                <EFText label="Acquired" value={f.acquired} placeholder="e.g. May 2024" onChange={v => set("acquired", v)} />
                {type === "movie" && <EFToggle label="Watched" value={f.watched} onChange={v => set("watched", v)} hint={["Yes", "Not yet"]} />}
              </div>

              <div className="ef-section ef-section-row">
                <span>More details</span>
                <button type="button" className="ef-add" onClick={addRow}><I.plus size={14} stroke={2} /> Add field</button>
              </div>
              {custom.length === 0
                ? <div className="ef-empty">Add your own fields for anything specific to this piece.</div>
                : <div className="ef-custom">
                    {custom.map((r, i) => (
                      <div className="ef-custom-row" key={i}>
                        <input className="ef-control" placeholder="Field name" value={r.label} onChange={e => setRow(i, "label", e.target.value)} />
                        <input className="ef-control" placeholder="Value" value={r.value} onChange={e => setRow(i, "value", e.target.value)} />
                        <button type="button" className="ef-del" onClick={() => delRow(i)} title="Remove field"><I.trash size={16} /></button>
                      </div>
                    ))}
                  </div>}
            </>
          )}
        </div>

        <div className="modal-foot">
          <div style={{ fontSize: 12, color: "var(--mute)" }}>{collection.template && collection.template.length ? `${collection.template.length} template field${collection.template.length !== 1 ? "s" : ""} ready` : "Saved on this device"}</div>
          <button className="btn solid" disabled={!c.title.trim()} onClick={add}><I.check size={16} /> Add item</button>
        </div>
      </div>
    </div>
  );
}
