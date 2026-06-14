/* HODD Companion — Home, Queue, Add-by-hand, Settings */

// ── Link / connection card (shared on Home) ────────────────────
function LinkCard({ linked, desktop, todayCount, onReconnect }) {
  if (!linked) {
    return (
      <div className="link-card offline">
        <div className="link-top">
          <div className="link-orb off">{I.cloudOff({ size: 22 })}</div>
          <div className="link-meta">
            <div className="lm-state off"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--bad)" }} /> Disconnected</div>
            <div className="lm-name">No desktop nearby</div>
            <div className="lm-host">Captures will sync once you reconnect</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn solid" onClick={onReconnect}>{I.refresh({ size: 18 })} Reconnect</button>
        </div>
      </div>
    );
  }
  return (
    <div className="link-card">
      <div className="link-top">
        <div className="link-orb">{I.desktop({ size: 22 })}</div>
        <div className="link-meta">
          <div className="lm-state"><span className="pulse-dot" /> Live link</div>
          <div className="lm-name">{desktop.name}</div>
          <div className="lm-host">{I.wifi({ size: 13, style: { verticalAlign: "-2px", marginRight: 4 } })}{desktop.network} · {desktop.host}</div>
        </div>
        <span className="signal"><i /><i /><i /><i /></span>
      </div>
      <div className="link-stats">
        <div className="link-stat"><div className="ls-v">{todayCount}</div><div className="ls-k">Added today</div></div>
        <div className="link-stat"><div className="ls-v">{desktop.latency}<small>ms</small></div><div className="ls-k">Round-trip</div></div>
        <div className="link-stat"><div className="ls-v">{I.check({ size: 16, style: { color: "var(--good)", verticalAlign: "-2px" } })} <span style={{ fontSize: 14 }}>Synced</span></div><div className="ls-k">All captures</div></div>
      </div>
    </div>
  );
}

