import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { I } from '../icons';
import { Loading } from '../components';
import { getSettings, saveSetting, exportData, importData, OllamaClient, saveCatalog, getSearchIndex, invalidateCache } from '../api';
import { useSearchIndex } from '../hooks';
import { OllamaSetupCard } from './OllamaSetupCard';
import { toaster } from '../toaster';

function CompanionSection() {
  const [pairUrl, setPairUrl] = React.useState<string | null>(null);
  const [qrSvg, setQrSvg] = React.useState<string | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);

  async function applyPairUrl(url: string) {
    setPairUrl(url);
    const svg = await QRCode.toString(url, { type: 'svg', width: 200, margin: 2, color: { dark: '#0f0e13', light: '#ffffff' } });
    setQrSvg(svg);
  }

  React.useEffect(() => {
    (window as any).hoddDesktop?.getCompanionStatus?.()
      .then((s: { pairUrl: string }) => applyPairUrl(s.pairUrl))
      .catch(() => {});
  }, []);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await (window as any).hoddDesktop?.regenerateCompanionToken?.();
      if (result?.pairUrl) await applyPairUrl(result.pairUrl);
    } finally {
      setRegenerating(false);
    }
  }

  if (!pairUrl) return null;

  return (
    <div className="panel settings-panel">
      <div className="section-head" style={{ margin: "0 0 8px" }}>
        <div className="eyebrow">Companion App</div>
      </div>
      <p className="settings-hint">
        Scan the QR code with your phone camera to open and pair the companion app.
        Both devices must be on the same Wi-Fi network.
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 16 }}>
        {qrSvg ? (
          <div style={{ background: "#ffffff", borderRadius: 14, padding: 12, boxShadow: "0 0 0 1px var(--border-soft)" }}>
            <div dangerouslySetInnerHTML={{ __html: qrSvg }} style={{ display: "block", width: 200, height: 200 }} />
          </div>
        ) : (
          <div style={{ width: 224, height: 224, borderRadius: 14, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--mute)" }}>
            Generating…
          </div>
        )}
        <button className="btn" onClick={handleRegenerate} disabled={regenerating} style={{ fontSize: 13 }}>
          {regenerating ? "Regenerating…" : "Regenerate QR (revokes current access)"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 10, textAlign: "center" }}>
        Regenerating creates a new code and immediately disconnects all paired phones.
      </div>
    </div>
  );
}

interface SettingsProps {
  onSaved?: () => void;
}

