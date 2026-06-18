/* HODD Companion — app shell: scanner-as-home, connection chip, capture tray */
const { useState: useS, useEffect: useE } = React;

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast">
      <span className="t-ok">{I.check({ size: 14 })}</span>
      {toast}
    </div>
  );
}

// connection chip (top-left of the scanner)
function ScanChip({ linked, desktop, onClick }) {
  return (
    <button className="scan-chip" onClick={onClick}>
      <span className={"sc-dot " + (linked ? "live" : "off")} />
      <span className="sc-txt">
        <span className="sc-name">{linked ? desktop.name : "Offline"}</span>
        <span className="sc-sub">{linked ? "Linked" : "Tap to reconnect"}</span>
      </span>
      <span className="sc-chev">{I.chevRight({ size: 15 })}</span>
    </button>
  );
}

// pull-up tray = the lightweight queue
function CaptureTray({ open, setOpen, captures, linked, todayCount, onAdd, onRetry }) {
  const queued = captures.filter((c) => c.state !== "synced").length;
  const syncing = captures.filter((c) => c.state === "syncing").length;
  let line, cls;
  if (!linked && queued > 0) { line = `${queued} waiting offline`; cls = "queued"; }
  else if (syncing > 0)      { line = `Syncing ${syncing}…`;       cls = "syncing"; }
  else                       { line = "All synced";                cls = "synced"; }

  return (
    <div className={"tray" + (open ? " open" : "")}>
      <div className="tray-grip" onClick={() => setOpen(!open)} />
      <div className="tray-summary" onClick={() => setOpen(!open)}>
        <span className="ts-n">{todayCount}</span>
        <span className="ts-body">
          <span className="ts-t">{todayCount === 1 ? "item" : "items"} sent today</span>
          <span className="ts-s"><SyncPill state={cls === "synced" ? "synced" : cls} /></span>
        </span>
        <span className="ts-chev">{I.chevDown({ size: 20 })}</span>
      </div>
      {open && (
        <React.Fragment>
          <div className="tray-list" style={{ maxHeight: "46vh" }}>
            {captures.length === 0 ? (
              <div className="mini-empty" style={{ padding: "24px 20px" }}>
                <div className="me-t">Nothing yet</div>
                <div className="me-s">Point the camera at a barcode to send your first item.</div>
              </div>
            ) : captures.map((c) => <CaptureRow key={c.uid} c={c} />)}
          </div>
          <div className="tray-foot">
            {!linked && queued > 0 && (
              <button className="btn" style={{ marginBottom: 9 }} onClick={onRetry}>{I.refresh({ size: 18 })} Retry sync</button>
            )}
            <button className="btn ghost" onClick={onAdd}>{I.pencil({ size: 17 })} Add without a barcode</button>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function App() {
  const D = window.HODD_DATA;
  const [prefs, setPrefs] = useS({ resolveDefault: true, autoAdd: false, beep: true, torch: false });
  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));

  const [paired, setPaired] = useS(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('hodd_token', urlToken);
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
    return !!localStorage.getItem('hodd_token');
  });
  const [linked, setLinked] = useS(false);
  const [pairingOpen, setPairingOpen] = useS(() => !localStorage.getItem('hodd_token'));

  const [torch, setTorch] = useS(false);
  const [scanMode, setScanMode] = useS("resolve");
  const [session, setSession] = useS(0);
  const [result, setResult] = useS(null);

  const [trayOpen, setTrayOpen] = useS(false);
  const [addOpen, setAddOpen] = useS(false);
  const [settingsOpen, setSettingsOpen] = useS(false);

  const [captures, setCaptures] = useS(() => D.SEED_CAPTURES.map((c) => ({ ...c })));
  const [toast, setToast] = useS(null);

  useE(() => { setScanMode(prefs.resolveDefault ? "resolve" : "push"); }, [prefs.resolveDefault]);

  useE(() => {
    const token = localStorage.getItem('hodd_token');
    if (!token) return;
    const ctrl = new AbortController();
    fetch(window.location.origin + '/api/status', { signal: ctrl.signal })
      .then(r => { if (r.ok) setLinked(true); })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const flash = (msg) => { setToast(msg); clearTimeout(flash._t); flash._t = setTimeout(() => setToast(null), 2400); };
  const todayCount = captures.filter((c) => /now|m ago/.test(c.ago || "")).length;

  const addCapture = (item, coll, via) => {
    const uid = D.newUid();
    const collectionId = coll || item.collection || 'games';
    const cap = {
      uid, title: item.title, type: item.type, sub: item.sub, color: item.color,
      collection: collectionId, via: via === "manual" ? "manual" : "scan",
      state: linked ? "syncing" : "queued", ago: "now",
    };
    setCaptures((cs) => [cap, ...cs]);

    const token = localStorage.getItem('hodd_token');
    if (linked && token) {
      fetch(window.location.origin + '/api/items/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ collectionId, draft: { title: item.title, sub: item.sub, year: item.year } }),
      })
        .then(r => setCaptures(cs => cs.map(c => c.uid === uid ? { ...c, state: r.ok ? 'synced' : 'failed' } : c)))
        .catch(() => setCaptures(cs => cs.map(c => c.uid === uid ? { ...c, state: 'queued' } : c)));
    }
  };

  const onResult = (item) => {
    if (scanMode === "resolve" && prefs.autoAdd && item.conf === "high") {
      addCapture(item, item.collection, "scan");
      setSession((n) => n + 1);
      flash(linked ? `${item.title} → ${D.DESKTOP.name}` : `${item.title} queued`);
      if (window.Scanner && window.Scanner._next) window.Scanner._next();
      return;
    }
    setResult({ item, mode: scanMode });
  };

  const confirmAdd = (item, coll, via) => {
    addCapture(item, coll, "scan");
    setSession((n) => n + 1);
    flash(via === "push" ? `Pushed to ${D.DESKTOP.name}` : (linked ? `${item.title} → ${D.DESKTOP.name}` : `${item.title} queued`));
    setResult(null);
    if (window.Scanner && window.Scanner._next) window.Scanner._next();
  };
  const dismissResult = () => { setResult(null); if (window.Scanner && window.Scanner._next) window.Scanner._next(); };

  const onHandAdd = (data) => {
    addCapture(data, data.collection, "manual");
    flash(linked ? `${data.title} → ${D.DESKTOP.name}` : `${data.title} queued`);
    setAddOpen(false);
    setTrayOpen(true);
  };

  const finishPairing = () => { setPaired(true); setLinked(true); setPairingOpen(false); };
  const cancelPairing = () => { if (paired) setPairingOpen(false); };

  const chipClick = () => { if (!linked) setPairingOpen(true); else setSettingsOpen(true); };

  const paused = !!result || addOpen || settingsOpen || pairingOpen || trayOpen;

  return (
    <div className="app-shell">
      {/* the camera is the whole screen — this app IS the scanner */}
      <Scanner torch={torch} paused={paused} onResult={onResult} />

      {/* top chrome */}
      <div className="scan-top2">
        <ScanChip linked={linked} desktop={D.DESKTOP} onClick={chipClick} />
        <div className="scan-rt">
          <button className={"scan-iconbtn" + (torch ? " on" : "")} onClick={() => setTorch((v) => !v)} aria-label="Torch">{I.torch({ size: 20 })}</button>
          <button className="scan-iconbtn" onClick={() => setSettingsOpen(true)} aria-label="Settings">{I.settings({ size: 20 })}</button>
        </div>
      </div>

      {/* bottom chrome: hint + mode switch + tray */}
      <div className="scan-bottom">
        {!trayOpen && (
          <React.Fragment>
            <div className="scan-hint2">{linked ? "Point at a barcode — it lands on your desktop" : "Offline — scans queue until you reconnect"}</div>
            <div className="mode-switch">
              <button className={scanMode === "resolve" ? "on" : ""} onClick={() => setScanMode("resolve")}>{I.bolt({ size: 15 })} Resolve here</button>
              <button className={scanMode === "push" ? "on" : ""} onClick={() => setScanMode("push")}>{I.desktop({ size: 15 })} Push to desktop</button>
            </div>
          </React.Fragment>
        )}
        <CaptureTray
          open={trayOpen} setOpen={setTrayOpen} captures={captures} linked={linked}
          todayCount={todayCount} onAdd={() => { setTrayOpen(false); setAddOpen(true); }}
          onRetry={() => { setLinked(true); flash("Reconnected — syncing"); }}
        />
      </div>

      {/* result sheet */}
      {result && <ResultSheet item={result.item} mode={result.mode} linked={linked} onAdd={confirmAdd} onDismiss={dismissResult} />}

      {/* slide-over pages */}
      {addOpen && (
        <div className="overlay-page">
          <AddScreen linked={linked} onCancel={() => setAddOpen(false)} onAdded={onHandAdd} />
        </div>
      )}
      {settingsOpen && (
        <div className="overlay-page">
          <SettingsScreen linked={linked} desktop={D.DESKTOP} prefs={prefs} setPref={setPref}
            onPairNew={() => { setSettingsOpen(false); setPairingOpen(true); }}
            onDisconnect={() => { setLinked(false); flash("Desktop disconnected"); }}
            onClose={() => setSettingsOpen(false)} />
        </div>
      )}

      {pairingOpen && <Pairing desktop={D.DESKTOP} onDone={finishPairing} onCancel={cancelPairing} />}

      <Toast toast={toast} />
    </div>
  );
}

// ── Responsive frame: bezel + studio on desktop, full-bleed on phone ──
function Root() {
  const [bare, setBare] = useS(() => window.matchMedia("(max-width: 540px)").matches);
  const [scale, setScale] = useS(1);
  useE(() => {
    const mq = window.matchMedia("(max-width: 540px)");
    const fn = (e) => setBare(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    const fit = () => { const avail = window.innerHeight - 96; setScale(Math.min(1, Math.max(0.5, avail / 932))); };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn);
      window.removeEventListener("resize", fit);
    };
  }, []);

  if (bare) return <div className="bare-shell"><App /></div>;
  return (
    <div className="stage">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center top" }}>
        <div className="phone-label">
          <div className="pl-kicker">Companion · Android</div>
          <div className="pl-title"><HoddMark size={22} style={{ color: "var(--accent)" }} /> Hodd on the go</div>
        </div>
        <AndroidDevice bg="#000" statusDark navDark contentStyle={{ overflow: "hidden" }}>
          <App />
        </AndroidDevice>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
