// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { I } from '../icons';
import { Loading } from '../components';
import { getSettings, saveSetting, exportData, importData, OllamaClient, saveCatalog, getSearchIndex, invalidateCache } from '../api';
import { useSearchIndex } from '../hooks';
import { OllamaSetupCard } from './OllamaSetupCard';
import { toaster } from '../toaster';

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

  // Bulk series enrichment
  const searchIndexState = useSearchIndex();
  const allItems = searchIndexState.data || [];
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<string | null>(null);

  useEffect(() => {
    OllamaClient.isRunning().then(setOllamaRunning).catch(() => setOllamaRunning(false));
  }, []);

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
        toaster.success("Archive imported successfully.");
        setTimeout(() => setImportDone(false), 3000);
      }
    } catch (e) {
      toaster.error("Import failed — the archive may be corrupt or from an incompatible version.");
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
        toaster.success("Archive exported successfully.");
        setTimeout(() => setExportDone(false), 3000);
      }
    } catch (e) {
      toaster.error("Export failed — please try again.");
    } finally {
      setExporting(false);
    }
  }

  function triggerDownload(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportCSV() {
    const items = await getSearchIndex();
    const headers = "title,type,year,platform,series,format,completeness,condition,grade,pressing,edition,ownership,acquired,notes,favorite";
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map(i => [
      i.title, i.type, i.year, i.sub, i.series, i.format,
      i.completeness, i.condition, i.grade, i.pressing, i.edition,
      i.owned !== false ? (i.ownership || "owned") : "wishlist", i.acquired, i.notes, i.favorite ? "true" : "",
    ].map(escape).join(","));
    triggerDownload([headers, ...rows].join("\n"), "hoard.csv", "text/csv");
  }

  async function handleExportJSON() {
    const items = await getSearchIndex();
    triggerDownload(JSON.stringify(items, null, 2), "hoard.json", "application/json");
  }

  async function handleBulkEnrichSeries() {
    const items = (await getSearchIndex()).filter(i => i.owned !== false && !i.series);
    if (!items.length) { toaster.success("All owned items already have a series set."); return; }
    const model = await OllamaClient.getModels().then(m => m[0]).catch(() => null);
    if (!model) { toaster.error("No Ollama model found. Please pull a model first."); return; }
    let detected = 0;
    const total = items.length;
    const batchSize = 3;
    for (let i = 0; i < items.length; i += batchSize) {
      setEnrichProgress(`Enriching ${Math.min(i + batchSize, total)} of ${total}…`);
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(async item => {
        const text = item.title + (item.sub ? ' ' + item.sub : '');
        const result = await OllamaClient.enrichItem(text, item.type, model).catch(() => null);
        if (result && result.series) {
          saveCatalog(item.id, { series: result.series });
          detected++;
        }
      }));
    }
    invalidateCache();
    searchIndexState.refetch();
    setEnrichProgress(`Done — ${detected} series detected`);
    setTimeout(() => setEnrichProgress(null), 5000);
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

        <div className="panel settings-panel">
          <div className="section-head" style={{ margin: "0 0 8px" }}>
            <div className="eyebrow">Export your hoard</div>
          </div>
          <p className="settings-hint">
            Download your entire collection as a CSV spreadsheet or a JSON file for use in other apps.
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={handleExportCSV}>
              <I.download size={16} /> Export as CSV
            </button>
            <button className="btn" onClick={handleExportJSON}>
              <I.download size={16} /> Export as JSON
            </button>
          </div>
        </div>

        {ollamaRunning && (
          <div className="panel settings-panel">
            <div className="section-head" style={{ margin: "0 0 8px" }}>
              <div className="eyebrow">Bulk enrich series</div>
            </div>
            <p className="settings-hint">
              Automatically detect the series for items that don't have one set yet, using your local Ollama model.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn" disabled={!!enrichProgress} onClick={handleBulkEnrichSeries}>
                <I.sparkle size={16} /> Detect series for items missing one
                {allItems.filter(i => i.owned !== false && !i.series).length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--mute)", fontWeight: 400 }}>
                    ({allItems.filter(i => i.owned !== false && !i.series).length} items)
                  </span>
                )}
              </button>
              {enrichProgress && (
                <span style={{ fontSize: 13, color: "var(--mute)" }}>{enrichProgress}</span>
              )}
            </div>
          </div>
        )}

        <div className="settings-version">
          <span>HODD</span>
          <span className="settings-version-num">v1.1.0</span>
        </div>

      </div>
    </div>
  );
}
