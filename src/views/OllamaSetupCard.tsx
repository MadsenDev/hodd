// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { I } from '../icons';
import { getSettings, saveSetting, OllamaClient } from '../api';

type OllaStep =
  | 'checking'
  | 'not-installed'
  | 'confirm-install'
  | 'installing'
  | 'not-running'
  | 'starting'
  | 'no-models'
  | 'pulling'
  | 'ready'
  | 'error';

const MODELS = [
  { id: 'llama3.2',  label: 'Llama 3.2',  desc: 'Balanced. Fast on most machines. Good default.' },
  { id: 'mistral',   label: 'Mistral 7B', desc: 'Strong reasoning. Slightly larger.' },
  { id: 'phi3',      label: 'Phi-3 Mini', desc: 'Lightweight. Best for low-RAM machines.' },
];

export function OllamaSetupCard() {
  const [step, setStep] = useState<OllaStep>('checking');
  const [error, setError] = useState('');
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [pullStatus, setPullStatus] = useState('');
  const [pullPct, setPullPct] = useState<number | null>(null);
  const [activeModel, setActiveModel] = useState('');
  const [installPassword, setInstallPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  function getOllama() {
    return (window as any).hoddDesktop?.ollama;
  }

  async function checkState() {
    const ollama = getOllama();
    if (!ollama) { setStep('not-installed'); return; }
    try {
      const { installed } = await ollama.checkInstalled();
      if (!installed) { setStep('not-installed'); return; }
      const { running, models } = await ollama.status();
      if (!running) { setStep('not-running'); return; }
      if (!models || models.length === 0) { setStep('no-models'); return; }
      const s = await getSettings();
      setActiveModel(s['ollama.model'] || models[0] || '');
      setStep('ready');
    } catch (e: any) {
      setError(e?.message || 'Unknown error');
      setStep('error');
    }
  }

  // Register stream listeners once on mount; clean up on unmount
  useEffect(() => {
    const ollama = getOllama();
    if (ollama) {
      ollama.onStream((event: { type: string; data: string }) => {
        if (event.type === 'stdout' || event.type === 'stderr') {
          setInstallLog(prev => [...prev, event.data]);
        } else if (event.type === 'done') {
          setInstallPassword('');
          setStep('not-running');
        } else if (event.type === 'auth-error') {
          setAuthError(event.data || 'Incorrect password.');
          setStep('confirm-install');
        } else if (event.type === 'error') {
          setError(event.data || 'Install failed');
          setStep('error');
        }
      });

      ollama.onPullProgress((event: { status: string; pct: number | null }) => {
        setPullStatus(event.status || '');
        setPullPct(event.pct ?? null);
      });
    }

    checkState();

    return () => {
      if (ollama) {
        ollama.offStream?.();
        ollama.offPullProgress?.();
      }
    };
  }, []);

  // Auto-scroll install log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [installLog]);

  async function handlePullComplete() {
    try {
      const s = await getSettings();
      if (!s['ollama.model']) {
        await saveSetting('ollama.model', selectedModel);
        setActiveModel(selectedModel);
      }
      OllamaClient.invalidateStatus();
    } catch (_) {}
    setStep('ready');
  }

  async function startInstall() {
    const ollama = getOllama();
    if (!ollama) return;
    setInstallLog([]);
    setAuthError('');
    setStep('installing');
    try {
      await ollama.install(installPassword || undefined);
    } catch (e: any) {
      setError(e?.message || 'Install failed');
      setStep('error');
    }
  }

  async function startOllama() {
    const ollama = getOllama();
    if (!ollama) return;
    setStep('starting');
    try {
      const result = await ollama.start();
      if (result?.ok) {
        const { models } = await ollama.status();
        if (!models || models.length === 0) {
          setStep('no-models');
        } else {
          const s = await getSettings();
          setActiveModel(s['ollama.model'] || models[0] || '');
          setStep('ready');
        }
      } else {
        setError(result?.error || 'Could not start Ollama');
        setStep('error');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not start Ollama');
      setStep('error');
    }
  }

  async function pullModel() {
    const ollama = getOllama();
    if (!ollama) return;
    setPullStatus('Starting…');
    setPullPct(null);
    setStep('pulling');
    try {
      const result = await ollama.pullModel(selectedModel);
      if (result?.ok) {
        await handlePullComplete();
      } else {
        setError(result?.error || 'Pull failed');
        setStep('no-models');
      }
    } catch (e: any) {
      setError(e?.message || 'Pull failed');
      setStep('no-models');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderBody() {
    switch (step) {
      case 'checking':
        return (
          <p className="settings-hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.refresh size={14} className="spin" />
            Checking for Ollama…
          </p>
        );

      case 'not-installed':
        return (
          <>
            <p className="settings-hint">
              Install <b>Ollama</b> to enable AI-powered item enrichment, story generation,
              and natural-language search. Models run entirely on your machine — nothing is
              sent to the cloud.
            </p>
            <div style={{ marginTop: 16 }}>
              <button className="btn solid" onClick={() => setStep('confirm-install')}>
                <I.download size={15} /> Install Ollama
              </button>
            </div>
          </>
        );

      case 'confirm-install':
        return (
          <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px 18px' }}>
            <p className="settings-hint" style={{ marginBottom: 14 }}>
              This will run the official Ollama install script on your machine.
              Installing system-wide requires your sudo password.
            </p>
            {authError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 'var(--radius-sm)', background: 'rgba(207,107,90,0.10)', border: '1px solid rgba(207,107,90,0.25)', marginBottom: 12 }}>
                <I.alert size={13} style={{ color: '#cf6b5a', flexShrink: 0 }} />
                <span className="settings-hint" style={{ color: '#cf6b5a', margin: 0 }}>{authError}</span>
              </div>
            )}
            <label className="ef-field ef-wide" style={{ marginBottom: 14 }}>
              <span className="ef-k">Sudo password</span>
              <input
                className="ef-control"
                type="password"
                autoComplete="current-password"
                placeholder="Required to install system-wide"
                value={installPassword}
                onChange={e => setInstallPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && installPassword) startInstall(); }}
              />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost" onClick={() => { setStep('not-installed'); setAuthError(''); setInstallPassword(''); }}>Cancel</button>
              <button className="btn solid" disabled={!installPassword} onClick={startInstall}>
                <I.check size={15} /> Confirm &amp; Install
              </button>
            </div>
          </div>
        );

      case 'installing': {
        const MILESTONES = [
          { match: 'Installing ollama to',              pct: 10, label: 'Downloading binary' },
          { match: 'Creating ollama user',              pct: 35, label: 'Creating system user' },
          { match: 'Adding ollama user to video group', pct: 50, label: 'Configuring permissions' },
          { match: 'Adding current user to ollama',     pct: 60, label: 'Configuring permissions' },
          { match: 'Creating ollama systemd service',   pct: 75, label: 'Installing service' },
          { match: 'Enabling and starting ollama',      pct: 88, label: 'Starting service' },
          { match: 'Install complete',                  pct: 100, label: 'Complete' },
        ];
        const fullLog = installLog.join('\n');
        let installPct = 5;
        let installLabel = 'Preparing…';
        for (const m of MILESTONES) {
          if (fullLog.includes(m.match)) { installPct = m.pct; installLabel = m.label; }
        }
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                <span className="settings-hint" style={{ display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
                  {installPct < 100 && <I.refresh size={13} className="spin" />}
                  {installPct === 100 ? <I.check size={13} stroke={2.5} style={{ color: 'var(--success, #5ba47a)' }} /> : null}
                  {installLabel}
                </span>
                <span style={{ fontSize: 12, color: 'var(--mute)', fontVariantNumeric: 'tabular-nums' }}>{installPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'var(--panel-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 6, background: 'var(--accent)', width: `${installPct}%`, transition: 'width 0.6s var(--ease)' }} />
              </div>
            </div>
            <div
              ref={logRef}
              style={{
                fontFamily: '"SF Mono", ui-monospace, monospace',
                fontSize: 11.5,
                lineHeight: 1.55,
                background: 'var(--panel-2)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                maxHeight: 160,
                overflowY: 'auto',
                border: '1px solid var(--border-soft)',
                color: 'var(--text-2)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {installLog.length === 0
                ? <span style={{ color: 'var(--mute)' }}>Waiting for output…</span>
                : installLog.map((line, i) => <div key={i}>{line}</div>)
              }
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => getOllama()?.cancelInstall?.()}>
                Cancel
              </button>
            </div>
          </>
        );
      }

      case 'not-running':
        return (
          <>
            <p className="settings-hint">
              Ollama is installed but not running. Start it to enable AI features.
            </p>
            <div style={{ marginTop: 16 }}>
              <button className="btn solid" onClick={startOllama}>
                <I.arrowRight size={15} /> Start Ollama
              </button>
            </div>
          </>
        );

      case 'starting':
        return (
          <p className="settings-hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.refresh size={14} className="spin" />
            Starting Ollama…
          </p>
        );

      case 'no-models':
        return (
          <>
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(207,107,90,0.10)', border: '1px solid rgba(207,107,90,0.25)', marginBottom: 14 }}>
                <I.alert size={14} style={{ color: '#cf6b5a', flexShrink: 0 }} />
                <span className="settings-hint" style={{ color: '#cf6b5a', margin: 0 }}>{error}</span>
              </div>
            )}
            <p className="settings-hint" style={{ marginBottom: 14 }}>
              Ollama is running but has no models yet. Pick one to pull:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MODELS.map(m => (
                <label
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${selectedModel === m.id ? 'var(--accent)' : 'var(--border-soft)'}`,
                    background: selectedModel === m.id ? 'var(--accent-wash)' : 'var(--panel-2)',
                    cursor: 'pointer',
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  <input
                    type="radio"
                    name="ollama-model"
                    value={m.id}
                    checked={selectedModel === m.id}
                    onChange={() => setSelectedModel(m.id)}
                    style={{ marginTop: 3, accentColor: 'var(--accent)', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'block' }}>{m.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2, display: 'block' }}>{m.desc}</span>
                    <span className="model-tag" style={{ marginTop: 6, display: 'inline-block' }}>{m.id}</span>
                  </span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn solid" onClick={pullModel}>
                <I.download size={15} /> Pull {MODELS.find(m => m.id === selectedModel)?.label}
              </button>
            </div>
          </>
        );

      case 'pulling':
        return (
          <>
            <p className="settings-hint" style={{ marginBottom: 12 }}>
              Pulling <span className="model-tag">{selectedModel}</span>…
            </p>
            {pullPct !== null ? (
              <>
                <div style={{ height: 8, borderRadius: 6, background: 'var(--panel-3)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 6, background: 'var(--accent)', width: `${pullPct}%`, transition: 'width .4s var(--ease)' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6 }}>{Math.round(pullPct)}%</div>
              </>
            ) : (
              <p className="settings-hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <I.refresh size={14} className="spin" />
                {pullStatus || 'Connecting…'}
              </p>
            )}
          </>
        );

      case 'ready':
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: 'var(--success, #5ba47a)',
                background: 'rgba(91,164,122,0.13)', border: '1px solid rgba(91,164,122,0.25)',
                borderRadius: 20, padding: '4px 12px',
              }}>
                <I.check size={13} stroke={2.5} /> Connected
              </span>
              {activeModel && (
                <span className="model-tag">{activeModel}</span>
              )}
            </div>
            <div style={{ marginTop: 14 }}>
              <button
                className="link"
                onClick={() => setStep('no-models')}
                style={{ fontSize: 13 }}
              >
                Pull another model <I.arrowRight size={13} />
              </button>
            </div>
          </>
        );

      case 'error':
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(207,107,90,0.10)', border: '1px solid rgba(207,107,90,0.25)' }}>
              <I.alert size={16} style={{ color: '#cf6b5a', flexShrink: 0, marginTop: 1 }} />
              <p className="settings-hint" style={{ color: '#cf6b5a', margin: 0 }}>
                {error || 'Something went wrong.'}
              </p>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => { setError(''); checkState(); }}>
                <I.refresh size={15} /> Try again
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  }

  return (
    <div className="panel settings-panel">
      <div className="section-head" style={{ margin: '0 0 16px' }}>
        <div className="eyebrow">Local AI — Ollama</div>
      </div>
      {renderBody()}
    </div>
  );
}
