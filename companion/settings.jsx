/* HODD Companion — Settings + Pairing flow */

// ── Settings ───────────────────────────────────────────────────
function SettingsScreen({ linked, desktop, prefs, setPref, onPairNew, onDisconnect, onClose }) {
  return (
    <div className="screen view-enter">
      <div className="app-head" style={{ paddingTop: 14 }}>
        <div className="greet">
          <div className="hi" style={{ fontSize: 23 }}>Settings</div>
          <div className="sub">Companion · v1.0</div>
        </div>
        <button className="scan-iconbtn" style={{ background: "var(--panel)", borderColor: "var(--border-soft)", color: "var(--dim)" }} onClick={onClose} aria-label="Close">{I.close({ size: 20 })}</button>
      </div>
      <div className="screen-scroll">
        <div className="pad" style={{ paddingTop: 4 }}>

          <div className="set-label">Connection</div>
          <div className="set-group">
            <div className="set-row">
              <div className="sr-ic" style={linked ? {} : { color: "var(--bad)" }}>{linked ? I.link({ size: 20 }) : I.cloudOff({ size: 20 })}</div>
              <div className="sr-body">
                <div className="sr-t">{linked ? "Linked" : "Disconnected"}</div>
                <div className="sr-s">{linked ? `${desktop.name} · ${desktop.latency}ms` : "No desktop on this network"}</div>
              </div>
              <span className={"sync-pill " + (linked ? "synced" : "queued")}>{linked ? "Live" : "Off"}</span>
            </div>
            <div className="set-row">
              <div className="sr-ic">{I.wifi({ size: 20 })}</div>
              <div className="sr-body">
                <div className="sr-t">Network</div>
                <div className="sr-s">Syncs only on the same Wi-Fi</div>
              </div>
              <span className="sr-val">{desktop.network}</span>
            </div>
          </div>

          <div className="set-label">Paired devices</div>
          <div className="set-group">
            <div className="device-row">
              <div className="dv-ic mac">{I.desktop({ size: 22 })}</div>
              <div style={{ flex: 1 }}>
                <div className="dv-nm">{desktop.name}</div>
                <div className="dv-s">{linked ? <React.Fragment><span className="pulse-dot" /> Connected now</React.Fragment> : "Last seen 2m ago"}</div>
              </div>
            </div>
            <div className="device-row">
              <div className="dv-ic phone">{I.phone({ size: 22 })}</div>
              <div style={{ flex: 1 }}>
                <div className="dv-nm">Pixel 8 <span className="badge-this">This device</span></div>
                <div className="dv-s">Scanner &amp; quick-add</div>
              </div>
            </div>
            <div className="device-row" style={{ cursor: "pointer" }} onClick={onPairNew}>
              <div className="dv-ic phone" style={{ color: "var(--accent)", background: "var(--accent-wash)" }}>{I.plus({ size: 22 })}</div>
              <div style={{ flex: 1 }}>
                <div className="dv-nm" style={{ color: "var(--accent)" }}>Pair a new desktop</div>
                <div className="dv-s">Scan its QR or enter the code</div>
              </div>
              {I.chevRight({ size: 18, style: { color: "var(--mute)" } })}
            </div>
          </div>

          <div className="set-label">Scanner</div>
          <div className="set-group">
            <SetToggle ic={I.bolt} t="Default to resolve here" s="Match items on the phone before sending" on={prefs.resolveDefault} onChange={() => setPref("resolveDefault", !prefs.resolveDefault)} />
            <SetToggle ic={I.check} t="Auto-add confident matches" s="Skip the confirm sheet when sure" on={prefs.autoAdd} onChange={() => setPref("autoAdd", !prefs.autoAdd)} />
            <SetToggle ic={I.bell} t="Beep on scan" s="Audible confirmation for each capture" on={prefs.beep} onChange={() => setPref("beep", !prefs.beep)} />
            <SetToggle ic={I.bolt} t="Keep torch handy" s="Show the torch control by default" on={prefs.torch} onChange={() => setPref("torch", !prefs.torch)} />
          </div>

          <div className="set-label">General</div>
          <div className="set-group">
            <div className="set-row">
              <div className="sr-ic">{I.sun({ size: 20 })}</div>
              <div className="sr-body"><div className="sr-t">Appearance</div><div className="sr-s">Dark, tuned for low light</div></div>
              <span className="sr-val">Dark</span>
            </div>
            <div className="set-row">
              <div className="sr-ic">{I.shield({ size: 20 })}</div>
              <div className="sr-body"><div className="sr-t">Local-only sync</div><div className="sr-s">Nothing leaves your network</div></div>
              <span className="sync-pill synced">{I.check({ size: 13 })} On</span>
            </div>
            <div className="set-row">
              <div className="sr-ic">{I.info({ size: 20 })}</div>
              <div className="sr-body"><div className="sr-t">About Hodd Companion</div><div className="sr-s">Your hoard. Your story.</div></div>
              {I.chevRight({ size: 18, style: { color: "var(--mute)" } })}
            </div>
          </div>

          <button className="btn ghost" style={{ color: "var(--bad)", borderColor: "transparent" }} onClick={onDisconnect}>
            {I.cloudOff({ size: 18 })} Disconnect this desktop
          </button>
        </div>
      </div>
    </div>
  );
}

function SetToggle({ ic, t, s, on, onChange }) {
  return (
    <div className="set-row">
      <div className="sr-ic">{ic({ size: 20 })}</div>
      <div className="sr-body"><div className="sr-t">{t}</div><div className="sr-s">{s}</div></div>
      <div className={"tgl" + (on ? " on" : "")} onClick={onChange} role="switch" aria-checked={on}><i /></div>
    </div>
  );
}

