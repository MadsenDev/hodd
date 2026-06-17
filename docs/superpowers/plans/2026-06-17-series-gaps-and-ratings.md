# Series Gap Visualization & Rating System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add half-star ratings and a numbered series gap strip to HODD.

**Architecture:** Two new REAL columns (`series_number`, `rating`) land in `user_items` (manual items) and `rating` also in `holdings` (catalog items). A reusable `StarRating` component handles both interactive and read-only display. The series detail view gains a number-line strip rendered from existing series data enriched with the new `series_number` field.

**Tech Stack:** TypeScript, React (via `// @ts-nocheck` files), sql.js, Electron IPC, Vite.

## Global Constraints

- All React files start with `// @ts-nocheck` — no TypeScript annotations in JSX files.
- DB migrations use `try { db.run('ALTER TABLE … ADD COLUMN …'); } catch (_) {}` pattern — idempotent, safe to re-run.
- User items have ids starting with `"i-"`; catalog items do not.
- `saveCatalog(id, patch)` in `src/api.ts` auto-routes to `updateUserItem` for user items and `saveCatalog` IPC for catalog items — use it for canonical field patches.
- No test framework exists — use `npm run build` (TypeScript compile + Vite bundle) as the verification step. Run from `/home/chris/Documents/GitHub/hodd`.
- Visual verification: `npm run dev` starts the Electron app.

---

### Task 1: DB migrations and data-layer plumbing

**Files:**
- Modify: `electron/db.ts`
- Modify: `src/api.ts`

**Interfaces:**
- Produces: `getUserItems()` returns items with `series_number: number | null` and `rating: number | null`
- Produces: `getHoldings()` returns holdings with `rating: number | null`
- Produces: `updateUserItemFields(id, { series_number, rating })` persists both fields
- Produces: `saveHolding(id, { rating })` persists rating on catalog items

---

- [ ] **Step 1: Add migrations in `electron/db.ts`**

In `initDb()`, after the last existing `try { db.run('ALTER TABLE … ADD COLUMN …') }` block (currently ending around line 289), add:

```typescript
  try { db.run('ALTER TABLE user_items ADD COLUMN series_number REAL'); } catch (_) {}
  try { db.run('ALTER TABLE user_items ADD COLUMN rating REAL'); } catch (_) {}
  try { db.run('ALTER TABLE holdings ADD COLUMN rating REAL'); } catch (_) {}
```

- [ ] **Step 2: Update `getUserItems()` SELECT in `electron/db.ts`**

Find the `getUserItems` function (line ~448). Replace its `db.exec` SELECT string to include the two new columns:

```typescript
  const res = db.exec('SELECT id, collection_id, title, sub, year, type, color, owned, format, completeness, grade, pressing, edition, condition_val, acquired, watched, completed, custom, series, region, cover_url, gallery, purchase_price, purchase_currency, current_value, loan_to, loan_to_date, series_number, rating FROM user_items ORDER BY collection_id, created_at');
```

- [ ] **Step 3: Update `getHoldings()` SELECT in `electron/db.ts`**

Find `getHoldings()` (line ~392). Replace its `db.exec` SELECT to include `rating`:

```typescript
  const res = db.exec('SELECT item_id, format, completeness, grade, pressing, edition, condition_val, acquired, watched, completed, custom, notes, loan_from, loan_date, ownership, purchase_price, purchase_currency, current_value, loan_to, loan_to_date, rating FROM holdings');
```

- [ ] **Step 4: Add `series_number` and `rating` to `updateUserItemFields` allowed map in `electron/db.ts`**

Find `updateUserItemFields` (line ~642). Extend the `allowed` object:

```typescript
  const allowed: Record<string, 'text' | 'int' | 'json' | 'real'> = {
    title: 'text', sub: 'text', year: 'int', type: 'text',
    series: 'text', region: 'text', color: 'text',
    cover_url: 'text', gallery: 'json',
    purchase_price: 'text', purchase_currency: 'text', current_value: 'text',
    series_number: 'real', rating: 'real',
  };
```

Then update the value-mapping block to handle `'real'`:

```typescript
    if (allowed[c] === 'int') return Number(v);
    if (allowed[c] === 'real') return v === null || v === '' ? null : Number(v);
    if (allowed[c] === 'json') return typeof v === 'string' ? (v || null) : JSON.stringify(v);
    return String(v);
```

- [ ] **Step 5: Add `rating` to `saveHolding` UPDATE and INSERT SQL in `electron/db.ts`**

