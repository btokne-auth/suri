// app/start/client.js
// Step 6: process picker + Start (anonymous session). Plain, phone-first.
'use client';
import { useState } from 'react';
const BTN = { padding: '14px 20px', minHeight: 48, fontSize: 17, width: '100%' };
export default function StartClient() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    setMsg('Starting...');
    try {
      const s = await fetch('/api/session', { method: 'POST' }).then((r) => r.json());
      if (!s.user_id) { setMsg('Could not start a session. Please try again.'); setBusy(false); return; }
      const r = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ process_id: 'linawan_scholarship_intake' }) });
      const j = await r.json();
      if (!r.ok || !j.submission_id) { setMsg('Could not start. Please try again.'); setBusy(false); return; }
      window.location.href = '/profile?submission=' + encodeURIComponent(j.submission_id);
    } catch { setMsg('Could not start. Please try again.'); setBusy(false); }
  }
  return (
    <main style={{ padding: 16, maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Suri</h1>
      <p>Check your papers before the office does.</p>
      <h2>Choose a process</h2>
      <label style={{ display: 'block', border: '1px solid #888', borderRadius: 8, padding: 12 }}>
        <input type="radio" checked readOnly /> Linawan College scholarship document intake (sample)
      </label>
      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={start} disabled={busy} style={BTN}>Start</button>
      </div>
      {msg && <p>{msg}</p>}
      <p><small>Sample documents only. Never upload a real ID.</small></p>
    </main>
  );
}
