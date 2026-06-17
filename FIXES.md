# HODD Audit Fix Tracker

Branch: `claude/app-audit-sg665u`

Legend: [ ] todo · [x] done · [~] partial / in-progress

---

## CRITICAL

- [ ] **C1** No tests for DB/IPC/search — add vitest tests for db.ts, searchHoard, importArchive round-trip

---

## HIGH — Security

- [ ] **S1** Companion server binds 0.0.0.0 → change to 127.0.0.1 + shared-secret auth (`electron/main.ts:194`)
- [ ] **S2** CORS wildcard on companion → restrict (`electron/main.ts:97–99`)
- [ ] **S3** Archive import uses attacker-controlled filenames → generate UUID per image (`electron/main.ts:405–411`)
- [ ] **S4** CSP `connect-src` blocks OpenLibrary fetch → add `https://openlibrary.org` (`index.html:7`)
- [ ] **S5** CSP `style-src 'unsafe-inline'` → local font bundle or nonce (`index.html:7`)
- [ ] **S6** LLM output merged without key allowlist → validate keys before spread (`src/api.ts:672–687`)

---

## HIGH — Correctness

- [ ] **B1** Write debounce 400ms = crash data loss → sync flush for critical writes (`electron/db.ts:38–50`)
- [ ] **B2** importArchive drops most holdings + user-item fields → expand both INSERTs (`electron/db.ts:728–765`)
- [ ] **B3** `_catalog` not nulled in `invalidateCache()` → add it (`src/api.ts:39`)
- [ ] **B4** `saveStory` fire-and-forget → add .catch() + toast (`src/api.ts:169`)
- [ ] **B5** `saveSetting` fire-and-forget → add .catch() + toast (`src/api.ts:482`)
- [ ] **B6** `deleteCollection` no rollback → add .catch() + rollback (`src/api.ts:198`)
- [ ] **B7** `createCollection`/`addItem` no error handling → add .catch() + rollback (`src/api.ts:221,235`)
- [ ] **B8** `toggleFavorite` no rollback → add .catch() + rollback (`src/api.ts:188`)
- [ ] **B9** `keydown` effect in ItemDetail has no dep array → add deps (`src/views/ItemDetail.tsx:67`)
- [ ] **B10** Ollama failure silently swallowed → show toast (`src/views/SearchView.tsx:71`)
- [ ] **B11** Settings save() shows success unconditionally → make async, await all saves (`src/views/Settings.tsx:86`)
- [ ] **B12** dataVer forces full view remount → targeted refetch strategy (`src/App.tsx:615`)
- [ ] **B13** No multi-window cache coherency → `hodd:data-changed` IPC broadcast (`src/api.ts`, `electron/main.ts`)

---

## HIGH — Performance

- [ ] **P1** Zero DB indexes → add 4 indexes to schema (`electron/db.ts` schema)
- [ ] **P2** getUserItems() full table scan every call → targeted queries + SQL GROUP BY for growth (`electron/db.ts`, `electron/main.ts`)

---

## HIGH — Build/CI

- [ ] **CI1** No test/typecheck in release pipeline → add steps before build (`release.yml`)
- [ ] **CI2** Electron tsconfig not in root references → add to `tsconfig.json`
- [ ] **CI3** No macOS/Windows code signing → document + configure (manual — requires certs)

---

## MEDIUM — Security

- [ ] **MS1** `updateUserItemFields` interpolates column names into SQL → map through allowed set (`electron/db.ts:662`)
- [ ] **MS2** Sudo password from IPC has no length/type check (`electron/main.ts:563`)
- [ ] **MS3** hodd-img:// path traversal check misleading → clean up (`electron/main.ts:241`)
- [ ] **MS4** Pasted cover URL only checks startsWith("http") (`src/views/ItemDetail.tsx:215`)
- [ ] **MS5** User fields interpolated into Ollama prompts → sanitize/truncate (`src/api.ts:673`)
- [ ] **MS6** Reset fires before export confirmed → require second confirmation (`src/views/Settings.tsx:369`)

---

## MEDIUM — Correctness & UX

