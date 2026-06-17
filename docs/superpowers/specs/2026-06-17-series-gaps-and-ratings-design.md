# Series Gap Visualization & Rating System

**Date:** 2026-06-17  
**Status:** Approved

---

## Overview

Two features added to HODD:

1. **Series gap visualization** — a number-line strip in the series detail view that makes missing items visible by shape.
2. **Rating system** — 1–5 half-star ratings on items, displayed on cards, in the series view, and in statistics.

---

## Data Layer

### New columns

Added to `user_items` and `catalog_overrides`:

| Column | Type | Notes |
|---|---|---|
| `series_number` | `REAL` | nullable; e.g. `4` or `4.5` for a spinoff |
| `rating` | `REAL` | nullable; 0.5–5.0 in 0.5 increments |

Migration: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in the existing migration block in `electron/db.ts`. Both fields are added to the search index payload so all views can read them without extra queries.

### Auto-parse for series_number

Runs in the `AddItemModal` / edit form when a title is entered with a series set but `series_number` empty. Regex patterns matched (case-insensitive):

- `#4`, `# 4`
- `Vol. 3`, `Volume 3`
- `Book 3`, `Part 3`, `Ep. 3`, `Episode 3`, `Chapter 3`
- Roman numerals I–XX (e.g. `Part IV`)

If matched, the field is pre-filled. User can override or clear it. No auto-parse on save — only on form open/title change.

---

## Series Gap Visualization

### Where

Series detail view only (the drilldown after clicking a series in the list). The overview list (completion rings) is unchanged.

### The strip

Rendered above the owned/missing grids when **at least one item in the series has a `series_number`**.

- One block per integer position from `min(series_number)` to `max(series_number)`
- **Owned block:** filled in the series accent color; hovering shows a small cover tooltip with the item title
- **Missing block:** hollow with dashed border, same dimensions
- **Fractional numbers** (e.g. 4.5): rendered as a half-width block inserted between 4 and 5
- Clicking a block scrolls to and highlights that item in the grid below
- If no items have a series number, the strip is hidden — existing layout is fully preserved

### Grid sort order

When the strip is present, the owned/missing grids below sort by `series_number` ascending (nulls last). Items without a number sort to the end.

---

## Rating System

### StarRating component

A reusable `StarRating` component in `src/components.tsx`:

- 5 stars rendered as SVG; each star split into left/right hover zones for half-star precision
- Hover previews the value; click sets it; clicking the active value clears it (sets to null)
- Read-only variant (no interaction) used for display on cards and in aggregate views
- Props: `value: number | null`, `onChange?: (v: number | null) => void`, `size?: number`, `readonly?: boolean`

### Item detail page

- `StarRating` placed in the facts section, between Condition and Acquired
- Only shown for owned items
- Saves immediately via `saveHolding` (same pattern as watched/completed)

### Collection grid cards

- When `item.rating` is set, a small read-only `StarRating` (size ~10px) renders below the title
- Items without a rating show nothing — no empty star placeholder

### Collection grid sorting

New "Top Rated" option added to the sort segmented control in `CollectionDetail`. Sorts descending by rating; unrated items sorted last.

### Series view

- **Series detail header:** when at least one item has a rating, show average stars (read-only `StarRating`) next to the completion ring
- **Series list overview:** show average rating in small text next to the item count for series that have any rated items

### Statistics view

Two additions:

1. **Top Rated panel** — top 5 highest-rated owned items across all collections. Shows cover, title, collection name, and star rating.
2. **Per-collection average** — the completeness bar chart rows get their average rating in small muted text if the collection has any rated items.

---

## Files Changed

| File | Change |
|---|---|
| `electron/db.ts` | Add columns, migration, expose in search index |
| `src/components.tsx` | Add `StarRating` component |
| `src/views/Series.tsx` | Add number-line strip, sort by series_number, avg rating in header/list |
| `src/views/CollectionDetail.tsx` | Show rating on cards, add Top Rated sort |
| `src/views/ItemDetail.tsx` | Add StarRating to facts section |
| `src/views/Statistics.tsx` | Add Top Rated panel + per-collection avg rating |
| `src/forms.tsx` | Add series_number field with auto-parse, rating excluded from forms (set inline) |
| `src/App.tsx` | Pass series_number + rating through enrichItem / search index |

---

## Out of Scope

- Rating catalog items (items not in `user_items`) — only owned/wishlist user items are rateable
- Bulk rating
- Rating-based recommendations
- Series number on catalog items (catalog_overrides gets the column but no UI for setting it)