// ── Pairing flow (full-screen takeover) ────────────────────────
function Pairing({ desktop, onDone, onCancel }) {
  // step: search → found → code → success
  const [step, setStep] = useState("search");
  const [code, setCode] = useState("");
  const timers = useRef([]);

  useEffect(() => {
    const t = setTimeout(() => setStep("found"), 2400);
    timers.current.push(t);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const succeed = () => {
    setStep("success");
    const t = setTimeout(onDone, 1500);
    timers.current.push(t);
  };

  // simulate typing the 6-digit code
  const tapCode = () => {
    setCode((c) => {
      const next = (c + Math.floor(Math.random() * 10)).slice(0, 6);
      if (next.length === 6) { const t = setTimeout(succeed, 450); timers.current.push(t); }
      return next;
    });
  };

  return (
    <div className="pair-root">
      <div className="scan-top" style={{ position: "static" }}>
        <button className="scan-iconbtn" style={{ background: "var(--panel)", borderColor: "var(--border-soft)" }} onClick={onCancel} aria-label="Cancel">{I.close({ size: 20 })}</button>
        <div style={{ flex: 1 }} />
      </div>

      {step === "search" && (
        <div className="pair-body">
          <div className="radar">
            <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
            <div className="core"><HoddMark size={40} /></div>
            <div className="blip" style={{ top: 14, right: 22 }}><div className="b-ic">{I.desktop({ size: 22 })}</div></div>
          </div>
          <div className="pair-h">Looking for Hodd<br />on this network</div>
          <div className="pair-p">Open Hodd on your desktop and make sure both are on <b style={{ color: "var(--text-2)" }}>{desktop.network}</b>.</div>
        </div>
      )}

      {step === "found" && (
        <div className="pair-body">
          <div style={{ width: "100%" }}>
            <div className="pair-mark" style={{ marginBottom: 14 }}>{I.link({ size: 34 })}</div>
            <div className="pair-h" style={{ marginBottom: 6 }}>Found your desktop</div>
            <div className="pair-p" style={{ margin: "0 auto 22px" }}>Confirm it's you to link the two.</div>

            <div className="found-card" style={{ marginBottom: 18 }}>
              <div className="fc-ic">{I.desktop({ size: 24 })}</div>
              <div style={{ flex: 1 }}>
                <div className="fc-nm">{desktop.name}</div>
                <div className="fc-host">{desktop.network} · {desktop.host}</div>
              </div>
              <span className="signal"><i /><i /><i /><i /></span>
            </div>

            <div className="pair-methods">
              <button className="btn solid" onClick={() => setStep("found-qr")}>{I.qr({ size: 20 })} Scan the QR on your desktop</button>
              <div className="or-div">or</div>
              <button className="btn" onClick={() => setStep("code")}>{I.barcode({ size: 20 })} Enter the 6-digit code</button>
            </div>
          </div>
        </div>
      )}

      {step === "found-qr" && (
        <div className="pair-body">
          <div style={{ width: "100%" }}>
            <div className="pair-h" style={{ marginBottom: 6 }}>Point at the QR</div>
            <div className="pair-p" style={{ margin: "0 auto 22px" }}>It's shown in the desktop app under <b style={{ color: "var(--text-2)" }}>Settings → Pair phone</b>.</div>
            <div style={{ position: "relative", width: 230, height: 230, margin: "0 auto 18px", borderRadius: 20, overflow: "hidden", background: "#0a0a0c", border: "1px solid var(--border)" }}>
              <FauxQR />
              <div className="vf-frame" style={{ width: 180, height: 180 }}>
                <span className="vf-corner tl" /><span className="vf-corner tr" />
                <span className="vf-corner bl" /><span className="vf-corner br" />
                <span className="vf-laser" />
              </div>
            </div>
            <button className="btn solid" onClick={succeed}>{I.check({ size: 18 })} Simulate scan</button>
          </div>
        </div>
      )}

      {step === "code" && (
        <div className="pair-body">
          <div style={{ width: "100%" }}>
            <div className="pair-h" style={{ marginBottom: 6 }}>Enter the code</div>
            <div className="pair-p" style={{ margin: "0 auto 24px" }}>Type the 6 digits shown on your desktop.</div>
            <div className="code-row">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={"code-cell" + (code[i] ? " filled" : "") + (code.length === i ? " active" : "")}>{code[i] || ""}</div>
              ))}
            </div>
            <div style={{ marginTop: 22 }}>
              <button className="btn solid" onClick={tapCode}>{code.length < 6 ? "Tap to type a digit" : "Linking…"}</button>
            </div>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="pair-body">
          <div className="pair-done">
            <div className="done-check">{I.check({ size: 44 })}</div>
            <div className="pair-h">You're linked</div>
            <div className="pair-p">{desktop.name} and this phone now share the same hoard.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function FauxQR() {
  // deterministic block grid
  const n = 13;
  const cells = [];
  let s = 7;
  for (let i = 0; i < n * n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; cells.push(s % 100 < 48); }
  const finder = (r, c) => (r < 3 && c < 3) || (r < 3 && c >= n - 3) || (r >= n - 3 && c < 3);
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${n},1fr)`, padding: 26, opacity: 0.5 }}>
      {cells.map((on, i) => {
        const r = Math.floor(i / n), c = i % n;
        const f = finder(r, c);
        return <div key={i} style={{ background: (on || f) ? "#cfcfe0" : "transparent", borderRadius: 1 }} />;
      })}
    </div>
  );
}

Object.assign(window, { SettingsScreen, Pairing });