Find `saveHolding` (line ~490). In the UPDATE branch, replace the `db.run` call:

```typescript
    db.run(`UPDATE holdings SET format=?, completeness=?, grade=?, pressing=?, edition=?,
      condition_val=?, acquired=?, watched=?, completed=?, custom=?,
      notes=?, loan_from=?, loan_date=?, ownership=?, purchase_price=?, purchase_currency=?, current_value=?, loan_to=?, loan_to_date=?, rating=? WHERE item_id=?`, [
      sv(merged.format), sv(merged.completeness), sv(merged.grade),
      sv(merged.pressing), sv(merged.edition), sv(merged.condition_val),
      sv(merged.acquired), sv(merged.watched), sv(merged.completed), sv(merged.custom),
      sv(merged.notes), sv(merged.loan_from), sv(merged.loan_date), sv(merged.ownership),
      sv(merged.purchase_price), sv(merged.purchase_currency), sv(merged.current_value),
      sv(merged.loan_to), sv(merged.loan_to_date), sv(merged.rating ?? null), itemId,
    ]);
```

In the INSERT branch:

```typescript
    db.run(`INSERT INTO holdings (item_id, format, completeness, grade, pressing, edition,
      condition_val, acquired, watched, completed, custom,
      notes, loan_from, loan_date, ownership, purchase_price, purchase_currency, current_value, loan_to, loan_to_date, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      itemId,
      sv(patch.format), sv(patch.completeness), sv(patch.grade),
      sv(patch.pressing), sv(patch.edition), sv(patch.condition),
      sv(patch.acquired),
      w == null ? null : (w ? 1 : 0),
      cp == null ? null : (cp ? 1 : 0),
      patch.custom ? JSON.stringify(patch.custom) : null,
      sv(patch.notes), sv(patch.loan_from), sv(patch.loan_date), sv(patch.ownership),
      sv(patch.purchase_price), sv(patch.purchase_currency), sv(patch.current_value),
      sv(patch.loan_to), sv(patch.loan_to_date), sv(patch.rating ?? null),
    ]);
