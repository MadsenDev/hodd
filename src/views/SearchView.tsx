// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Cover, Loading, ErrorState } from '../components';
import { useSearchIndex } from '../hooks';
import { OllamaClient } from '../api';
import { searchHoard } from '../engine';

const SEARCH_SAMPLES = [
  "Which Tolkien books am I missing?",
  "Game Boy games I haven't completed",
  "Movies I own but haven't watched",
  "Books I haven't read yet",
  "Coins from the 1920s",
  "Vinyl I'm still missing",
];

export function SearchView({ initial, ctx, ollamaModel }) {
  const index = useSearchIndex();
  const [value, setValue] = React.useState(initial || "");
  const [out, setOut] = React.useState(null);
  const [phase, setPhase] = React.useState("idle");
  const [aiPending, setAiPending] = React.useState(false);
  const [ollamaOn, setOllamaOn] = React.useState(false);
  const [ollamaAvail, setOllamaAvail] = React.useState(false);

  React.useEffect(() => {
    OllamaClient.isRunning().then(r => setOllamaAvail(r));
  }, []);

  async function run(q) {
    const query = (q == null ? value : q);
    if (!query.trim() || !index.data) return;
    setValue(query);
    setPhase("thinking");

    // Always run heuristic for instant token tags
    const heuristic = { ...searchHoard(query, index.data), q: query, aiPowered: false };
    setOut(heuristic);
    setTimeout(() => setPhase("done"), 220);

    if (ollamaOn && ollamaAvail && ollamaModel) {
      setAiPending(true);
      try {
        const result = await OllamaClient.ollamaSearch(query, index.data, ollamaModel);
        if (result) { setOut(result); setPhase("done"); }
      } catch (_) {}
      setAiPending(false);
    }
  }

  React.useEffect(() => { if (initial && index.data) run(initial); /* eslint-disable-next-line */ }, [index.data]);

  if (index.loading) return <Loading label="Indexing your hoard…" />;
  if (index.error) return <ErrorState error={index.error} onRetry={index.refetch} label="Couldn't build the search index" />;

  return (
    <div className="view-enter">
      <div className="ai-input-wrap" style={{ maxWidth: 760 }}>
        <input className="ai-input" autoFocus placeholder={"Ask anything… e.g. “Game Boy games I haven’t completed”"}
          value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") run(); }} />
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
        {SEARCH_SAMPLES.map(s => <div key={s} className="chip" onClick={() => run(s)}>{s}</div>)}
      </div>

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
                {out.results.map(it => (
                  <div className={"item-cell" + (it.owned === false ? " missing" : "")} key={it.id} onClick={() => ctx.openItem(it)}>
                    <Cover item={it} h={200} ghost={it.owned === false} />
                    <div className="nm">{it.title}</div>
                    <div className="yr">{it.platform || it.author || it.sub || it.coll}{it.year ? ` · ${it.year}` : ""}</div>
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
