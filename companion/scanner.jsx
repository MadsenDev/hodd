/* HODD Companion — Scanner viewfinder (simulated) + scan-result sheet */
const { useState, useEffect, useRef, useCallback } = React;

// ── faux barcode renderer ──────────────────────────────────────
function Barcode({ seed, count = 38, h, className }) {
  const bars = barcodeBars(seed, count);
  return (
    <div className={"bars " + (className || "")} style={h ? { height: h } : undefined}>
      {bars.map((w, i) => <i key={i} style={{ width: w, opacity: i % 7 === 0 ? 0.35 : 1 }} />)}
    </div>
  );
}

// ── The scanner surface (camera + viewfinder only) ─────────────
// This is the app's home. Chrome (connection chip, tray, mode switch)
// is rendered by App on top, so the camera stays the whole screen.
function Scanner({ torch, paused, onResult }) {
  const { SCAN_POOL } = window.HODD_DATA;
  const [target, setTarget] = useState(() => SCAN_POOL[0]);
  const [phase, setPhase] = useState("searching"); // searching | locked
  const idxRef = useRef(0);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const detect = useCallback(() => {
    if (paused) return;
    setPhase((p) => {
      if (p !== "searching") return p;
      const t = setTimeout(() => onResult(target), 620);
      timers.current.push(t);
      return "locked";
    });
  }, [target, onResult, paused]);

  useEffect(() => {
    clearTimers();
    setPhase("searching");
    if (!paused) {
      const t = setTimeout(detect, 2600);
      timers.current.push(t);
    }
    return clearTimers;
  }, [target, detect, paused]);

  const next = useCallback(() => {
    idxRef.current = (idxRef.current + 1) % SCAN_POOL.length;
    setTarget(SCAN_POOL[idxRef.current]);
  }, [SCAN_POOL]);
  Scanner._next = next;

  return (
    <div className="scan-root">
      <div className="cam-feed" />
      <div className="cam-grain" />
      {torch && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(50% 36% at 50% 44%, rgba(255,255,255,0.16), transparent 70%)" }} />}

      <div className="cam-obj" style={{ background: `linear-gradient(165deg, ${target.color}, ${shade(target.color, -28)})` }}>
        <div className="obj-sheen" />
        <div className="obj-title">{target.title}</div>
        <div className="obj-sub">{target.sub}</div>
        <div className="cam-barcode">
          <Barcode seed={target.barcode} count={32} />
          <div className="num">{target.barcode}</div>
        </div>
      </div>

      <div className="vf-overlay">
        <div className="vf-scrim" />
        <div className={"vf-frame" + (phase === "locked" ? " locked" : "")}>
          <span className="vf-corner tl" /><span className="vf-corner tr" />
          <span className="vf-corner bl" /><span className="vf-corner br" />
          <span className="vf-laser" />
        </div>
        {phase === "locked" && (
          <div className="vf-lock"><span className="lock-tag">{target.barcode}</span></div>
        )}
      </div>

      <div className="scan-tapzone" onClick={detect} />

      <div className="scan-status">
        <span className="pulse-dot" style={{ background: phase === "locked" ? "var(--good)" : "var(--accent-soft)" }} />
        {phase === "locked" ? "Found" : "Scanning"}
      </div>
    </div>
  );
}

// ── Scan result sheet ──────────────────────────────────────────
function ResultSheet({ item, mode, linked, onAdd, onDismiss }) {
  const { COLLECTIONS } = window.HODD_DATA;
  const [coll, setColl] = useState(item.collection);
  const tm = TYPE_META[item.type] || TYPE_META.other;

  if (mode === "push") {
    return (
      <React.Fragment>
        <div className="sheet-scrim" onClick={onDismiss} />
        <div className="sheet">
          <div className="sheet-grip" />
          <div className="sheet-body">
            <div className="push-card">
              <div className="eyebrow" style={{ color: "var(--accent)" }}>Pushed to desktop</div>
              <div className="push-bc">
                <Barcode seed={item.barcode} count={34} h={52} />
                <div className="num">{item.barcode}</div>
              </div>
              <div className="push-line">
                Barcode sent to <b>{window.HODD_DATA.DESKTOP.name}</b>.<br />
                Resolve and file it from the desktop app.
              </div>
            </div>
          </div>
          <div className="sheet-foot">
            <button className="btn ghost" style={{ flex: 1 }} onClick={onDismiss}>Keep scanning</button>
            <button className="btn solid" style={{ flex: 1 }} onClick={() => onAdd(item, coll, "push")}>Done</button>
          </div>
        </div>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <div className="sheet-scrim" onClick={onDismiss} />
      <div className="sheet">
        <div className="sheet-grip" />
        <div className="sheet-body">
          <div className="res-hero">
            <Cover item={item} w={72} h={98} radius={9} />
            <div className="res-info">
              <span className={"res-conf " + (item.conf === "high" ? "high" : "ask")}>
                {item.conf === "high" ? <React.Fragment>{I.check({ size: 13 })} Matched</React.Fragment>
                                      : <React.Fragment>{I.info({ size: 13 })} Confirm</React.Fragment>}
              </span>
              <div className="res-title">{item.title}</div>
              <div className="res-sub">{item.sub}</div>
              <div className="res-meta">
                <span className="res-tag"><span className="t-ic">{tm.icon({ size: 14 })}</span>{tm.label}</span>
                <span className="res-tag">{item.format}</span>
              </div>
            </div>
          </div>

          <div className="res-fields">
            <div className="res-field">
              <span className="rf-k">Barcode</span>
              <span className="rf-v mono">{item.barcode}</span>
            </div>
            <div className="res-field">
              <span className="rf-k">Collection</span>
              <span className="rf-v" style={{ display: "flex", justifyContent: "flex-end" }}>
                <span className="mini-wrap">
                  <select className="mini" value={coll} onChange={(e) => setColl(e.target.value)}>
                    {COLLECTIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <span className="chev">{I.chevDown({ size: 15 })}</span>
                </span>
              </span>
            </div>
            <div className="res-field">
              <span className="rf-k">Destination</span>
              <span className="rf-v" style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end", color: linked ? "var(--good)" : "var(--warn)" }}>
                {linked ? I.desktop({ size: 16 }) : I.cloudOff({ size: 16 })}
                {linked ? window.HODD_DATA.DESKTOP.name : "Queued offline"}
              </span>
            </div>
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn ghost" style={{ flex: "0 0 auto", width: 52, padding: 0 }} onClick={onDismiss} aria-label="Discard">{I.close({ size: 20 })}</button>
          <button className="btn solid" style={{ flex: 1 }} onClick={() => onAdd(item, coll, "scan")}>
            {linked ? "Add to Hodd" : "Add to queue"}
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { Scanner, ResultSheet, Barcode });
