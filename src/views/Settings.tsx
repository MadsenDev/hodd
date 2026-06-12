// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { I } from '../icons';
import { Loading } from '../components';
import { getSettings, saveSetting } from '../api';

export function Settings() {
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [joined, setJoined] = useState("");
  const [rawgKey, setRawgKey] = useState("");
  const [omdbKey, setOmdbKey] = useState("");

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setName(s["user.name"] || "");
      setJoined(s["user.joined"] || "");
      setRawgKey(s["api.rawg"] || "");
      setOmdbKey(s["api.omdb"] || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function save() {
    setSaving(true);
    saveSetting("user.name", name.trim() || "Collector");
    if (rawgKey.trim()) saveSetting("api.rawg", rawgKey.trim());
    if (omdbKey.trim()) saveSetting("api.omdb", omdbKey.trim());
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 300);
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
          {joined && (
            <div className="ef-hint" style={{ marginTop: 8 }}>Collecting since {joined}. Stored locally on this device.</div>
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

      </div>
    </div>
  );
}
