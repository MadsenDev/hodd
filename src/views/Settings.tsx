// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { I } from '../icons';
import { Loading } from '../components';
import { getSettings, saveSetting, exportData, OllamaClient } from '../api';

export function Settings({ onSaved = undefined }) {
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [joined, setJoined] = useState("");
  const [joinedInput, setJoinedInput] = useState("");
  const [rawgKey, setRawgKey] = useState("");
  const [omdbKey, setOmdbKey] = useState("");

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaChecked, setOllamaChecked] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setName(s["user.name"] || "");
      const j = s["user.joined"] || "";
      setJoined(j);
      setJoinedInput(j);
      setRawgKey(s["api.rawg"] || "");
      setOmdbKey(s["api.omdb"] || "");
      setLoading(false);
    }).catch(() => setLoading(false));

    OllamaClient.isRunning().then(running => {
      setOllamaRunning(running);
      if (running) OllamaClient.getModels().then(setOllamaModels).catch(() => {});
      setOllamaChecked(true);
    }).catch(() => setOllamaChecked(true));
  }, []);

  function save() {
    setSaving(true);
    saveSetting("user.name", name.trim() || "Collector");
    saveSetting("user.joined", joinedInput.trim());
    saveSetting("api.rawg", rawgKey.trim());
    saveSetting("api.omdb", omdbKey.trim());
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaved(false), 2500);
    }, 300);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportData();
      if (result && !result.canceled) {
        setExportDone(true);
        setTimeout(() => setExportDone(false), 3000);
      }
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <Loading label="Loading settings…" />;

  return (
    <div className="view-enter">
      <div className="settings-layout">

        <div className="panel settings-panel">
          <div className="section-head" style={{ margin: "0 0 20px" }}>
            <div className="eyebrow">Profile</div>
          </div>
          <label className="ef-field ef-wide">
            <span className="ef-k">Display name</span>
            <input className="ef-control" type="text" value={name}
              onChange={e => setName(e.target.value)} placeholder="Your name" />
          </label>
          <label className="ef-field" style={{ marginTop: 12 }}>
            <span className="ef-k">Collecting since</span>
            <input className="ef-control" type="text" value={joinedInput}
              onChange={e => setJoinedInput(e.target.value)} placeholder={String(new Date().getFullYear())} style={{ maxWidth: 120 }} />
          </label>
          <div className="ef-hint" style={{ marginTop: 8 }}>Everything is stored locally on this device.</div>
        </div>

        <div className="panel settings-panel">
          <div className="section-head" style={{ margin: "0 0 8px" }}>
            <div className="eyebrow">Local AI — Ollama</div>
          </div>
          {!ollamaChecked ? (
            <p className="settings-hint">Checking for Ollama…</p>
          ) : ollamaRunning ? (
            <>
              <p className="settings-hint" style={{ color: "var(--success, #5ba47a)" }}>
                <I.check size={14} stroke={2.2} /> Ollama is connected.
              </p>
              {ollamaModels.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="ef-hint" style={{ marginBottom: 8 }}>Available models — select one in the Tweaks panel <span style={{ opacity: 0.6 }}>(⚙ top-right)</span></div>
                  <div className="model-list">
                    {ollamaModels.map(m => <span key={m} className="model-tag">{m}</span>)}
                  </div>
                </div>
              )}
              {ollamaModels.length === 0 && (
                <p className="settings-hint" style={{ marginTop: 8 }}>
                  No models pulled yet. Run <code>ollama pull llama3.2</code> or similar to get started.
                </p>
              )}
            </>
          ) : (
            <p className="settings-hint">
              Ollama is not running. Install and start{" "}
              <b>Ollama</b> locally to enable AI-powered item enrichment,
              story generation, and natural-language search.
              Models run entirely on your machine — nothing is sent to the cloud.
            </p>
          )}
        </div>

        <div className="panel settings-panel">
          <div className="section-head" style={{ margin: "0 0 8px" }}>
            <div className="eyebrow">Online metadata</div>
          </div>
          <p className="settings-hint">
            When you add items, HODD enriches them with real metadata from free APIs.
            Books use Open Library and vinyl uses MusicBrainz — no keys needed.
            Add keys below to unlock game and movie lookups.
          </p>

          <label className="ef-field ef-wide" style={{ marginTop: 20 }}>
            <span className="ef-k">
              RAWG.io API key
              <span className="key-badge">Games</span>
            </span>
            <input className="ef-control" type="password" value={rawgKey}
              onChange={e => setRawgKey(e.target.value)}
              placeholder="Free key at rawg.io/apidocs" />
          </label>

          <label className="ef-field ef-wide" style={{ marginTop: 12 }}>
            <span className="ef-k">
              OMDb API key
              <span className="key-badge">Movies</span>
            </span>
            <input className="ef-control" type="password" value={omdbKey}
              onChange={e => setOmdbKey(e.target.value)}
              placeholder="Free key at omdbapi.com (1000/day)" />
          </label>
        </div>

        <div className="settings-actions">
          <button className="btn solid" onClick={save} disabled={saving}>
            {saved
              ? <><I.check size={16} stroke={2.2} /> Saved</>
              : saving ? "Saving…"
              : <><I.check size={16} /> Save settings</>}
          </button>
        </div>

        <div className="panel settings-panel">
          <div className="section-head" style={{ margin: "0 0 8px" }}>
            <div className="eyebrow">Data &amp; backup</div>
          </div>
          <p className="settings-hint">
            Export your entire hoard as a JSON file — collections, items, holdings, and
            catalog overrides. Keep this somewhere safe as a backup or to migrate to
            a new machine.
          </p>
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={handleExport} disabled={exporting}>
              {exportDone
                ? <><I.check size={16} stroke={2} /> Exported</>
                : exporting ? "Preparing…"
                : <><I.download size={16} /> Export hoard</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
