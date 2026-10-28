// app/set/[submissionId]/client.js
// Step 6: readiness checklist + work log. Plain, phone-first.
// Step 7: Applicant / Reviewer switch (demo mode, same visitor only).
// No single-document page, no free-text description.
'use client';
import { useEffect, useRef, useState } from 'react';
const BTN = { padding: '12px 16px', minHeight: 48, fontSize: 16, width: '100%' };
const SMALLBTN = { padding: '10px 12px', minHeight: 44, fontSize: 15, marginRight: 8, marginTop: 8 };
const RESCOLOR = { match: '#0a0', check: '#a60', mismatch: '#a00', invalid: '#a00' };
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
  const [sid] = useState(() => {
    try {
      if (typeof window === 'undefined') return '';
      const parts = window.location.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    } catch { return ''; }
  });
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(sid ? 'Loading...' : 'Could not load.');
  const [busy, setBusy] = useState(null);
  const [view, setView] = useState('applicant');
  const [imgUrls, setImgUrls] = useState({});
  const [correcting, setCorrecting] = useState({});
  const [newValues, setNewValues] = useState({});
  const [overrideNote, setOverrideNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(null);
  const files = useRef({});
  async function load(id) {
    try {
      const r = await fetch('/api/submissions/' + encodeURIComponent(id));
      const j = await r.json();
      // Do not wipe reviewer messages: the 3s poll runs constantly.
      if (r.ok) { setData(j); setMsg((prev) => (prev === 'Loading...' ? '' : prev)); }
      else setMsg(j.error || 'Could not load.');
    } catch { setMsg('Could not load. Check internet.'); }
  }
  useEffect(() => {
    if (!sid) return;
    // Initial server sync + 3s polling (external system), not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(sid);
    const t = setInterval(() => load(sid), 3000);
    return () => clearInterval(t);
  }, [sid]);
  useEffect(() => {
    if (view !== 'reviewer' || !data) return;
    for (const r of (data.rows || [])) {
      const docId = r.document_id;
      if (!docId || imgUrls[docId]) continue;
      (async () => {
        try {
          const resp = await fetch('/api/documents/' + encodeURIComponent(docId) + '/image');
          const jj = await resp.json();
          if (resp.ok && jj.url) setImgUrls((p) => (p[docId] ? p : { ...p, [docId]: jj.url }));
        } catch { /* reviewer can tap Load image to retry */ }
      })();
    }
    // imgUrls in deps so already-loaded images are skipped.
  }, [view, data, imgUrls]);
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
  async function loadImage(docId) {
    if (!docId || imgUrls[docId]) return;
    try {
      const r = await fetch('/api/documents/' + encodeURIComponent(docId) + '/image');
      const j = await r.json();
      if (r.ok && j.url) setImgUrls((p) => ({ ...p, [docId]: j.url }));
    } catch { /* keep empty, reviewer can retry */ }
  }
  async function reviewAction(docId, action, fieldKey) {
    setReviewBusy(docId + action + (fieldKey || ''));
    setMsg('');
    try {
      const body = { action };
      if (action === 'correct') {
        body.field_key = fieldKey;
        body.new_value = newValues[docId + ':' + fieldKey] || '';
      }
      const r = await fetch('/api/documents/' + encodeURIComponent(docId) + '/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setMsg('Reviewer action failed: ' + (j.error || r.status)); }
      else {
        setMsg(action === 'correct' ? 'Saved. Checks re-ran.' : 'Saved.');
        setCorrecting((p) => ({ ...p, [docId + ':' + fieldKey]: false }));
        load(sid);
      }
    } catch { setMsg('Reviewer action failed. Try again.'); }
    setReviewBusy(null);
  }
  async function sendOverride() {
    if (!overrideNote.trim()) { setMsg('Add a short note for the override.'); return; }
    setReviewBusy('override');
    try {
      const r = await fetch('/api/submissions/' + encodeURIComponent(sid) + '/override', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: overrideNote.trim() }) });
      const j = await r.json();
      if (!r.ok) setMsg('Override failed: ' + (j.error || r.status));
      else { setMsg('Overridden. A person decides.'); setOverrideNote(''); load(sid); }
    } catch { setMsg('Override failed. Try again.'); }
    setReviewBusy(null);
  }
  if (!data) return (<main style={{ padding: 16, maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui' }}><h1>Your checklist</h1><p>{msg}</p></main>);
  const fieldsMap = data.fields || {};
  const checksAll = data.checks || [];
  const reviewsAll = data.review_actions || [];
  return (
    <main style={{ padding: 16, maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Your checklist</h1>
      <p>{data.process.label}</p>
      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => setView('applicant')} disabled={view === 'applicant'} style={SMALLBTN}>Applicant</button>
        <button type="button" onClick={() => setView('reviewer')} disabled={view === 'reviewer'} style={SMALLBTN}>Reviewer</button>
      </div>
      {data.submission.status === 'requirement_not_met' && data.process.requirement_message && (<p style={{ border: '2px solid #000', padding: 12 }}><b>{data.process.requirement_message}</b> A person still decides.</p>)}
      {data.process.override_note && (<p style={{ border: '1px solid #888', padding: 12 }}><b>Overridden by reviewer:</b> {data.process.override_note} A person decides.</p>)}
      {view === 'reviewer' && data.submission.status === 'requirement_not_met' && (
        <div style={{ border: '1px solid #888', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3>Requirement override</h3>
          <p>A flag, a person decides. Add a short note to unlock the other documents.</p>
          <label>Note: <input value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} maxLength={200} style={{ display: 'block', width: '100%', padding: 12, minHeight: 44, fontSize: 16, marginTop: 4 }} /></label>
          <button type="button" onClick={sendOverride} disabled={reviewBusy === 'override'} style={SMALLBTN}>{reviewBusy === 'override' ? 'Saving...' : 'Override requirement'}</button>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {view === 'applicant' && (
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
                  <div style={{ marginTop: 8 }}><button type="button" onClick={() => upload(row.doc_type)} disabled={busy === row.doc_type} style={BTN}>{busy === row.doc_type ? 'Uploading...' : 'Upload ' + row.label}</button></div>
                </div>
              )}
            </div>
          ))}
        </section>
        )}
        {view === 'reviewer' && (
        <section style={{ flex: '2 1 320px', minWidth: 0 }}>
          <h2>Reviewer</h2>
          {(data.rows || []).map((row) => {
            const docFields = row.document_id ? (fieldsMap[row.document_id] || []) : [];
            const docChecks = row.document_id ? checksAll.filter((c) => c.document_id === row.document_id) : [];
            const docReviews = row.document_id ? reviewsAll.filter((r) => r.document_id === row.document_id) : [];
            return (
            <div key={row.doc_type} style={{ border: '1px solid #888', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <h3>{row.label}</h3>
              <p>Status: <b>{row.status}</b> — {row.reason}</p>
              {!row.document_id && <p>(not uploaded yet)</p>}
              {row.document_id && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  {imgUrls[row.document_id] ? (<img src={imgUrls[row.document_id]} alt={row.label} style={{ width: '100%', height: 'auto', border: '1px solid #888' }} />) : (<button type="button" onClick={() => loadImage(row.document_id)} style={SMALLBTN}>Load image</button>)}
                </div>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  {docFields.length === 0 && <p>(no fields read yet)</p>}
                  {docFields.map((f) => {
                    const fr = docChecks.filter((c) => c.field_key === f.field_key);
                    const ck = row.document_id + ':' + f.field_key;
                    return (
                    <div key={f.field_key} style={{ borderTop: '1px solid #ccc', paddingTop: 8, marginTop: 8 }}>
                      <p><b>{f.field_key}</b>: {f.unreadable ? 'unreadable' : (f.value_text ?? '(empty)')} <small>({f.confidence})</small></p>
                      {fr.length === 0 && <p><small>no checks</small></p>}
                      {fr.map((c, i) => (<p key={i}><b style={{ color: RESCOLOR[c.result] || '#000' }}>{c.result}</b> — {c.reason}</p>))}
                      {correcting[ck] ? (
                        <div>
                          <label>New value: <input value={newValues[ck] || ''} onChange={(e) => setNewValues((p) => ({ ...p, [ck]: e.target.value }))} style={{ display: 'block', width: '100%', padding: 10, minHeight: 44, fontSize: 16, marginTop: 4 }} /></label>
                          <button type="button" onClick={() => reviewAction(row.document_id, 'correct', f.field_key)} disabled={reviewBusy === row.document_id + 'correct' + f.field_key} style={SMALLBTN}>Save correction</button>
                          <button type="button" onClick={() => setCorrecting((p) => ({ ...p, [ck]: false }))} style={SMALLBTN}>Cancel</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setCorrecting((p) => ({ ...p, [ck]: true })); setNewValues((p) => ({ ...p, [ck]: f.unreadable ? '' : (f.value_text || '') })); }} style={SMALLBTN}>Correct</button>
                      )}
                    </div>
                    );
                  })}
                  <div>
                    <button type="button" onClick={() => reviewAction(row.document_id, 'approve')} disabled={reviewBusy === row.document_id + 'approve'} style={SMALLBTN}>Approve</button>
                    <button type="button" onClick={() => reviewAction(row.document_id, 'reject')} disabled={reviewBusy === row.document_id + 'reject'} style={SMALLBTN}>Reject</button>
                  </div>
                  {docReviews.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p><b>Review log:</b></p>
                      <ol>
                        {docReviews.map((r, i) => (<li key={i}><small>{r.created_at}</small>: {r.action}{r.field_key ? ' ' + r.field_key : ''}{r.old_value != null || r.new_value != null ? ' ' + (r.old_value || '(empty)') + ' → ' + (r.new_value || '(empty)') : ''}</li>))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
            );
          })}
        </section>
        )}
        <aside style={{ flex: '1 1 260px', minWidth: 0 }}>
          <h2>Suri&apos;s work log</h2>
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