export function Settings({ onSaved = undefined }: SettingsProps) {
  const [loading, setLoading] = useState<boolean>(true);

  const [name, setName] = useState<string>("");
  const [joined, setJoined] = useState<string>("");
  const [joinedInput, setJoinedInput] = useState<string>("");
  const [rawgKey, setRawgKey] = useState<string>("");
  const [omdbKey, setOmdbKey] = useState<string>("");

  const [saved, setSaved] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportDone, setExportDone] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [importDone, setImportDone] = useState<boolean>(false);
  const [resetConfirm, setResetConfirm] = useState<boolean>(false);
  const [resetInput, setResetInput] = useState<string>("");
  const [keepApiKeys, setKeepApiKeys] = useState<boolean>(true);

  // Bulk series enrichment
  const searchIndexState = useSearchIndex();
  const allItems: any[] = searchIndexState.data || [];
  const [ollamaRunning, setOllamaRunning] = useState<boolean>(false);
  const [enrichProgress, setEnrichProgress] = useState<string | null>(null);

  useEffect(() => {
    OllamaClient.isRunning().then(setOllamaRunning).catch(() => setOllamaRunning(false));
  }, []);

  useEffect(() => {
    getSettings().then((s: Record<string, string>) => {
      setName(s["user.name"] || "");
      const j = s["user.joined"] || "";
      setJoined(j);
      setJoinedInput(j);
      setRawgKey(s["api.rawg"] || "");
      setOmdbKey(s["api.omdb"] || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Fix 7: async save() with real feedback based on actual save calls
  // Note: saveSetting() is synchronous (fire-and-forget IPC), so we wrap
  // in try/catch to catch any synchronous errors it might throw.
  async function save() {
    setSaving(true);
    try {
      saveSetting('user.name', name.trim() || 'Collector');
      saveSetting('user.joined', joinedInput.trim());
      saveSetting('api.rawg', rawgKey.trim());
      saveSetting('api.omdb', omdbKey.trim());
      setSaved(true);
      if (onSaved) onSaved();
      // Reset saved indicator after 2s
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('[Settings] save failed:', err);
      toaster.error('Settings could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const result = await importData() as { canceled?: boolean } | null;
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
      const result = await exportData() as { canceled?: boolean } | null;
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
    const items: any[] = await getSearchIndex();
    const headers = "title,type,year,platform,series,format,completeness,condition,grade,pressing,edition,ownership,acquired,notes,favorite";
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map((i: any) => [
      i.title, i.type, i.year, i.sub, i.series, i.format,
      i.completeness, i.condition, i.grade, i.pressing, i.edition,
      i.owned !== false ? (i.ownership || "owned") : "wishlist", i.acquired, i.notes, i.favorite ? "true" : "",
    ].map(escape).join(","));
    triggerDownload([headers, ...rows].join("\n"), "hoard.csv", "text/csv");
  }

  async function handleExportJSON() {
    const items: any[] = await getSearchIndex();
    triggerDownload(JSON.stringify(items, null, 2), "hoard.json", "application/json");
  }

  async function handleBulkEnrichSeries() {
    const items: any[] = (await getSearchIndex()).filter((i: any) => i.owned !== false && !i.series);
    if (!items.length) { toaster.success("All owned items already have a series set."); return; }
    const model: string | null = await OllamaClient.getModels().then((m: string[]) => m[0]).catch(() => null);
    if (!model) { toaster.error("No Ollama model found. Please pull a model first."); return; }
    let detected = 0;
    const total = items.length;
    const batchSize = 3;
    for (let i = 0; i < items.length; i += batchSize) {
      setEnrichProgress(`Enriching ${Math.min(i + batchSize, total)} of ${total}…`);
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item: any) => {
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
                {allItems.filter((i: any) => i.owned !== false && !i.series).length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--mute)", fontWeight: 400 }}>
                    ({allItems.filter((i: any) => i.owned !== false && !i.series).length} items)
                  </span>
                )}
              </button>
              {enrichProgress && (
                <span style={{ fontSize: 13, color: "var(--mute)" }}>{enrichProgress}</span>
              )}
            </div>
          </div>
        )}

        <CompanionSection />

        <div className="settings-version">
          <span>HODD</span>
          <span className="settings-version-num">v1.1.0</span>
        </div>

        {/* Fix 8: Two-step reset confirmation — user must type DELETE before reset fires */}
        <div className="panel settings-panel" style={{ borderColor: "rgba(207,107,90,0.3)" }}>
          {!resetConfirm ? (
            <>
              <div className="section-head" style={{ margin: "0 0 8px" }}>
                <div className="eyebrow">Danger zone</div>
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>Reset everything</h3>
              <p className="settings-hint">
                Permanently delete all your collections, items, holdings, and stories. Your base catalog stays intact. This cannot be undone.
              </p>
              <div style={{ marginTop: 16 }}>
                <button
                  className="btn"
                  style={{ color: "#cf6b5a", borderColor: "rgba(207,107,90,0.4)", background: "rgba(207,107,90,0.07)" }}
                  onClick={() => setResetConfirm(true)}
                >
                  Reset everything
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--fg)", lineHeight: 1.6 }}>
                This will permanently delete all your data. First, we'll export a backup.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--fg)", marginBottom: 16, cursor: "pointer" }}>
                <input type="checkbox" checked={keepApiKeys} onChange={e => setKeepApiKeys(e.target.checked)} />
                Keep API keys (RAWG, OMDB)
              </label>
              <input
                className="ef-control"
                type="text"
                placeholder="Type DELETE to confirm"
                value={resetInput}
                onChange={e => setResetInput(e.target.value)}
                style={{ width: "100%", marginBottom: 16 }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" onClick={() => { setResetConfirm(false); setResetInput(""); }}>
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{ color: "#cf6b5a", borderColor: "rgba(207,107,90,0.4)", background: "rgba(207,107,90,0.07)", opacity: resetInput === "DELETE" ? 1 : 0.4 }}
                  disabled={resetInput !== "DELETE"}
                  onClick={async () => {
                    // Export a backup first, then reset only after export completes
                    await handleExportJSON();
                    (window as any).hoddDesktop?.api?.resetAll(keepApiKeys);
                    setTimeout(() => {
                      window.location.reload();
                    }, 300);
                  }}
                >
                  Reset everything
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
