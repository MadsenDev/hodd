import React from 'react';
import { I } from '../icons';
import { Cover, Loading, ErrorState } from '../components';
import { useSearchIndex } from '../hooks';
import { OllamaClient } from '../api';
import { searchHoard } from '../engine';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppCtx {
  openItem: (item: Record<string, unknown>) => void;
  [key: string]: unknown;
}

interface SearchViewProps {
  initial?: string;
  ctx: AppCtx;
  ollamaModel?: string;
}

interface SavedFilter {
  id: string;
  name: string;
  query: string;
}

interface SearchResult {
  q: string;
  aiPowered: boolean;
  tokens?: [string, string][];
  summary?: string;
  results: Record<string, unknown>[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_SUGGESTIONS: Record<string, string[]> = {
  game:  ["Games I haven't completed", "Games I'm still missing"],
  book:  ["Books I haven't read yet", "Books I'm still missing"],
  movie: ["Movies I own but haven't watched", "Movies I'm still missing"],
  vinyl: ["Vinyl I'm still missing", "Vinyl I own"],
  coin:  ["Coins I'm still missing", "Coins I own"],
  comic: ["Comics I haven't read", "Comics I'm still missing"],
};

function buildSuggestions(idx: any[]): string[] {
  const types = [...new Set(idx.map(i => i.type).filter(Boolean))] as string[];
  const colls = [...new Set(idx.map(i => i.coll).filter(Boolean))] as string[];
  const series = [...new Set(idx.map(i => i.series).filter(Boolean))] as string[];
  const out: string[] = [];
  for (const t of types) {
    const s = TYPE_SUGGESTIONS[t];
    if (s) out.push(s[0]);
    if (out.length >= 4) break;
  }
  if (series.length > 0 && out.length < 6) out.push(`${series[0]} items I'm missing`);
  if (colls.length > 0 && out.length < 6) out.push(`Everything in ${colls[0]}`);
  return out.slice(0, 6);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchView({ initial, ctx, ollamaModel }: SearchViewProps) {
  const index = useSearchIndex();
  const [value, setValue] = React.useState(initial || "");
  const [out, setOut] = React.useState<SearchResult | null>(null);
  const [phase, setPhase] = React.useState<"idle" | "thinking" | "done">("idle");
  const [aiPending, setAiPending] = React.useState(false);
  const [ollamaOn, setOllamaOn] = React.useState(false);
  const [ollamaAvail, setOllamaAvail] = React.useState(false);
  const [savedFilters, setSavedFilters] = React.useState<SavedFilter[]>([]);
  const [savingFilter, setSavingFilter] = React.useState(false);
  const [saveFilterName, setSaveFilterName] = React.useState("");
  // Fix 9: track AI search failures so we can show the user a message
  const [aiError, setAiError] = React.useState(false);

  React.useEffect(() => {
    OllamaClient.isRunning().then((r: boolean) => setOllamaAvail(r));
  }, []);

  React.useEffect(() => {
    const api = (window as any).hoddDesktop?.api;
    if (!api) return;
    api.getSavedFilters().then(setSavedFilters).catch(() => {});
  }, []);

  // Fix 11: wrap `run` in useCallback so it has a stable identity and can be
  // listed in the useEffect dependency array without causing infinite loops.
  const run = React.useCallback(async (q?: string) => {
    const query = (q == null ? value : q);
    if (!query.trim() || !index.data) return;
    setValue(query);
    setPhase("thinking");
    setAiError(false);

    // Always run heuristic for instant token tags
    const heuristic: SearchResult = { ...searchHoard(query, index.data), q: query, aiPowered: false };
    setOut(heuristic);
    setTimeout(() => setPhase("done"), 220);

    if (ollamaOn && ollamaAvail && ollamaModel) {
      setAiPending(true);
      try {
        const result = await OllamaClient.ollamaSearch(query, index.data, ollamaModel);
        if (result) { setOut(result); setPhase("done"); }
      } catch (_) {
        // Fix 9: exit AI loading state and surface failure to the user
        setPhase("done");
        setAiError(true);
        // Heuristic results (set above) are still shown to the user.
      }
      setAiPending(false);
    }
  }, [value, index.data, ollamaOn, ollamaAvail, ollamaModel]);

  React.useEffect(() => {
    if (initial && index.data) run(initial);
  }, [index.data]); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ Intentionally omit `run` and `initial` here: we only want this to fire
  //   once when the index first loads, not on every keystroke.

  if (index.loading) return <Loading label="Indexing your hoard…" />;
  if (index.error) return <ErrorState error={index.error} onRetry={index.refetch} label="Couldn't build the search index" />;

  return (
    <div className="view-enter">
      <div className="ai-input-wrap" style={{ maxWidth: 760 }}>
        {/* Fix 10: aria-label for screen readers */}
        <input
          className="ai-input"
          autoFocus
          placeholder={"Ask anything… e.g. "Game Boy games I haven't completed""}
          aria-label="Search your collection"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") run(); }}
        />
        <button className="ai-go" onClick={() => run()}><I.sparkle size={18} /></button>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {ollamaAvail ? (
          <button className={"btn" + (ollamaOn ? " solid" : "")} style={{ padding: "5px 12px", fontSize: 12 }}
            onClick={() => setOllamaOn(v => !v)}>
            <I.sparkle size={13} /> {ollamaOn ? "Ollama: on" : "Ollama: off"}
          </button>
        ) : (
          <div className="ai-hint"><I.lock size={13} /> Heuristic — run Ollama locally for AI search</div>
        )}
        {ollamaOn && ollamaAvail && (
          <div className="ai-hint" style={{ marginTop: 0 }}>
            <I.sparkle size={13} /> AI-powered search via {ollamaModel || "Ollama"}
          </div>
        )}
        {!ollamaOn && (
          <div className="ai-hint" style={{ marginTop: 0 }}><I.lock size={13} /> Parsed on-device</div>
        )}
      </div>
      <div className="add-examples" style={{ marginTop: 12 }}>
        <span className="add-examples-lbl">Try</span>
        {buildSuggestions(index.data || []).map((s: string) => <div key={s} className="chip" onClick={() => run(s)}>{s}</div>)}
      </div>

      {/* Fix 9: inline notice when AI search fails but on-device results are available */}
      {aiError && (
        <div className="ai-hint" style={{ marginTop: 8, color: "var(--mute)" }}>
          <I.lock size={13} /> AI search unavailable — showing on-device results.
        </div>
      )}

      {value.trim() && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!savingFilter ? (
            <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setSavingFilter(true)}>
              <I.plus size={13} stroke={2} /> Save this search
            </button>
          ) : (
            <>
              <input
                className="ai-input"
                style={{ maxWidth: 200, fontSize: 13, padding: "6px 12px" }}
                placeholder="Filter name…"
                value={saveFilterName}
                autoFocus
                onChange={e => setSaveFilterName(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === "Enter" && saveFilterName.trim()) {
                    const api = (window as any).hoddDesktop?.api;
                    if (api) {
                      const f = await api.saveFilter(saveFilterName.trim(), value);
                      setSavedFilters((prev: SavedFilter[]) => [f, ...prev]);
                    }
                    setSavingFilter(false);
                    setSaveFilterName("");
                  }
                  if (e.key === "Escape") { setSavingFilter(false); setSaveFilterName(""); }
                }}
              />
              <button className="btn solid" style={{ fontSize: 12, padding: "4px 10px" }} onClick={async () => {
                if (!saveFilterName.trim()) return;
                const api = (window as any).hoddDesktop?.api;
                if (api) {
                  const f = await api.saveFilter(saveFilterName.trim(), value);
                  setSavedFilters((prev: SavedFilter[]) => [f, ...prev]);
                }
                setSavingFilter(false);
                setSaveFilterName("");
              }}>Save</button>
              <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => { setSavingFilter(false); setSaveFilterName(""); }}>Cancel</button>
            </>
          )}
        </div>
      )}

