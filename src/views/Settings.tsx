// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { I } from '../icons';
import { Loading } from '../components';
import { getSettings, saveSetting, exportData, importData } from '../api';
import { OllamaSetupCard } from './OllamaSetupCard';

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
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

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

  async function handleImport() {
    setImporting(true);
    try {
      const result = await importData();
      if (result && !result.canceled) {
        setImportDone(true);
        if (onSaved) onSaved();
        setTimeout(() => setImportDone(false), 3000);
      }
    } finally {
      setImporting(false);
    }
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

        <OllamaSetupCard />

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
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={handleExport} disabled={exporting}>
              {exportDone
                ? <><I.check size={16} stroke={2} /> Exported</>
                : exporting ? "Preparing…"
                : <><I.download size={16} /> Export hoard</>}
            </button>
            <button className="btn" onClick={handleImport} disabled={importing}>
              {importDone
                ? <><I.check size={16} stroke={2} /> Imported</>
                : importing ? "Importing…"
                : <><I.upload size={16} /> Import archive</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
