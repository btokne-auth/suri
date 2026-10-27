// app/test-upload/client.js
// Plain dev-only UI: session -> profile -> submission -> upload valid_id,
// then poll documents status every 3s. Visible buttons only, no styling.
'use client';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
const BTN = { padding: '12px 20px', minHeight: 48, fontSize: 16, background: '#fff', color: '#000', border: '2px solid #000', borderRadius: 8, width: '100%' };
export default function TestUploadClient() {
  const [userId, setUserId] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState([]);
  const [msg, setMsg] = useState('Tap button 1 to start.');
  const [imgUrl, setImgUrl] = useState(null);
  const [fileName, setFileName] = useState('(no file chosen)');
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);
  const timer = useRef(null);
  const add = (l) => setLog((p) => [...p, l]);
  async function ensureSession() {
    setBusy('1'); setMsg('Button 1 tapped: contacting server...');
    try {
      const r = await fetch('/api/session', { method: 'POST' });
      const j = await r.json();
      setUserId(j.user_id ?? null);
      add('session ' + r.status + ': ' + (j.user_id ?? JSON.stringify(j)));
      setMsg(j.user_id ? 'Session OK. Now tap button 2.' : 'Session failed.');
    } catch (e) { setMsg('Button 1 failed: no reply.'); add('session ERROR'); }
    setBusy(null);
  }
  async function saveProfile() {
    setBusy('2'); setMsg('Button 2 tapped: saving profile...');
    try {
      const r = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ given_name: 'Maria', middle_name: 'Santos', surname: 'Dela Cruz', suffix: '', birth_date: '2015-06-15', city_municipality: 'Linawan' }) });
      const j = await r.json();
      add('profile ' + r.status + ': ' + JSON.stringify(j));
      setMsg(r.ok ? 'Profile saved. Now tap button 3.' : 'Profile failed: ' + (j.error || r.status));
    } catch (e) { setMsg('Button 2 failed.'); add('profile ERROR'); }
    setBusy(null);
  }
  async function getSubmission() {
    setBusy('3'); setMsg('Button 3 tapped: getting submission...');
    try {
      const r = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ process_id: 'linawan_scholarship_intake' }) });
      const j = await r.json();
      setSubmissionId(j.submission_id ?? null);
      add('submission ' + r.status + ': ' + JSON.stringify(j));
      setMsg(j.submission_id ? 'Submission ready. Choose a file, then tap 4.' : 'Submission failed.');
    } catch (e) { setMsg('Button 3 failed.'); add('submission ERROR'); }
    setBusy(null);
  }
  // Shrink photos in the browser (no new library): longest side 2000px,
  // JPEG ~0.85. PDFs are never resized. Keeps uploads under the limit.
  async function shrinkForUpload(f) {
    if (!f || f.type === "application/pdf" || !f.type.startsWith("image/")) return f;
    try {
      const bmp = await createImageBitmap(f);
      const w = bmp.width, h = bmp.height;
      const longest = Math.max(w, h);
      const scale = Math.min(1, 2000 / longest);
      if (scale === 1 && f.size <= Math.floor(4.5 * 1024 * 1024) && f.type === "image/jpeg") {
        bmp.close();
        return f;
      }
      const nw = Math.max(1, Math.round(w * scale));
      const nh = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bmp, 0, 0, nw, nh);
      bmp.close();
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      if (!blob) return f;
      const name = (f.name || "photo").replace(/\.\w+$/, "") + ".jpg";
      return new File([blob], name, { type: "image/jpeg" });
    } catch {
      return f;
    }
  }
  async function upload() {
    setBusy('4');
    const picked = fileRef.current?.files?.[0];
    if (!picked) { setMsg('Choose a file first (tap Choose File above).'); setBusy(null); return; }
    if (!submissionId) { setMsg('Tap button 3 first to get a submission.'); setBusy(null); return; }
    const f = await shrinkForUpload(picked);
    setFileName(f.name + (f !== picked ? ' (shrunk for upload)' : ''));
    setMsg('Button 4 tapped: uploading ' + f.name + '...');
    setImgUrl(null);
    try {
      const fd = new FormData();
      fd.append('submission_id', submissionId);
      fd.append('doc_type', 'valid_id');
      fd.append('file', f);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      add('upload ' + r.status + ': ' + JSON.stringify(j));
      if (!r.ok) { setMsg('Upload failed: ' + (j.error || r.status)); setBusy(null); return; }
      setDocumentId(j.document_id);
      setMsg('Uploaded. Watching status below (wait ~30s)...');
      poll(j.document_id);
    } catch (e) { setMsg('Button 4 failed.'); add('upload ERROR'); }
    setBusy(null);
  }
  async function poll(docId) {
    if (timer.current) clearInterval(timer.current);
    const supabase = createClient();
    const tick = async () => {
      try {
        const { data } = await supabase.from('documents').select('id,status').eq('id', docId).maybeSingle();
        if (data) {
          setStatus(data.status);
          add('status: ' + data.status);
          if (data.status === 'needs_review' || data.status === 'retake_needed' || data.status === 'error') { clearInterval(timer.current); setMsg('Done: status = ' + data.status); }
        } else { add('status: (no row yet)'); }
      } catch (e) { add('status ERROR'); }
    };
    await tick();
    timer.current = setInterval(tick, 3000);
  }
  async function loadImage() {
    setBusy('5'); setMsg('Button 5 tapped: loading image link...');
    if (!documentId) { setMsg('Upload first (button 4).'); setBusy(null); return; }
    try {
      const r = await fetch('/api/documents/' + documentId + '/image');
      const j = await r.json();
      add('image ' + r.status + ': ' + (j.url ? 'signed url ok' : JSON.stringify(j)));
      if (j.url) { setImgUrl(j.url); setMsg('Image link ready below.'); }
      else setMsg('Image failed.');
    } catch (e) { setMsg('Button 5 failed.'); }
    setBusy(null);
  }
  return (
    <main style={{ padding: 16, maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui', background: '#000', color: '#fff', minHeight: '100vh' }}>
      <h1>Step 5 upload test (dev only)</h1>
      <p>Use a synthetic SAMPLE valid_id photo. Never a real ID.</p>
      <p style={{ background: '#ff0', color: '#000', padding: 12, fontWeight: 'bold' }}>{busy ? 'Working... (' + busy + ')' : msg}</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <button type="button" onClick={ensureSession} style={BTN}>1. Ensure session {userId ? 'OK' : ''}</button>
        <button type="button" onClick={saveProfile} style={BTN}>2. Save sample profile</button>
        <button type="button" onClick={getSubmission} style={BTN}>3. Get submission {submissionId ? 'OK' : ''}</button>
        <label style={{ display: 'block', background: '#fff', color: '#000', padding: 12, borderRadius: 8 }}>Choose file: <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={() => setFileName(fileRef.current?.files?.[0]?.name || '(no file chosen)')} style={{ width: '100%', marginTop: 8 }} /> <span>{fileName}</span></label>
        <button type="button" onClick={upload} style={BTN}>4. Upload valid_id</button>
        <button type="button" onClick={loadImage} style={BTN}>5. Load image URL</button>
      </div>
      {userId && <p><b>user:</b> <code>{userId}</code></p>}
      {submissionId && <p><b>submission:</b> <code>{submissionId}</code></p>}
      {documentId && <p><b>document:</b> <code>{documentId}</code> status=<b>{status ?? '...'}</b></p>}
      {imgUrl && <p><a href={imgUrl} style={{ color: '#ff0' }}>open signed image (5 min)</a></p>}
      <h2>Log</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', color: '#000', padding: 12, minHeight: 120 }}>{log.length ? log.join('\n') : '(empty - tap button 1)'}</pre>
    </main>
  );
}