```

- [ ] **Step 6: Add `rating` to `joinHolding` in `src/api.ts`**

Find `joinHolding` (line ~252). Add `rating` to the spread object:

```typescript
function joinHolding(cat, h) {
  cat = applyCatalogOv(cat);
  return Object.assign({}, cat, {
    owned: !!h,
    format:       (h && h.format)       || "—",
    completeness: (h && h.completeness) || null,
    grade:        (h && h.grade)        || null,
    pressing:     (h && h.pressing)     || null,
    edition:      (h && h.edition)      || null,
    condition:    (h && h.condition)    || null,
    acquired:     (h && h.acquired)     || null,
    watched:      h ? h.watched : undefined,
    completed:    h ? h.completed : undefined,
    custom:       (h && h.custom)       || null,
    notes:        (h && h.notes)        || null,
    ownership:    (h && h.ownership)    || null,
    rating:       (h && h.rating != null) ? h.rating : null,
```

(Keep the rest of joinHolding's existing fields unchanged — just add the `rating` line.)

- [ ] **Step 7: Add `saveRating` helper to `src/api.ts`**

After `saveHolding` (line ~68), add:

```typescript
export function saveRating(id, rating) {
  _searchIndex = null;
  if (String(id).startsWith("i-")) {
    saveCatalog(id, { rating });
  } else {
    saveHolding(id, { rating });
  }
}
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add electron/db.ts src/api.ts
git commit -m "feat: add series_number and rating columns + data-layer plumbing"
```

---

### Task 2: StarRating component

**Files:**
- Modify: `src/components.tsx`

**Interfaces:**
- Produces: `StarRating({ value, onChange, size, readonly })` — exported from `src/components.tsx`
  - `value: number | null` — 0.5–5.0 in 0.5 steps, or null
  - `onChange?: (v: number | null) => void` — called on click; clicking the current value passes null (clear)
  - `size?: number` — px, defaults to 18
  - `readonly?: boolean` — disables hover/click, defaults to false

---

- [ ] **Step 1: Add `StarRating` to `src/components.tsx`**

Add the following export after the `Cover` component (around line 300):

```javascript
export function StarRating({ value, onChange, size = 18, readonly = false }) {
  const [hover, setHover] = React.useState(null);
  const display = hover !== null ? hover : (value ?? 0);

  return (
    <div
      style={{ display: "inline-flex", gap: 1 }}
      onMouseLeave={() => { if (!readonly) setHover(null); }}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const full = display >= star;
        const half = !full && display >= star - 0.5;
        return (
          <div
            key={star}
            style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
            onMouseMove={!readonly ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(e.clientX - rect.left < rect.width / 2 ? star - 0.5 : star);
            } : undefined}
            onClick={!readonly && onChange ? () => {
              onChange(hover === value ? null : hover);
            } : undefined}
          >
            <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
              <polygon
                points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                fill="none"
                stroke="var(--border-strong, #444)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            {(full || half) && (
              <div style={{
                position: "absolute", top: 0, left: 0,
                width: half ? "50%" : "100%",
                overflow: "hidden", pointerEvents: "none",
              }}>
                <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
                  <polygon
                    points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                    fill="#C9A24C"
                    stroke="#C9A24C"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components.tsx
git commit -m "feat: add StarRating component with half-star support"
```

---

### Task 3: Series number field in item edit form

**Files:**
- Modify: `src/forms.tsx`

**Interfaces:**
- Consumes: `EFText` (already in `src/forms.tsx`)
- Produces: `ItemEditForm` `onSave` callback's `canonical` object now includes `series_number: number | null`

---

- [ ] **Step 1: Add `parseSeriesNumber` helper at the top of `src/forms.tsx`**

Add this function before `EFSelect` (around line 59):

```javascript
function parseSeriesNumber(title) {
  if (!title) return null;
  const m =
    title.match(/\s#\s*(\d+(?:\.\d+)?)/i) ||
    title.match(/\s(?:vol\.?|volume)\s*(\d+(?:\.\d+)?)/i) ||
    title.match(/\s(?:book|part|ep\.?|episode|chapter)\s+(\d+(?:\.\d+)?)/i);
  if (m) return parseFloat(m[1]);
  const ROMAN = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13,XIV:14,XV:15,XVI:16,XVII:17,XVIII:18,XIX:19,XX:20 };
  const rm = title.match(/\s+((?:X{0,2})(?:IX|IV|V?I{0,3}))\s*$/i);
  if (rm && ROMAN[rm[1].toUpperCase()]) return ROMAN[rm[1].toUpperCase()];
  return null;
}
```

- [ ] **Step 2: Add `series_number` to `c` state in `ItemEditForm`**

Find the `c` state initializer (line ~153):

```javascript
  const [c, setC] = React.useState({
    title: item.title || "",
    sub: item.sub || "",
    year: item.year != null ? String(item.year) : "",
    type: item.type || type || "other",
    series: item.series || "",
    region: item.region || "",
    series_number: item.series_number != null ? String(item.series_number) : "",
  });
```

- [ ] **Step 3: Add auto-parse effect in `ItemEditForm`**

After the existing state declarations, before `function pickCoverPhoto`, add:

```javascript
  React.useEffect(() => {
    if (c.series.trim() && !c.series_number) {
      const n = parseSeriesNumber(c.title);
      if (n !== null) setCan("series_number", String(n));
    }
  }, [c.title, c.series]);
```

- [ ] **Step 4: Add `series_number` to `canonical` in `handleSave`**

Find `handleSave` (line ~225). Inside the `canonical` object:

```javascript
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
```

- [ ] **Step 5: Add the `series_number` field in the edit form UI**

Find the "Series" field in the JSX (line ~329):

```jsx
        <EFText label="Series" value={c.series} placeholder="e.g. Dune, Pokémon" onChange={v => setCan("series", v)} />
        <EFText label="# in series" value={c.series_number} placeholder="e.g. 4 or 4.5" onChange={v => setCan("series_number", v)} />
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/forms.tsx
git commit -m "feat: add series_number field to item edit form with auto-parse"
```

---

### Task 4: Rating in item detail view

**Files:**
- Modify: `src/views/ItemDetail.tsx`

**Interfaces:**
- Consumes: `StarRating` from `src/components.tsx`
- Consumes: `saveRating(id, rating)` from `src/api.ts`

---

- [ ] **Step 1: Import `StarRating` and `saveRating` in `ItemDetail.tsx`**

Line 4 (imports from components):
```javascript
import { Cover, FluidCover, useNarrow, StarRating } from '../components';
```

Line 6 (imports from api):
```javascript
import { saveCatalog, saveStory, saveHolding, removeHolding, removeItem, setItemOwned, toggleFavorite, OllamaClient, saveRating } from '../api';
```

- [ ] **Step 2: Add rating state to `ItemDetail`**

After the existing state declarations (around line 31), add:

```javascript
  const [ratingOptimistic, setRatingOptimistic] = React.useState(null);
  const rating = ratingOptimistic !== null ? ratingOptimistic : (item.rating ?? null);
```

Reset on item change — find the existing `React.useEffect(() => { setItem(initialItem); ... }, [initialItem]);` (line ~32) and add the reset:

```javascript
  React.useEffect(() => {
    setItem(initialItem);
    setEditing(false);
    setStoryOv(null);
    setConfirmDelete(false);
    setFavOptimistic(null);
    setRatingOptimistic(null);
  }, [initialItem]);
```

- [ ] **Step 3: Add `StarRating` to the facts section**

Find the facts rendering (line ~269 — the `<div className="facts">` block). Add a rating row after the facts grid, before `<div style={{ marginTop: 30, ...` (the "The story" section):

```jsx
          {owned && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--mute)", minWidth: 80 }}>Rating</div>
              <StarRating
                value={rating}
                size={20}
                onChange={v => {
                  setRatingOptimistic(v);
                  saveRating(item.id, v);
                }}
              />
              {rating && (
                <span style={{ fontSize: 12, color: "var(--dim)" }}>{rating}/5</span>
              )}
            </div>
          )}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/views/ItemDetail.tsx
git commit -m "feat: add rating to item detail page"
```

---

### Task 5: Series gap strip in Series view

**Files:**
- Modify: `src/views/Series.tsx`

**Interfaces:**
- Consumes: `series_number` field on items from search index (populated by Task 1)

---

- [ ] **Step 1: Add `SeriesStrip` component inside `Series.tsx`**

Add this function before `export function SeriesView`:

```javascript
function SeriesStrip({ items, accent, onSelect }) {
  const numbered = items.filter(i => i.series_number != null);
  if (!numbered.length) return null;

  const min = Math.floor(Math.min(...numbered.map(i => i.series_number)));
  const max = Math.ceil(Math.max(...numbered.map(i => i.series_number)));
  const byNum = {};
  items.forEach(i => { if (i.series_number != null) byNum[i.series_number] = i; });

  const blocks = [];
  for (let n = min; n <= max; n++) {
    const whole = byNum[n];
    const half  = byNum[n - 0.5];
    if (half) {
      const isOwned = half.owned !== false;
      blocks.push(
        <div
          key={n - 0.5}
          title={half.title}
          onClick={() => onSelect(half)}
          style={{
            width: 16, height: 32, borderRadius: 3,
            background: isOwned ? accent : "transparent",
            border: isOwned ? "none" : `1.5px dashed ${accent}`,
            opacity: isOwned ? 1 : 0.55,
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        />
      );
    }
    const isOwned = whole ? whole.owned !== false : false;
    blocks.push(
      <div
        key={n}
        title={whole ? whole.title : `#${n} — not tracked`}
        onClick={whole ? () => onSelect(whole) : undefined}
        style={{
          width: 28, height: 36, borderRadius: 4,
          background: isOwned ? accent : "transparent",
          border: isOwned ? "none" : `1.5px dashed ${accent}`,
          opacity: whole ? (isOwned ? 1 : 0.5) : 0.18,
          cursor: whole ? "pointer" : "default", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 600,
          color: isOwned ? "rgba(255,255,255,0.8)" : accent,
        }}
      >
        {n}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 10 }}>
        Series map
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {blocks}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add scroll-to ref map and update the series detail view**

In the series detail section (inside `if (selected) { ... }`, around line 48), add a ref for item cells:

```javascript
    const itemRefs = React.useRef({});
    const sortedItems = [...series.items].sort((a, b) => {
      const an = a.series_number ?? Infinity;
      const bn = b.series_number ?? Infinity;
      return an !== bn ? an - bn : (a.title || "").localeCompare(b.title || "");
    });
    const owned = sortedItems.filter(i => i.owned !== false);
    const missing = sortedItems.filter(i => i.owned === false);
```

Replace the existing `const owned = ...` and `const missing = ...` lines.

- [ ] **Step 3: Add `SeriesStrip` above the grids in series detail**

In the series detail JSX, after `</div>` closing the `detail-head` div (around line 63), add:

```jsx
        <SeriesStrip
          items={series.items}
          accent={series.accent}
          onSelect={it => {
            const el = itemRefs.current[it.id];
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.style.outline = "2px solid " + series.accent;
              setTimeout(() => { if (el) el.style.outline = ""; }, 1200);
            }
          }}
        />
```

- [ ] **Step 4: Attach refs to item cells in the owned/missing grids**

In the `owned.map(it => ...)` block, update the wrapping div:

```jsx
              <div className="item-cell" key={it.id}
                ref={el => { itemRefs.current[it.id] = el; }}
                onClick={() => ctx.openItem(it)}>
```

Do the same for `missing.map(it => ...)`:

```jsx
              <div className="item-cell missing" key={it.id}
                ref={el => { itemRefs.current[it.id] = el; }}
                onClick={() => ctx.openItem(it)}>
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/views/Series.tsx
git commit -m "feat: add series gap strip with numbered blocks to series detail view"
```

---

### Task 6: Rating on collection cards and Top Rated sort

**Files:**
- Modify: `src/views/CollectionDetail.tsx`

**Interfaces:**
- Consumes: `StarRating` from `src/components.tsx`
- Consumes: `item.rating` from search index (populated by Task 1)

---

- [ ] **Step 1: Import `StarRating` in `CollectionDetail.tsx`**

Line 4:
```javascript
import { Cover, CompletionRing, Loading, ErrorState, EmptyState, StarRating } from '../components';
```

- [ ] **Step 2: Add "Rating" to the sort segmented control**

Find (line ~237):
```jsx
        <div className="seg">
          {[["default", "Default"], ["title", "A–Z"], ["year", "Year"], ["status", "Status"], ...(progressLabel ? [["progress", progressLabel]] : [])].map(([v, l]) => (
```

Replace with:
```jsx
        <div className="seg">
          {[["default", "Default"], ["title", "A–Z"], ["year", "Year"], ["status", "Status"], ...(progressLabel ? [["progress", progressLabel]] : []), ["rating", "Rating"]].map(([v, l]) => (
```

- [ ] **Step 3: Add rating sort case**

Find the `shown` sort logic (line ~174). Add the rating case:

```javascript
  const shown = [...filtered].sort((a, b) => {
    if (sort === "title") return (a.title || "").localeCompare(b.title || "");
    if (sort === "year")  return (a.year || 9999) - (b.year || 9999);
    if (sort === "status") return (b.owned ? 1 : 0) - (a.owned ? 1 : 0);
    if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
    if (sort === "progress") {
      const aP = type === "game" ? (a.completed ? 1 : 0) : (a.watched ? 1 : 0);
      const bP = type === "game" ? (b.completed ? 1 : 0) : (b.watched ? 1 : 0);
      return bP - aP;
    }
    return 0;
  });
```

- [ ] **Step 4: Add small star display on item cards**

Find the item card JSX (line ~307):

```jsx
                <Cover item={{ ...it, type }} h={210} ghost={!it.owned} />
                <div className="nm">{it.title}</div>
                <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
```

Replace with:

```jsx
                <Cover item={{ ...it, type }} h={210} ghost={!it.owned} />
                <div className="nm">{it.title}</div>
                <div className="yr">{it.sub || ""}{it.year ? ` · ${it.year}` : ""}</div>
                {it.rating != null && (
                  <div style={{ marginTop: 3 }}>
                    <StarRating value={it.rating} size={10} readonly />
                  </div>
                )}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/views/CollectionDetail.tsx
git commit -m "feat: show star rating on collection cards and add Rating sort"
```

---

### Task 7: Rating in Series view (detail header + list)

**Files:**
- Modify: `src/views/Series.tsx`

**Interfaces:**
- Consumes: `StarRating` from `src/components.tsx`
- Consumes: `item.rating` on series items

---

- [ ] **Step 1: Import `StarRating` in `Series.tsx`**

Line 4:
```javascript
import { Cover, CompletionRing, Loading, ErrorState, EmptyState, StarRating } from '../components';
```

- [ ] **Step 2: Compute average rating for each series**

In the `seriesList` map (line ~33), extend the returned object:

```javascript
  const seriesList = Object.entries(seriesMap).map(([name, items]) => {
    const owned = items.filter(i => i.owned !== false).length;
    const total = items.length;
    const pct = total ? Math.round(owned / total * 100) : 0;
    const accent = items[0]?.color || "var(--accent)";
    const ratedItems = items.filter(i => i.rating != null);
    const avgRating = ratedItems.length
      ? Math.round(ratedItems.reduce((s, i) => s + i.rating, 0) / ratedItems.length * 2) / 2
      : null;
    return { name, items, owned, total, pct, accent, avgRating };
  });
```

- [ ] **Step 3: Show average rating in series detail header**

In the series detail view, find the `<div className="sub">` line (line ~61):

```jsx
            <div className="sub">{series.owned} owned · {series.total - series.owned} missing · {series.pct}% complete</div>
            {series.avgRating != null && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <StarRating value={series.avgRating} size={14} readonly />
                <span style={{ fontSize: 12, color: "var(--mute)" }}>{series.avgRating}/5 avg</span>
              </div>
            )}
```

- [ ] **Step 4: Show average rating in series list rows**

Find the series list row (line ~114):

```jsx
            <div className="bar-row-count" style={{ color: "var(--dim)", fontSize: 12.5, marginRight: 8 }}>
              {s.owned} / {s.total}
            </div>
```

Replace with:

```jsx
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: 8, gap: 2 }}>
              <div className="bar-row-count" style={{ color: "var(--dim)", fontSize: 12.5 }}>
                {s.owned} / {s.total}
              </div>
              {s.avgRating != null && (
                <StarRating value={s.avgRating} size={9} readonly />
              )}
            </div>
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/views/Series.tsx
git commit -m "feat: show avg rating in series list and detail header"
```

---

### Task 8: Statistics — Top Rated panel and per-collection average

**Files:**
- Modify: `src/views/Statistics.tsx`

**Interfaces:**
- Consumes: `StarRating` from `src/components.tsx`
- Consumes: `item.rating` from search index
- Consumes: `ctx.openItem(item)` for clicking top-rated items

---

- [ ] **Step 1: Import `StarRating` and `Cover` in `Statistics.tsx`**

Line 4:
```javascript
import { CompletionRing, Loading, ErrorState, EmptyState, StarRating, Cover } from '../components';
```

- [ ] **Step 2: Compute top-rated items and per-collection averages**

In `Statistics`, after the `consumption` array computation (around line 57), add:

```javascript
  const topRated = [...idx]
    .filter(i => i.owned !== false && i.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const collAvgRatings = {};
  cols_.forEach(c => {
    const ratedInColl = idx.filter(i => i.owned !== false && i.coll === c.name && i.rating != null);
    if (ratedInColl.length) {
      const avg = ratedInColl.reduce((s, i) => s + i.rating, 0) / ratedInColl.length;
      collAvgRatings[c.id] = Math.round(avg * 2) / 2;
    }
  });
```

- [ ] **Step 3: Add Top Rated panel**

In the JSX, after the `consumption` panel (after the closing `</div>` of the `{consumption.length > 0 && ...}` block, around line 220), add:

```jsx
      {topRated.length > 0 && (
        <div className="panel stat-panel" style={{ marginTop: 22 }}>
          <div className="section-head" style={{ margin: "0 0 18px" }}>
            <div className="eyebrow">Top rated</div>
            <span style={{ fontSize: 12.5, color: "var(--mute)" }}>Your highest-rated items</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topRated.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                onClick={() => ctx.openItem(item)}>
                <Cover item={item} h={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--mute)" }}>{item.coll}</div>
                </div>
                <StarRating value={item.rating} size={14} readonly />
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Add per-collection average rating to completeness bar chart rows**

Find the completeness bar chart (the `sorted.map(c => ...)` block around line 65 in the JSX). The bar-row currently looks like:

```jsx
            {sorted.map(c => (
```

Find where the collection name and bar are rendered. Add the avg rating next to the collection name. Look for the pattern that renders the collection name in the bar-row and add:

```jsx
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <span>{c.name}</span>
                {collAvgRatings[c.id] != null && (
                  <StarRating value={collAvgRatings[c.id]} size={10} readonly />
                )}
              </div>
```

(Replace the plain `{c.name}` or equivalent text node in the bar-row. Read the actual JSX carefully to find the exact replacement point.)

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/views/Statistics.tsx
git commit -m "feat: add top-rated panel and per-collection avg rating to statistics"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Data layer (Task 1) ✓ · StarRating component (Task 2) ✓ · Series number field + auto-parse (Task 3) ✓ · Rating in item detail (Task 4) ✓ · Series strip (Task 5) ✓ · Cards + sort (Task 6) ✓ · Series view avg (Task 7) ✓ · Statistics (Task 8) ✓
- [x] **Placeholder scan:** All steps have concrete code. No TBD/TODO.
- [x] **Type consistency:** `StarRating` props are identical across all tasks. `saveRating` signature matches usage in Task 4. `series_number` field name is consistent across db.ts, forms.tsx, and Series.tsx.
- [x] **Task 8 Step 4 note:** The exact bar-row JSX must be read at implementation time — the step says to read it. The surrounding code context and intent are unambiguous.
