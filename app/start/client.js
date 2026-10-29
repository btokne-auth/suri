// app/start/client.js
// Step 6: process picker + Start (anonymous session). Plain, phone-first.
// Step 7: lists ALL processes from GET /api/processes (registry).
// Step 7c Part 3: samples first, visitor's saved checks under "Your checks",
// plus a "Set up your own check" link to /setup.
'use client';
import { useEffect, useState } from 'react';
const BTN = { padding: '14px 20px', minHeight: 48, fontSize: 17, width: '100%' };
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
        if (list.length > 0) setPicked(list[0].id);
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
    return (
      <label key={p.id} style={{ display: 'block', border: '1px solid #888', borderRadius: 8, padding: 12, marginBottom: 8, minHeight: 44 }}>
        <input type="radio" name="process" checked={picked === p.id} onChange={() => setPicked(p.id)} /> {p.label}
      </label>
    );
  }
  return (
    <main className="start-page">
      <h1>Suri</h1>
      <p>Check your papers before the office does.</p>
      <h2>Choose a process</h2>
      {samples.length === 0 && saved.length === 0 && <p>Loading processes...</p>}
      {samples.map(row)}
      {saved.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2>Your checks</h2>
          {saved.map(row)}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={start} disabled={busy || !picked} style={BTN}>Start</button>
      </div>
      {msg && <p>{msg}</p>}
      <p><a href="/setup">Set up your own check</a></p>
      <p><small>Sample documents only. Never upload a real ID.</small></p>
    </main>
  );
}


