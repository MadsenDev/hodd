// @ts-nocheck
import React, { useState } from 'react';
import { typeIcon } from '../icons';
import { saveSetting, createCollection, invalidateCache } from '../api';

const COLLECTION_TYPES = [
  { type: "game",  label: "Games" },
  { type: "book",  label: "Books" },
  { type: "movie", label: "Movies" },
  { type: "coin",  label: "Coins" },
  { type: "comic", label: "Comics" },
  { type: "vinyl", label: "Vinyl" },
];

const ACCENT_OPTIONS = ["#4f46e5", "#0d9488", "#e2503b", "#2563eb", "#7c3aed", "#d97706"];

export function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [accent, setAccent] = useState(ACCENT_OPTIONS[0]);

  function toggleType(type) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function finish() {
    setStep(4);
    if (name.trim()) {
      saveSetting("user.name", name.trim());
    }
    for (const { type, label } of COLLECTION_TYPES) {
      if (selected.has(type)) {
        await createCollection({ name: `My ${label}`, type, accent, template: [] });
      }
    }
    saveSetting("onboarded", "1");
    invalidateCache();
    onDone();
  }

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  };

  const cardStyle = {
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 32,
    textAlign: "center",
  };

  const headlineStyle = {
    fontFamily: "var(--display)",
    fontSize: 36,
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
    lineHeight: 1.1,
  };

  const subStyle = {
    fontSize: 16,
    color: "var(--mute)",
    margin: "8px 0 0",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    fontSize: 16,
    background: "var(--panel)",
    color: "var(--text)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    outline: "none",
    fontFamily: "var(--sans)",
  };

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div style={overlayStyle}>
        <div style={{ ...cardStyle, gap: 0 }}>
          {/* Logo mark */}
          <div style={{
            width: 72, height: 72, borderRadius: 20, background: "var(--accent)", marginBottom: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px -8px var(--accent)",
          }}>
            <span style={{ fontFamily: "var(--display)", fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>H</span>
          </div>
          <h1 style={{ ...headlineStyle, marginBottom: 12 }}>Welcome to Hodd</h1>
          <p style={{ fontSize: 16, color: "var(--mute)", margin: "0 0 40px", lineHeight: 1.5 }}>
            Your personal collection,<br />beautifully kept.
          </p>
          <button className="btn solid" style={{ padding: "12px 32px", fontSize: 15, borderRadius: 12, justifyContent: "center" }} onClick={() => setStep(1)}>
            Get started
          </button>
          <p style={{ fontSize: 12, color: "var(--mute)", marginTop: 20, opacity: 0.7 }}>Everything stays on your device. Always.</p>
        </div>
      </div>
    );
  }

  // Step 1: Name
  if (step === 1) {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <h1 style={{ ...headlineStyle, fontSize: 28 }}>What should we call you?</h1>
          <input
            style={inputStyle}
            placeholder="Your name"
            value={name}
            autoFocus
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) setStep(2); }}
          />
          <button
            className="btn solid"
            style={{ minWidth: 180, justifyContent: "center" }}
            disabled={!name.trim()}
            onClick={() => setStep(2)}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Collections
  if (step === 2) {
    const gridStyle = {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 12,
      width: "100%",
    };

    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <h1 style={{ ...headlineStyle, fontSize: 28 }}>What do you collect?</h1>
          <div style={gridStyle}>
            {COLLECTION_TYPES.map(({ type, label }) => {
              const isOn = selected.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "18px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: isOn ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                    background: isOn ? "var(--accent-wash)" : "var(--panel)",
                    color: isOn ? "var(--accent)" : "var(--text)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--sans)",
                    transition: "all .15s",
                  }}
                >
                  {typeIcon(type, { size: 22, stroke: 1.8 })}
                  {label}
                </button>
              );
            })}
          </div>
          <button
            className="btn solid"
            style={{ minWidth: 180, justifyContent: "center" }}
            disabled={selected.size === 0}
            onClick={() => setStep(3)}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Accent color
  if (step === 3) {
    const swatchRow = {
      display: "flex",
      gap: 14,
      justifyContent: "center",
    };

    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <h1 style={{ ...headlineStyle, fontSize: 28 }}>Pick an accent colour</h1>
          <div style={swatchRow}>
            {ACCENT_OPTIONS.map(color => (
              <button
                key={color}
                onClick={() => setAccent(color)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: color,
                  border: accent === color ? "3px solid var(--text)" : "3px solid transparent",
                  outline: accent === color ? `2px solid ${color}` : "none",
                  outlineOffset: 2,
                  cursor: "pointer",
                  padding: 0,
                  transition: "border .15s, outline .15s",
                }}
                aria-label={color}
              />
            ))}
          </div>
          <button
            className="btn solid"
            style={{ minWidth: 180, justifyContent: "center" }}
            onClick={finish}
          >
            Let's go
          </button>
        </div>
      </div>
    );
  }

  // Step 4: Finishing
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h1 style={{ ...headlineStyle, fontSize: 28 }}>Setting up your hoard…</h1>
        <span className="ai-spinner" style={{ width: 28, height: 28 }} />
      </div>
    </div>
  );
}
