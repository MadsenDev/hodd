# Changelog

All notable changes to HODD will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — 1.1.0

### Added
- **Item photo uploads** — attach real photos to any item. Pick a cover photo that replaces the procedurally generated cover, add a gallery of additional shots, and set any gallery image as the primary cover. Photos are stored locally in the app data directory and served via a secure `hodd-img://` custom protocol. Removing an item or its photos cleans up the files automatically.

---

## [1.0.0] — 2026-06-13

Initial release of HODD — a local-first desktop companion for personal collections.

### Added

**Core architecture**
- Electron 42 shell with context-isolated preload, hardened IPC bridge, and `contextIsolation: true`
- SQLite database (sql.js) persisted to `userData/hodd.db` with debounced auto-save
- In-memory API cache layer with optimistic updates and async IPC persistence
- First-run seed from bundled `catalog.json`, `holdings.json`, and `stories.json`
- Full archive export and import (JSON) with native save/open dialogs

**Collections**
- Six built-in collection types: Game, Book, Movie, Coin, Comic, Vinyl
- User-created collections with custom type, accent colour, and field templates
- Base catalog items (seeded) plus user-owned items per collection
- Completion tracking: owned / missing counts, percentage ring
- Collection deletion with cascade (items, holdings, stories, favorites)

**Item management**
- Shorthand quick-add: type one item per line, parsed heuristically on-device
- AI enrichment via Ollama: extracts title, year, platform, author, grade, pressing, etc.
- Online metadata lookup: OpenLibrary (books), MusicBrainz (vinyl), RAWG (games, API key), OMDB (movies, API key)
- Full item edit form: title, sub, year, type, series, region, format, condition, acquired, completeness, grade, pressing, edition, watched/read/completed toggles, custom fields
- Item provenance stories: write your own or generate with Ollama
- Favorites: mark any owned item as treasured; `F` shortcut in item detail
- Delete with confirmation for user-created items

**Views**
- **Home** — greeting, recent additions, Rediscover prompt, snapshot stats, wishlist preview; two layouts (Collection-first / Dashboard)
- **Collections** — all collections as cards or shelves (spine mosaic or cover shelf); collection creation modal
- **Collection Detail** — full item grid with completion progress bar, sort controls (default, A–Z, year, status), search filter, progress badges (owned / missing)
- **Item Detail** — cover, facts panel, story, related items strip, prev/next keyboard navigation (← →)
- **Search** — heuristic keyword + intent parsing (owned, missing, unwatched, year range, type); optional Ollama natural-language mode with summary; sample query chips
- **Wishlist** — all missing items across every collection
- **Favorites** — treasured items with sort options
- **Timeline** — chronological acquisition history
- **Statistics** — 6-month acquisition growth chart
- **Settings** — user profile, API keys (RAWG, OMDB), archive import/export, Ollama setup

**Ollama integration**
- Full setup flow: check installed → install (curl/Homebrew) → start server → pull model
- Streaming install and pull progress in-app
- Sudo password prompt for Linux installs requiring elevated permissions
- Model picker: llama3.2 (default), mistral, phi3
- AI capabilities: item enrichment, natural-language search, story generation

**Theming**
- Light / dark mode
- Six accent colour palettes
- Two headline fonts (Bricolage Grotesque, Space Grotesk)
- Home and Collections layout options
- Shelf art mode: covers or spines
- Tweaks panel (dev overlay) for all theme settings

**UX**
- Responsive layout: sidebar nav on desktop, bottom tab bar on mobile/narrow
- `Cmd/Ctrl+K` to open add modal; `Escape` to close overlays
- `←` / `→` arrow keys to browse items within a collection
- Saved indicator after item edits
- Procedurally generated covers for all item types (no image required)

---

[Unreleased]: https://github.com/madsendev/hodd/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/madsendev/hodd/releases/tag/v1.0.0
