// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { typeIcon, HoddMark, I } from '../icons';
import { saveSetting, invalidateCache } from '../api';

// Mirrors the accent palette in App.tsx: [light a, soft, deep] / [dark a, soft, deep]
const ACCENTS = {
  "#4f46e5": { name: "Indigo", light: ["#4f46e5", "#6366f1", "#4338ca"], dark: ["#7c7bff", "#9a99ff", "#6361f0"] },
  "#0d9488": { name: "Teal",   light: ["#0d9488", "#14b8a6", "#0f766e"], dark: ["#2dd4bf", "#5eead4", "#0f766e"] },
  "#e2503b": { name: "Coral",  light: ["#e2503b", "#f06a57", "#c43f2c"], dark: ["#f87171", "#fca5a5", "#e2503b"] },
  "#2563eb": { name: "Azure",  light: ["#2563eb", "#3b82f6", "#1d4ed8"], dark: ["#60a5fa", "#93c5fd", "#3b82f6"] },
  "#7c3aed": { name: "Violet", light: ["#7c3aed", "#8b5cf6", "#6d28d9"], dark: ["#a78bfa", "#c4b5fd", "#8b5cf6"] },
  "#d97706": { name: "Amber",  light: ["#d97706", "#f59e0b", "#b45309"], dark: ["#fbbf24", "#fde68a", "#f59e0b"] },
};
const ACCENT_KEYS = Object.keys(ACCENTS);

function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Paint the chosen theme + accent onto the whole document so the onboarding —
// and the live preview — recolour exactly like the real app will.
function applyAppearance(theme, accent) {
  const root = document.documentElement;
  const isDark = theme === "dark";
  root.setAttribute("data-theme", isDark ? "dark" : "light");
  const def = ACCENTS[accent] || ACCENTS["#4f46e5"];
  const [a, soft, deep] = isDark ? def.dark : def.light;
  root.style.setProperty("--accent", a);
  root.style.setProperty("--accent-soft", soft);
  root.style.setProperty("--accent-deep", deep);
  root.style.setProperty("--accent-wash", hexA(a, isDark ? 0.20 : 0.10));
  root.style.setProperty("--gold-soft", soft);
  root.style.setProperty("--gold-deep", deep);
}

// ── Full-screen loading splash ───────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div className="hodd-splash">
      <HoddMark size={68} className="splash-mark" />
      <div className="splash-word">HODD</div>
      <div className="splash-tag">Your hoard. Your story.</div>
      <div className="splash-bar"><i /></div>
    </div>
  );
}

const STEPS = ["Welcome", "Your name", "Appearance", "Review"];

