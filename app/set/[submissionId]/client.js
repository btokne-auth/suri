// app/set/[submissionId]/client.js
// Step 6: readiness checklist + work log. Plain, phone-first.
// No single-document page, no free-text description.
'use client';
import { useEffect, useRef, useState } from 'react';
const BTN = { padding: '12px 16px', minHeight: 48, fontSize: 16, width: '100%' };
async function shrinkForUpload(f) {
  if (!f || f.type === 'application/pdf' || !f.type.startsWith('image/')) return f;
  try {
    const bmp = await createImageBitmap(f);
    const longest = Math.max(bmp.width, bmp.height);
    const scale = Math.min(1, 2000 / longest);
    if (scale === 1 && f.size <= Math.floor(4.5 * 1024 * 1024) && f.type === 'image/jpeg') { bmp.close(); return f; }
    const nw = Math.max(1, Math.round(bmp.width * scale));
    const nh = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = nw; canvas.height = nh;
    canvas.getContext('2d').drawImage(bmp, 0, 0, nw, nh);
    bmp.close();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) return f;
    return new File([blob], (f.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return f; }
}
export default function SetClient() {
  const [sid, setSid] = useState('');
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('Loading...');
  const [busy, setBusy] = useState(null);
  const files = useRef({});
  async function load(id) {
    try {
      const r = await fetch('/api/submissions/' + encodeURIComponent(id));
      const j = await r.json();
      if (r.ok) { setData(j); setMsg(''); }
      else setMsg(j.error || 'Could not load.');
    } catch { setMsg('Could not load. Check internet.'); }
  }
  useEffect(() => {
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1] || '';
      setSid(id);
      load(id);
      const t = setInterval(() => load(id), 3000);
      return () => clearInterval(t);
    } catch { setMsg('Could not load.'); }
  }, []);
  async function upload(t) {
    const picked = files.current[t]?.files?.[0];
    if (!picked) { setMsg('Choose a file for ' + t + ' first.'); return; }
    setBusy(t); setMsg('Uploading ' + t + '...');
    try {
      const f = await shrinkForUpload(picked);
      const fd = new FormData();
      fd.append('submission_id', sid);
      fd.append('doc_type', t);
      fd.append('file', f);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      setMsg(r.ok ? 'Uploaded. Reading takes ~30s.' : 'Upload failed: ' + (j.error || r.status));
      if (r.ok) load(sid);
    } catch { setMsg('Upload failed. Try again.'); }
    setBusy(null);
  }
  if (!data) return (<main style={{ padding: 16, maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui' }}><h1>Your checklist</h1><p>{msg}</p></main>);
  return (
    <main style={{ padding: 16, maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Your checklist</h1>
      <p>{data.process.label}</p>
      {data.submission.status === 'requirement_not_met' && (<p style={{ border: '2px solid #000', padding: 12 }}><b>{data.process.requirement_message}</b> A person still decides.</p>)}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <section style={{ flex: '2 1 320px', minWidth: 0 }}>
          <h2>Documents</h2>
          {(data.rows || []).map((row) => (
            <div key={row.doc_type} style={{ border: '1px solid #888', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <h3>{row.label}</h3>
              <p>Status: <b>{row.status}</b>{row.locked ? ' (locked)' : ''}</p>
              <p>Action: <b>{row.action}</b> — {row.reason}</p>
              {row.locked ? (<p>{row.reason}</p>) : (
                <div>
                  <label style={{ display: 'block', marginTop: 8 }}>Photo or PDF: <input ref={(el) => { files.current[row.doc_type] = el; }} type="file" accept="image/jpeg,image/png,application/pdf" capture="environment" style={{ display: 'block', marginTop: 8, minHeight: 44 }} /></label>
                  <div style={{ marginTop: 8 }}><button type="button" onClick={() => upload(row.doc_type)} disabled={busy === row.doc_type} style={BTN}>{busy === row.doc_type ? 'Uploading...' : 'Upload ' + row.doc_type}</button></div>
                </div>
              )}
            </div>
          ))}
        </section>
        <aside style={{ flex: '1 1 260px', minWidth: 0 }}>
          <h2>Suri's work log</h2>
          {(data.work_log || []).length === 0 && <p>(nothing yet)</p>}
          <ol>
            {(data.work_log || []).map((w, i) => (<li key={i}><small>{w.step_type}</small>: {w.message}</li>))}
          </ol>
        </aside>
      </div>
      {msg && <p>{msg}</p>}
    </main>
  );
}
