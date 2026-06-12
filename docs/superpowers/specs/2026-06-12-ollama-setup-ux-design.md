# Ollama Setup UX — In-App Automation

**Date:** 2026-06-12
**Status:** Approved

## Goal

Make Ollama setup zero-friction and entirely in-app. The user should never need to open a terminal or leave the HODD window to get local AI working.

## State Machine

The `OllamaSetupCard` in Settings cycles through these states in order:

| State | Display | Primary action |
|---|---|---|
| `checking` | Spinner — "Checking for Ollama…" | — |
| `not-installed` | Icon + description copy | [Install Ollama] → inline confirm panel |
| `installing` | Scrollable terminal log pane, streaming install output | [Cancel] |
| `not-running` | "Ollama is installed but not running." | [Start Ollama] |
| `starting` | Spinner — "Starting Ollama…" | — |
| `no-models` | Curated model picker | [Pull model] |
| `pulling` | Model name + animated progress bar (streamed) | — |
| `ready` | Green pill + active model badge | "Pull another model" (collapses to picker) |

Transitions are automatic where possible (install completion → not-running, start success → no-models or ready, pull completion → ready).

## Curated Model Picker

Three options shown with name + one-line description:

- **llama3.2** — Balanced. Fast on most machines. Good default.
- **mistral** — Strong reasoning. Slightly larger.
- **phi3** — Lightweight. Best for low-RAM machines.

## IPC Layer

### New handlers in `electron/main.ts`

| Channel | Direction | Description |
|---|---|---|
| `hodd:ollama:check-installed` | invoke | Returns `{ installed: boolean }` — checks PATH for `ollama` binary |
| `hodd:ollama:install` | invoke | Spawns install script, returns immediately; streams via events |
| `hodd:ollama:start` | invoke | Spawns `ollama serve`, polls until ready, returns `{ ok, error? }` |
| `hodd:ollama:pull` | invoke | Spawns `ollama pull <model>`, streams progress; returns `{ ok, error? }` |
| `hodd:ollama:stop` | invoke | Kills app-managed serve process if running |

### Streaming events (main → renderer via `webContents.send`)

- `hodd:ollama:stream` — `{ type: 'stdout' | 'stderr' | 'done' | 'error', data: string }` — install log lines
- `hodd:ollama:pull-progress` — `{ layer: string, status: string, pct: number | null }` — pull layer progress

### New preload methods

```ts
installOllama(): Promise<void>
startOllama(): Promise<{ ok: boolean; error?: string }>
pullModel(name: string): Promise<{ ok: boolean; error?: string }>
stopOllama(): Promise<void>
onStream(cb: (event) => void): void
offStream(): void
onPullProgress(cb: (event) => void): void
offPullProgress(): void
```

## Platform Install Strategy

| Platform | Approach |
|---|---|
| Linux | `spawn('sh', ['-c', 'curl -fsSL https://ollama.com/install.sh \| sh'])` — fully streamed in-app |
| macOS | Check for Homebrew first (`which brew`). If present: `brew install ollama`. If not: open `https://ollama.com/download/mac` in a child `BrowserWindow` (stays in-app) |
| Windows | Open `https://ollama.com/download/windows` in a child `BrowserWindow` |

## Renderer Component

Extract `OllamaSetupCard` from `Settings.tsx`. Responsibilities:
- Owns the state machine with `useState`
- On mount: calls `checkInstalled` + `status` to determine initial state
- Registers `onStream` / `onPullProgress` listeners in `useEffect`, removes them on unmount
- Renders current state's UI; no wizard navigation — single card morphs in place

## Auto-Select Behaviour

On reaching `ready` after a pull:
- If no model is currently configured in settings → auto-write the pulled model name to `settings` via `hodd:setting:save` so it is immediately active for search, enrichment, and story generation
- If a model is already configured → leave it unchanged, just show the green status

## Error Handling

| Failure point | Behaviour |
|---|---|
| Install script exits non-zero | Log pane stays open with output + "Try again" button |
| `ollama serve` exits within 5s or polling times out (15s) | Error message inline + "Try again" |
| Pull fails | Error inline, model picker stays available to retry or choose another |
| App quit with managed serve | `app.on('before-quit')` kills child process. Tracked with `appManagedServe: boolean` flag — pre-existing Ollama processes are never killed. |

## Re-check on Mount

Every time the Settings view mounts, state is re-derived from scratch (check-installed → status). If the user installs Ollama externally between sessions it is detected automatically.