export function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState(ACCENT_KEYS[0]);
  const [creating, setCreating] = useState(false);

  // Live-apply appearance whenever the choice changes.
  useEffect(() => { applyAppearance(theme, accent); }, [theme, accent]);

  const go = (n) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  async function finish() {
    setCreating(true);
    if (name.trim()) saveSetting("user.name", name.trim());
    saveSetting("theme", theme);
    saveSetting("accent", accent);
    saveSetting("onboarded", "1");
    invalidateCache();
    onDone({ theme, accent });
  }

  if (creating) {
    return (
      <div className="ob-finish">
        <HoddMark size={56} className="fm" />
        <div className="ft">Setting up your hoard…</div>
        <div className="fs">{name.trim() ? `Almost there, ${name.trim()}.` : "Just a moment."}</div>
      </div>
    );
  }

  return (
    <div className="ob-root">
      <aside className="ob-rail">
        <div className="ob-rail-brand">
          <HoddMark size={26} color="#fff" />
          <span className="wm">HODD</span>
        </div>

        <div className="ob-rail-mid">
          <div className="ob-rail-tagline">A beautiful home for everything you collect.</div>
          <nav className="ob-steps">
            {STEPS.map((label, i) => (
              <div key={label} className={`ob-step${i === step ? " active" : i < step ? " done" : ""}`}>
                <span className="dot">{i < step ? <I.check size={14} stroke={2.4} /> : i + 1}</span>
                <span>{label}</span>
              </div>
            ))}
          </nav>
        </div>

        <div className="ob-rail-foot">
          <I.lock size={15} />
          <span>Everything stays on your device. Always.</span>
        </div>
      </aside>

      <main className="ob-stage">
        <div className="ob-stage-inner">
          {step === 0 && (
            <div className="ob-panel" key="s0">
              <div className="ob-eyebrow">Welcome</div>
              <h1 className="ob-title">Welcome to Hodd.</h1>
              <p className="ob-sub">
                Your collections deserve more than a spreadsheet. Let's set up a
                space that's as considered as the things you keep — it only takes a minute.
              </p>
              <div className="ob-features">
                <div className="ob-feature">
                  <span className="ic"><I.grid size={20} /></span>
                  <div><h4>Organise anything</h4><p>Games, books, coins, vinyl — keep every collection in one calm place.</p></div>
                </div>
                <div className="ob-feature">
                  <span className="ic"><I.search size={20} /></span>
                  <div><h4>Find it instantly</h4><p>Search your whole hoard in plain language and surface what's missing.</p></div>
                </div>
                <div className="ob-feature">
                  <span className="ic"><I.lock size={20} /></span>
                  <div><h4>Private by design</h4><p>Local-first. Your data never leaves your device unless you export it.</p></div>
                </div>
              </div>
              <Footer step={step} onNext={() => go(1)} nextLabel="Get started" nextIcon />
            </div>
          )}

          {step === 1 && (
            <div className="ob-panel" key="s1">
              <div className="ob-eyebrow">Step 1 of 3</div>
              <h1 className="ob-title">What should we call you?</h1>
              <p className="ob-sub">Hodd will greet you by name. You can change this anytime in Settings.</p>
              <input
                className="ob-input"
                placeholder="Your name"
                value={name}
                autoFocus
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") go(2); }}
              />
              <Footer step={step} onBack={() => go(0)} onNext={() => go(2)}
                nextLabel={name.trim() ? "Continue" : "Skip"} />
            </div>
          )}

          {step === 2 && (
            <div className="ob-panel" key="s2">
              <div className="ob-eyebrow">Step 2 of 3</div>
              <h1 className="ob-title">Make it yours.</h1>
              <p className="ob-sub">Choose a look. Everything updates live — see for yourself below.</p>

              <div className="ob-themes">
                {[
                  { key: "light", nm: "Light", ds: "Warm & paper-bright" },
                  { key: "dark",  nm: "Dark",  ds: "Cool & focused" },
                ].map(o => (
                  <button key={o.key} className={`ob-theme${theme === o.key ? " on" : ""}`} onClick={() => setTheme(o.key)}>
                    <span className={`chip ${o.key}`} />
                    <span><span className="nm">{o.nm}</span><div className="ds">{o.ds}</div></span>
                  </button>
                ))}
              </div>

              <div className="ob-accents">
                {ACCENT_KEYS.map(key => {
                  const [a] = theme === "dark" ? ACCENTS[key].dark : ACCENTS[key].light;
                  return (
                    <button key={key} className={`ob-swatch${accent === key ? " on" : ""}`}
                      style={{ background: a, color: a }}
                      aria-label={ACCENTS[key].name} title={ACCENTS[key].name}
                      onClick={() => setAccent(key)} />
                  );
                })}
              </div>

              <PreviewMock />

              <Footer step={step} onBack={() => go(1)} onNext={() => go(3)} nextLabel="Continue" />
            </div>
          )}

          {step === 3 && (
            <div className="ob-panel" key="s3">
              <div className="ob-eyebrow">Almost done</div>
              <h1 className="ob-title">Ready when you are.</h1>
              <p className="ob-sub">Here's how Hodd will be set up. You can change any of this later.</p>

              <div className="ob-summary">
                <div className="ob-sum-row">
                  <span className="lbl">Name</span>
                  <span className="val">{name.trim() || <span style={{ color: "var(--mute)", fontWeight: 400 }}>Not set</span>}</span>
                </div>
<div className="ob-sum-row">
                  <span className="lbl">Appearance</span>
                  <span className="val">
                    <span className="ob-dot" style={{ background: (theme === "dark" ? ACCENTS[accent].dark : ACCENTS[accent].light)[0] }} />
                    {ACCENTS[accent].name} · {theme === "dark" ? "Dark" : "Light"}
                  </span>
                </div>
              </div>

              <Footer step={step} onBack={() => go(2)} onNext={finish} nextLabel="Create my hoard" nextIcon />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PreviewMock() {
  return (
    <div className="ob-preview" aria-hidden="true">
      <div className="ob-preview-side">
        <div className="ob-preview-brand"><HoddMark size={15} /><b /></div>
        <div className="ob-pv-nav"><i /><span style={{ width: "60%" }} /></div>
        <div className="ob-pv-nav on"><i /><span style={{ width: "70%" }} /></div>
        <div className="ob-pv-nav"><i /><span style={{ width: "50%" }} /></div>
      </div>
      <div className="ob-preview-main">
        <div className="ob-pv-h" />
        <div className="ob-pv-cards"><div className="ob-pv-card" /><div className="ob-pv-card" /><div className="ob-pv-card" /></div>
        <div className="ob-pv-btn">+ Add</div>
      </div>
    </div>
  );
}

function Footer({ step, onBack, onNext, nextLabel, nextIcon = false }) {
  return (
    <div className="ob-footer">
      <div className="ob-prog">
        {STEPS.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}
      </div>
      <div className="ob-actions">
        {onBack && <button className="ob-skip" onClick={onBack}>Back</button>}
        <button className="ob-next" onClick={onNext}>
          {nextLabel}
          {nextIcon && <I.arrowRight size={18} stroke={2} />}
        </button>
      </div>
    </div>
  );
}