      {savedFilters.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="add-examples-lbl" style={{ fontSize: 12, color: "var(--mute)", marginBottom: 6 }}>Saved searches</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {savedFilters.map((f: SavedFilter) => (
              <div key={f.id} className="chip" style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 6 }}>
                <span onClick={() => run(f.query)} style={{ cursor: "pointer" }}>{f.name}</span>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mute)", padding: 0, fontSize: 14, lineHeight: 1 }}
                  onClick={async () => {
                    const api = (window as any).hoddDesktop?.api;
                    if (api) await api.deleteFilter(f.id);
                    setSavedFilters((prev: SavedFilter[]) => prev.filter(x => x.id !== f.id));
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {out && (
        <div className="search-translate">
          <div className="translate-eyebrow">
            <I.sparkle size={15} /> {phase === "thinking" ? "Translating…" : "Understood as"}
          </div>
          <div className="translate-row">
            {out.tokens && out.tokens.length
              ? out.tokens.map(([k, v], i) => (
                  <div className="token" key={i} style={{ opacity: phase === "thinking" ? 0.35 : 1, transition: `opacity .4s ${i * 0.1}s` }}>{k}: <b>{v}</b></div>
                ))
              : <div className="token" style={{ opacity: phase === "thinking" ? 0.35 : 1 }}>Free text search</div>}
          </div>
        </div>
      )}

      {out && phase === "done" && (
        <>
          {!aiPending && (
            <div className="answer-card">
              <div className="answer-mark"><I.sparkle size={16} /></div>
              <div className="answer-text">{out.summary}</div>
            </div>
          )}
          {aiPending ? (
            <div className="ai-hint" style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8 }}>
              <I.refresh size={13} className="spin" /> AI is refining results…
            </div>
          ) : out.results.length > 0 ? (
            <div>
              <div className="section-head" style={{ marginTop: 24 }}>
                <div className="eyebrow">{out.total} result{out.total !== 1 ? "s" : ""}{out.total > out.results.length ? ` · showing ${out.results.length}` : ""}</div>
              </div>
              <div className="items-grid">
                {out.results.map((it: Record<string, unknown>) => (
                  <div className={"item-cell" + (it.owned === false ? " missing" : "")} key={it.id as string} onClick={() => ctx.openItem(it)}>
                    <Cover item={it} h={200} ghost={it.owned === false} />
                    <div className="nm">{it.title as string}</div>
                    <div className="yr">{(it.platform || it.author || it.sub || it.coll) as string}{it.year ? ` · ${it.year}` : ""}</div>
                    {it.owned === false
                      ? <div className="badge badge-missing"><I.plus size={12} stroke={2} /> Missing</div>
                      : <div className="badge badge-owned"><I.check size={12} stroke={2.2} /> Owned</div>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
