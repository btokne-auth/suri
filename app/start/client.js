// app/start/client.js
// Step 6: process picker + Start (anonymous session). Plain, phone-first.
// Step 7: lists ALL processes from GET /api/processes (registry).
// Step 7c Part 3: samples first, visitor's saved checks under "Your checks",
// plus a "Set up your own check" link to /setup.
'use client';
import { useEffect, useState } from 'react';
import SuriHeader from '../components/SuriHeader.js';
import '../flow-polish.css';
export default function StartClient() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [samples, setSamples] = useState([]);
  const [saved, setSaved] = useState([]);
  const [picked, setPicked] = useState('');
  useEffect(() => {
    (async () => {
      try {
        try { await fetch('/api/session', { method: 'POST' }); } catch { /* listing still works */ }
        const r = await fetch('/api/processes');
        const j = await r.json();
        const list = Array.isArray(j.processes) ? j.processes : [];
        const a = list.filter((p) => p && typeof p.id === 'string' && p.id.indexOf('saved_') !== 0);
        const b = list.filter((p) => p && typeof p.id === 'string' && p.id.indexOf('saved_') === 0);
        setSamples(a);
        setSaved(b);
        const wanted = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('process') : '';
        if (wanted && list.some((p) => p && p.id === wanted)) setPicked(wanted);
        else if (list.length > 0) setPicked(list[0].id);
      } catch { setSamples([]); setSaved([]); }
    })();
  }, []);
  async function start() {
    setBusy(true);
    setMsg('Starting...');
    try {
      if (!picked) { setMsg('Choose a process first.'); setBusy(false); return; }
      const s = await fetch('/api/session', { method: 'POST' }).then((r) => r.json());
      if (!s.user_id) { setMsg('Could not start a session. Please try again.'); setBusy(false); return; }
      const r = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ process_id: picked }) });
      const j = await r.json();
      if (!r.ok || !j.submission_id) { setMsg('Could not start. Please try again.'); setBusy(false); return; }
      const all = samples.concat(saved);
      const chosen = all.find((p) => p.id === picked) || null;
      if (chosen && chosen.needs_profile === false) {
        window.location.href = '/set/' + encodeURIComponent(j.submission_id);
      } else {
        window.location.href = '/profile?submission=' + encodeURIComponent(j.submission_id);
      }
    } catch { setMsg('Could not start. Please try again.'); setBusy(false); }
  }
  function row(p) {
    const selected = picked === p.id;
    return (
      <label key={p.id} className={'start-row' + (selected ? ' start-row--selected' : '')}>
        <input type="radio" name="process" value={p.id} checked={selected} onChange={() => setPicked(p.id)} className="start-radio" />
        <span className="start-radio-mark" aria-hidden="true" />
        <span className="start-row-main">
          <span className="start-row-name">{p.label}</span>
        </span>
      </label>
    );
  }
  return (
    <div className="checklist-page start-page">
      <SuriHeader />
      <div className="start-intro">
        <h1 className="checklist-h1">Start a check</h1>
        <p className="checklist-subtitle">Check your papers before the office does.</p>
      </div>
      <div className="landing-section-head">
        <span className="landing-section-title">01 — choose a process</span>
      </div>
      {samples.length === 0 && saved.length === 0 && <p className="checklist-foot">Loading processes...</p>}
      {samples.map(row)}
      {saved.length > 0 && (
        <div id="your-checks" style={{ marginTop: 16 }}>
          <div className="landing-section-head">
            <span className="landing-section-title">02 — your checks</span>
          </div>
          {saved.map(row)}
        </div>
      )}
      <a href="/setup" className="start-row start-row--setup">
        <span className="start-setup-mark" aria-hidden="true">+</span>
        <span className="start-row-main">
          <span className="start-row-name">Set up your own check</span>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.4 }}>Describe it in plain words. Suri builds the checklist.</span>
        </span>
      </a>
      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={start} disabled={busy || !picked} className="checklist-btn-primary" style={{ width: '100%' }}>
          Start →
        </button>
      </div>
      {msg && <p className="checklist-msg">{msg}</p>}
      <p className="checklist-foot" style={{ marginTop: 16 }}>Sample documents only. Never upload a real ID.</p>
    </div>
  );
}


