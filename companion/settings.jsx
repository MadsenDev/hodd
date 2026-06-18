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
  return (
    <div className="pair-root">
      <div className="scan-top" style={{ position: "static" }}>
        <button className="scan-iconbtn" style={{ background: "var(--panel)", borderColor: "var(--border-soft)" }} onClick={onCancel} aria-label="Cancel">{I.close({ size: 20 })}</button>
        <div style={{ flex: 1 }} />
      </div>
      <div className="pair-body">
        <div className="pair-mark" style={{ marginBottom: 20 }}>{I.qr({ size: 44 })}</div>
        <div className="pair-h" style={{ marginBottom: 8 }}>Pair with your desktop</div>
        <div className="pair-p" style={{ maxWidth: 260, margin: "0 auto" }}>
          Open <b style={{ color: "var(--text-2)" }}>HODD</b> on your computer, go to{" "}
          <b style={{ color: "var(--text-2)" }}>Settings → Companion App</b>, and scan
          the QR code with your phone camera.
        </div>
        <div className="pair-p" style={{ marginTop: 14, fontSize: 12, color: "var(--dim)", maxWidth: 240, margin: "14px auto 0" }}>
          Your camera will open the companion automatically when scanned.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsScreen, Pairing });