- [ ] **MB1** saveHolding reads SELECT * before UPDATE → enumerate columns explicitly (`electron/db.ts:492`)
- [ ] **MB2** addUserItem returns caller draft not DB row → SELECT after INSERT (`electron/db.ts:636`)
- [ ] **MB3** Concurrent ollama:start race → track pending state (`electron/main.ts:600`)
- [ ] **MB4** exportArchive writes renderer payload verbatim → re-fetch DB state (`electron/main.ts:373`)
- [ ] **MB5** useAsync stale closure; errors never surfaced in UI (`src/hooks.ts:12`)
- [ ] **MB6** i.owned not normalized in CollectionDetail filter (`src/views/CollectionDetail.tsx:165`)
- [ ] **MB7** Empty title passes validation in ItemEditForm (`src/forms.tsx:286`)
- [ ] **MB8** Sidebar nav items are div, not keyboard accessible (`src/components.tsx:403`)
- [ ] **MB9** onSearch called twice (div onClick + input onFocus) (`src/components.tsx:443`)
- [ ] **MB10** Custom field rows use array index as key (`src/forms.tsx:435,507`)
- [ ] **MB11** ctx object recreated every render → useMemo (`src/App.tsx:630`)
- [ ] **MB12** QuickCapture Save button discards notes → persist or rename (`src/App.tsx:325`)
- [ ] **MB13** Suggestions useEffect inline computed dep → useMemo (`src/views/CollectionDetail.tsx:46`)

---

## MEDIUM — Code Quality

- [ ] **Q1** `// @ts-nocheck` on all renderer files → remove + fix types
- [ ] **Q2** clearUserData doesn't delete suggested_items (`electron/db.ts:843`)
- [ ] **Q3** sv() silently coerces objects to "[object Object]" → add warning (`electron/db.ts:13`)
- [ ] **Q4** Lookup logic copy-pasted between IPC handler and companion (`electron/main.ts`)
- [ ] **Q5** Hand-rolled CSV parser misses escaped quotes (`src/App.tsx:139`)
- [ ] **Q6** App.tsx 769 lines — extract modal components
- [ ] **Q7** resolveId is dead no-op code (`src/api.ts:18`)
- [ ] **Q8** engine.ts decade regex unreachable branch (`src/engine.ts:255`)
- [ ] **Q9** Type packages in dependencies not devDependencies (`package.json`)
- [ ] **Q10** No Dependabot / npm audit in CI

---

## MEDIUM — Design

- [ ] **D1** Dark mode --text-2 (#b9b6c0) fails WCAG AA → #cac6d4 (`src/styles.css:70`)
- [ ] **D2** Dark mode --mute (#5e5b66) = 2.1:1 → #7f7b8a (`src/styles.css:72`)
- [ ] **D3** Missing ARIA labels (search input, loading mark, HoddMark SVG)
- [ ] **D4** No :focus-visible rule — nav items have no focus indicator
- [ ] **D5** Cover/gameCoverBody: hundreds of lines of inline style={{}} → CSS classes
- [ ] **D6** No spacing scale tokens; magic px values everywhere
- [ ] **D7** No type scale / line-height tokens
- [ ] **D8** Border radius mismatch (add-btn 14px vs button 11px)

---

## LOW

- [ ] API keys in URLs (log exposure) — document
- [ ] dataFilePath not validated (latent) → add path separator check
- [ ] existsSync imported twice → combine import (`electron/main.ts:2–3`)
- [ ] Version hardcoded in companion → import from package.json
- [ ] getActiveProfile called per-favorites-op → cache in module variable
- [ ] hasSuggestionsFor exported but unused → remove or wire up
- [ ] createCollection ID dedup loop unbounded → add cap
- [ ] Ollama install continues after window close → kill on window close
- [ ] hodd:home-dynamic double full-table scan → consolidate
- [ ] getCatalog returns all rows → add collection filter option
- [ ] Gallery JSON stringify/parse round-trip in UI layer → stringify in IPC
- [ ] Array index as key for deletable custom field rows → stable IDs
- [ ] CollectionDetail EmptyState: unbounded search string → truncate
- [ ] Story generation failure only console.warn → toast
- [ ] Auto-fill series number re-fires after user clears → track intent
- [ ] CreateCollectionModal initializes with 2 blank rows → init with []
- [ ] facts table keys on label strings (not unique) → use index
- [ ] ProfileSwitcher onSwitched prop never passed → pass or remove prop
- [ ] shelfRng hash function needs comment
- [ ] combine() in hooks.ts may be unused → verify
- [ ] mobile topbar color-mix needs fallback
- [ ] !important in .items-grid → fix cascade
- [ ] error color #cf6b5a hardcoded → --danger token
- [ ] A7 companion server version string hardcoded → import from package.json
- [ ] engines field missing from package.json
- [ ] electron-builder not pinned to exact version
- [ ] typecheck:electron script missing
- [ ] No .github/dependabot.yml
- [ ] vite.config.ts missing explicit sourcemap: false
- [ ] skipLibCheck compound risk — noted
- [ ] GH_TOKEN vs GITHUB_TOKEN inconsistency in release.yml
- [ ] No branch guard in release workflow