// ── Home ───────────────────────────────────────────────────────
function HomeScreen({ linked, desktop, captures, todayCount, onScan, onAdd, onReconnect, goQueue }) {
  const recent = captures.slice(0, 4);
  return (
    <div className="screen view-enter">
      <div className="app-head" style={{ paddingTop: 14 }}>
        <div className="greet">
          <div className="hi">Hey, Chris</div>
          <div className="sub">Your pocket shelf for the hoard</div>
        </div>
        <div className="head-mark"><HoddMark size={26} /></div>
      </div>
      <div className="screen-scroll">
        <div className="pad" style={{ paddingTop: 2 }}>
          <LinkCard linked={linked} desktop={desktop} todayCount={todayCount} onReconnect={onReconnect} />

          <div className="action-row">
            <button className="action-tile primary" onClick={onScan}>
              <div className="at-ic">{I.scanLine({ size: 22 })}</div>
              <div>
                <div className="at-lbl">Scan</div>
                <div className="at-sub">Barcode → desktop</div>
              </div>
            </button>
            <button className="action-tile ghost" onClick={onAdd}>
              <div className="at-ic">{I.pencil({ size: 20 })}</div>
              <div>
                <div className="at-lbl">Add by hand</div>
                <div className="at-sub">No barcode? Type it</div>
              </div>
            </button>
          </div>

          <div className="sec-head">
            <span className="sh-t">Recent captures</span>
            <span className="sh-link" onClick={goQueue}>View all</span>
          </div>
          {recent.length === 0 ? (
            <div className="mini-empty">
              <div className="me-ic">{I.layers({ size: 24 })}</div>
              <div className="me-t">Nothing captured yet</div>
              <div className="me-s">Scan a barcode or add an item to get started.</div>
            </div>
          ) : (
            <div className="cap-list">
              {recent.map((c) => <CaptureRow key={c.uid} c={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── A capture row (shared Home + Queue) ────────────────────────
function CaptureRow({ c, fresh }) {
  const tm = TYPE_META[c.type] || TYPE_META.other;
  const cname = (window.HODD_DATA.COLLECTIONS.find((x) => x.id === c.collection) || {}).name || tm.cname;
  return (
    <div className={"cap-row" + (fresh ? " fresh" : "")}>
      <Cover item={c} w={42} h={56} radius={6} />
      <div className="cap-body">
        <div className="cap-title">{c.title}</div>
        <div className="cap-sub">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{tm.icon({ size: 13 })}{cname}</span>
          <span className="dot" />
          <span>{c.via === "scan" ? "Scanned" : "By hand"}</span>
          {c.ago && <React.Fragment><span className="dot" /><span>{c.ago}</span></React.Fragment>}
        </div>
      </div>
      <SyncPill state={c.state} />
    </div>
  );
}

function SyncPill({ state }) {
  if (state === "syncing") return <span className="sync-pill syncing"><span className="spin" /> Syncing</span>;
  if (state === "queued")  return <span className="sync-pill queued">{I.cloud({ size: 13 })} Queued</span>;
  return <span className="sync-pill synced">{I.check({ size: 13 })} Synced</span>;
}

// ── Queue ──────────────────────────────────────────────────────
function QueueScreen({ linked, captures, onScan, onFlush }) {
  const queued = captures.filter((c) => c.state !== "synced").length;
  let banner;
  if (!linked && queued > 0) banner = { cls: "off", ic: I.cloudOff, t: `${queued} waiting offline`, s: "Will sync the moment your desktop is back" };
  else if (queued > 0)       banner = { cls: "busy", ic: I.refresh, t: `Syncing ${queued}…`, s: `Sending to ${window.HODD_DATA.DESKTOP.name}` };
  else                       banner = { cls: "ok", ic: I.check, t: "Everything's synced", s: `In step with ${window.HODD_DATA.DESKTOP.name}` };

  // group by ago bucket simply: Just now vs Earlier
  const fresh = captures.filter((c) => /now|m ago/.test(c.ago || ""));
  const earlier = captures.filter((c) => !/now|m ago/.test(c.ago || ""));

  return (
    <div className="screen view-enter">
      <div className="app-head" style={{ paddingTop: 14 }}>
        <div className="greet">
          <div className="hi" style={{ fontSize: 23 }}>Capture queue</div>
          <div className="sub">{captures.length} item{captures.length === 1 ? "" : "s"} this session</div>
        </div>
        {!linked && queued > 0 && (
          <button className="btn sm" onClick={onFlush}>{I.refresh({ size: 16 })} Retry</button>
        )}
      </div>
      <div className="screen-scroll">
        <div className="pad" style={{ paddingTop: 2 }}>
          <div className={"q-banner " + banner.cls}>
            <div className="qb-ic">{banner.ic({ size: 20 })}</div>
            <div style={{ flex: 1 }}>
              <div className="qb-t">{banner.t}</div>
              <div className="qb-s">{banner.s}</div>
            </div>
          </div>

          {captures.length === 0 ? (
            <div className="mini-empty">
              <div className="me-ic">{I.layers({ size: 24 })}</div>
              <div className="me-t">Queue is empty</div>
              <div className="me-s">Scanned and hand-added items land here, then flow to your desktop.</div>
              <div style={{ marginTop: 16 }}><button className="btn solid" onClick={onScan}>{I.scanLine({ size: 18 })} Start scanning</button></div>
            </div>
          ) : (
            <React.Fragment>
              {fresh.length > 0 && <div className="q-day">Just now</div>}
              <div className="cap-list">{fresh.map((c) => <CaptureRow key={c.uid} c={c} />)}</div>
              {earlier.length > 0 && <div className="q-day">Earlier</div>}
              <div className="cap-list">{earlier.map((c) => <CaptureRow key={c.uid} c={c} />)}</div>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add by hand ────────────────────────────────────────────────
function AddScreen({ linked, onCancel, onAdded }) {
  const { COLLECTIONS } = window.HODD_DATA;
  const [title, setTitle] = useState("");
  const [type, setType] = useState("book");
  const [coll, setColl] = useState("books");
  const [creator, setCreator] = useState("");
  const [year, setYear] = useState("");

  // keep collection in step with type by default
  const pick = (t) => { setType(t); const m = TYPE_META[t]; if (m && m.collection !== "other") setColl(m.collection); };

  const types = [
    { t: "book", l: "Book" }, { t: "movie", l: "Movie" }, { t: "game", l: "Game" },
    { t: "coin", l: "Coin" }, { t: "comic", l: "Comic" }, { t: "vinyl", l: "Vinyl" },
  ];
  const palette = { book: "#5A3E22", movie: "#3A5A66", game: "#3E8E5A", coin: "#A9A8A2", comic: "#CF6B5A", vinyl: "#3A6EA5", other: "#54515a" };

  const submit = () => {
    if (!title.trim()) return;
    onAdded({
      title: title.trim(), type, collection: coll,
      sub: [creator.trim(), year.trim()].filter(Boolean).join(" · "),
      color: palette[type] || palette.other, via: "manual",
    });
  };

  return (
    <div className="screen view-enter">
      <div className="app-head" style={{ paddingTop: 14 }}>
        <div className="greet">
          <div className="hi" style={{ fontSize: 23 }}>Add by hand</div>
          <div className="sub">No barcode? File it yourself</div>
        </div>
        <button className="scan-iconbtn" style={{ background: "var(--panel)", borderColor: "var(--border-soft)", color: "var(--dim)" }} onClick={onCancel} aria-label="Close">{I.close({ size: 20 })}</button>
      </div>
      <div className="screen-scroll">
        <div className="pad" style={{ paddingTop: 6 }}>
          <div className="field">
            <label>Title</label>
            <input className="control" placeholder="e.g. The Two Towers" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div className="field">
            <label>Type</label>
            <div className="type-grid">
              {types.map(({ t, l }) => (
                <button key={t} className={"type-chip" + (type === t ? " on" : "")} onClick={() => pick(t)}>
                  {TYPE_META[t].icon({ size: 22 })}{l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: 12 }}>
            <div className="field">
              <label>Creator</label>
              <input className="control" placeholder="Author / artist" value={creator} onChange={(e) => setCreator(e.target.value)} />
            </div>
            <div className="field">
              <label>Year</label>
              <input className="control" placeholder="1954" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Collection</label>
            <div className="select-wrap">
              <select className="control" value={coll} onChange={(e) => setColl(e.target.value)}>
                {COLLECTIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="chev">{I.chevDown({ size: 18 })}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, color: linked ? "var(--good)" : "var(--warn)", fontSize: 12.5, fontWeight: 600, margin: "4px 2px 18px" }}>
            {linked ? I.desktop({ size: 16 }) : I.cloudOff({ size: 16 })}
            {linked ? `Saves to ${window.HODD_DATA.DESKTOP.name}` : "Will queue until your desktop is back"}
          </div>

          <button className="btn solid" disabled={!title.trim()} onClick={submit}>
            {I.check({ size: 18 })} {linked ? "Add to Hodd" : "Add to queue"}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, QueueScreen, AddScreen, CaptureRow, SyncPill, LinkCard });
