import React, { useState, useEffect, useRef, useCallback } from 'react'

const API_BASE_KEY = 'hodd_companion_url'

function getStoredUrl(): string {
  return localStorage.getItem(API_BASE_KEY) || ''
}

async function apiGet(base: string, path: string) {
  const res = await fetch(base.replace(/\/$/, '') + path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiPost(base: string, path: string, data: unknown) {
  const res = await fetch(base.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function App() {
  const [serverUrl, setServerUrl] = useState(getStoredUrl)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'scan' | 'add' | 'browse'>('scan')
  const [urlInput, setUrlInput] = useState(getStoredUrl)

  useEffect(() => {
    if (serverUrl) tryConnect(serverUrl)
  }, [])

  async function tryConnect(url: string) {
    setConnecting(true)
    setError('')
    try {
      await apiGet(url, '/api/status')
      localStorage.setItem(API_BASE_KEY, url)
      setServerUrl(url)
      setConnected(true)
    } catch {
      setError("Could not connect. Make sure Hodd is running and you're on the same network.")
    } finally {
      setConnecting(false)
    }
  }

  if (!connected) {
    return (
      <div className="connect-screen">
        <div className="connect-card">
          <div className="connect-logo">📦</div>
          <h1>Hodd Companion</h1>
          <p>Enter the server URL from Hodd's Settings → Companion App section.</p>
          <input
            className="connect-input"
            type="url"
            placeholder="http://192.168.1.100:7842"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryConnect(urlInput)}
          />
          {error && <div className="connect-error">{error}</div>}
          <button
            className="connect-btn"
            disabled={!urlInput || connecting}
            onClick={() => tryConnect(urlInput)}
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">📦</span>
        <span className="app-title">Hodd</span>
        <button className="disconnect-btn" onClick={() => { setConnected(false); setServerUrl('') }}>
          ✕
        </button>
      </header>
      <nav className="app-tabs">
        {(['scan', 'add', 'browse'] as const).map(t => (
          <button key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
            {t === 'scan' ? '📷 Scan' : t === 'add' ? '+ Add' : '📚 Browse'}
          </button>
        ))}
      </nav>
      <main className="app-main">
        {tab === 'scan' && <ScanTab serverUrl={serverUrl} />}
        {tab === 'add' && <AddTab serverUrl={serverUrl} />}
        {tab === 'browse' && <BrowseTab serverUrl={serverUrl} />}
      </main>
    </div>
  )
}

// ── Scan Tab ─────────────────────────────────────────────────────────────────

function ScanTab({ serverUrl }: { serverUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [lookup, setLookup] = useState<any[] | null>(null)
  const [lookupType, setLookupType] = useState('book')
  const [cameraError, setCameraError] = useState('')
  const detectorRef = useRef<any>(null)
  const animRef = useRef<number>(0)

  const stopCamera = useCallback(() => {
    setScanning(false)
    cancelAnimationFrame(animRef.current)
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  async function startCamera() {
    setCameraError('')
    setResult(null)
    setLookup(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if ('BarcodeDetector' in window) {
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] })
        setScanning(true)
        scan()
      } else {
        setCameraError('Barcode detection not supported in this browser. Try Chrome on Android or Safari on iOS 16.4+.')
        stopCamera()
      }
    } catch (e) {
      setCameraError('Camera access denied. Please allow camera access.')
    }
  }

  async function scan() {
    if (!videoRef.current || !detectorRef.current) return
    try {
      const barcodes = await detectorRef.current.detect(videoRef.current)
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue
        setResult(code)
        stopCamera()
        doLookup(code)
        return
      }
    } catch (_) {}
    animRef.current = requestAnimationFrame(scan)
  }

  async function doLookup(query: string) {
    try {
      const results = await apiPost(serverUrl, '/api/lookup', { type: lookupType, query })
      setLookup(results || [])
    } catch {
      setLookup([])
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera])

  return (
    <div className="scan-tab">
      <div className="scan-type">
        {['book', 'vinyl', 'game', 'movie'].map(t => (
          <button key={t} className={'type-btn' + (lookupType === t ? ' active' : '')} onClick={() => setLookupType(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="camera-wrap">
        <video ref={videoRef} className="camera-video" playsInline muted />
        {scanning && <div className="scan-overlay"><div className="scan-reticle" /></div>}
      </div>
      {cameraError && <div className="scan-error">{cameraError}</div>}
      {!scanning && !result && (
        <button className="scan-btn" onClick={startCamera}>📷 Start scanning</button>
      )}
      {scanning && (
        <button className="scan-btn danger" onClick={stopCamera}>Stop</button>
      )}
      {result && (
        <div className="scan-result">
          <div className="scan-result-code">Scanned: <code>{result}</code></div>
          {lookup === null && <div>Looking up…</div>}
          {lookup?.length === 0 && <div className="scan-no-results">No results found for this barcode.</div>}
          {lookup && lookup.map((item, i) => (
            <LookupResult key={i} item={item} serverUrl={serverUrl} type={lookupType} />
          ))}
          <button className="scan-again" onClick={() => { setResult(null); setLookup(null); startCamera(); }}>
            Scan again
          </button>
        </div>
      )}
    </div>
  )
}

function LookupResult({ item, serverUrl, type }: { item: any; serverUrl: string; type: string }) {
  const [collections, setCollections] = useState<any[]>([])
  const [selectedColl, setSelectedColl] = useState('')
  const [added, setAdded] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    apiGet(serverUrl, '/api/collections').then((colls: any[]) => {
      const filtered = colls.filter(c => !c.type || c.type === type || c.type === 'other')
      setCollections(filtered)
      if (filtered[0]) setSelectedColl(filtered[0].id)
    }).catch(() => {})
  }, [])

  async function addToCollection() {
    if (!selectedColl || adding) return
    setAdding(true)
    try {
      await apiPost(serverUrl, '/api/items/add', {
        collectionId: selectedColl,
        draft: { ...item, type, owned: true },
      })
      setAdded(true)
    } catch {
      setAdding(false)
    }
  }

  return (
    <div className="lookup-result">
      {item.cover_url && <img className="lookup-cover" src={item.cover_url} alt="" />}
      <div className="lookup-info">
        <div className="lookup-title">{item.title}</div>
        {item.sub && <div className="lookup-sub">{item.sub}</div>}
        {item.year && <div className="lookup-year">{item.year}</div>}
      </div>
      {!added ? (
        <div className="lookup-add">
          <select className="lookup-coll-select" value={selectedColl} onChange={e => setSelectedColl(e.target.value)}>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="lookup-add-btn" disabled={!selectedColl || adding} onClick={addToCollection}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </div>
      ) : (
        <div className="lookup-added">✓ Added!</div>
      )}
    </div>
  )
}

// ── Add Tab ───────────────────────────────────────────────────────────────────

function AddTab({ serverUrl }: { serverUrl: string }) {
  const [collections, setCollections] = useState<any[]>([])
  const [collId, setCollId] = useState('')
  const [title, setTitle] = useState('')
  const [sub, setSub] = useState('')
  const [year, setYear] = useState('')
  const [owned, setOwned] = useState(true)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    apiGet(serverUrl, '/api/collections').then((c: any[]) => {
      setCollections(c)
      if (c[0]) setCollId(c[0].id)
    }).catch(() => {})
  }, [])

  const coll = collections.find(c => c.id === collId)
  const type = coll?.type || 'other'
  const subLabel = ({ book: 'Author', game: 'Platform', coin: 'Mint', vinyl: 'Artist', movie: 'Director', comic: 'Publisher', other: 'Detail' } as any)[type] || 'Detail'

  async function add() {
    if (!title.trim() || !collId || adding) return
    setAdding(true)
    try {
      await apiPost(serverUrl, '/api/items/add', {
        collectionId: collId,
        draft: {
          title: title.trim(),
          sub: sub.trim() || null,
          year: year ? parseInt(year) : null,
          type,
          owned,
        },
      })
      setAdded(true)
      setTitle(''); setSub(''); setYear('')
      setTimeout(() => setAdded(false), 2000)
    } catch {
      setAdding(false)
    }
    setAdding(false)
  }

  return (
    <div className="add-tab">
      <div className="add-field">
        <label>Collection</label>
        <select value={collId} onChange={e => setCollId(e.target.value)}>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="add-field">
        <label>Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Item title" />
      </div>
      <div className="add-field">
        <label>{subLabel}</label>
        <input type="text" value={sub} onChange={e => setSub(e.target.value)} placeholder={subLabel} />
      </div>
      <div className="add-field">
        <label>Year</label>
        <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2024" min="1000" max="2099" />
      </div>
      <div className="add-toggle">
        <label>
          <input type="checkbox" checked={owned} onChange={e => setOwned(e.target.checked)} />
          {' '}Owned (uncheck for wishlist)
        </label>
      </div>
      {added && <div className="add-success">✓ Added successfully!</div>}
      <button className="add-submit" disabled={!title.trim() || !collId || adding} onClick={add}>
        {adding ? 'Adding…' : '+ Add Item'}
      </button>
    </div>
  )
}

// ── Browse Tab ────────────────────────────────────────────────────────────────

function BrowseTab({ serverUrl }: { serverUrl: string }) {
  const [collections, setCollections] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiGet(serverUrl, '/api/collections').then(setCollections).catch(() => {})
  }, [])

  async function openColl(id: string) {
    setSelected(id)
    setLoading(true)
    try {
      const result = await apiGet(serverUrl, `/api/collections/${id}/items`)
      setItems(result)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  if (selected) {
    const coll = collections.find(c => c.id === selected)
    return (
      <div className="browse-items">
        <button className="back-btn" onClick={() => { setSelected(null); setItems([]) }}>← {coll?.name || 'Back'}</button>
        {loading && <div className="browse-loading">Loading…</div>}
        {items.map((it, i) => (
          <div key={it.id || i} className="browse-item">
            <div className="browse-item-title">{it.title}</div>
            {it.sub && <div className="browse-item-sub">{it.sub}</div>}
            <div className="browse-item-badges">
              {it.year && <span className="badge">{it.year}</span>}
              <span className="badge">{it.owned !== false ? 'Owned' : 'Wishlist'}</span>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && <div className="browse-empty">No items in this collection.</div>}
      </div>
    )
  }

  return (
    <div className="browse-colls">
      {collections.map(c => (
        <button key={c.id} className="coll-card" onClick={() => openColl(c.id)}
          style={{ borderLeft: `4px solid ${c.accent || '#6366f1'}` }}>
          <span className="coll-name">{c.name}</span>
          <span className="coll-arrow">›</span>
        </button>
      ))}
    </div>
  )
}
