// app/set/[submissionId]/client.js
// Step 6: readiness checklist + work log. Plain, phone-first.
// Step 7: Applicant / Reviewer switch (demo mode, same visitor only).
// No single-document page, no free-text description.
'use client';
import { useEffect, useRef, useState } from 'react';
const BTN = { padding: '12px 16px', minHeight: 48, fontSize: 16, width: '100%' };
const SMALLBTN = { padding: '10px 12px', minHeight: 44, fontSize: 16, marginRight: 8, marginTop: 8 };
const RESCOLOR = { match: '#0a0', check: '#a60', mismatch: '#a00', invalid: '#a00' };
const CLARINP = { display: 'block', width: '100%', maxWidth: '100%', padding: 12, minHeight: 44, fontSize: 16, marginTop: 4, border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box' };
const CLARBTN = { padding: '12px 16px', minHeight: 44, fontSize: 16, marginTop: 8, border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', color: 'var(--foreground)', cursor: 'pointer', maxWidth: '100%' };
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
  const [view, setView] = useState('applicant');
  const [imgUrls, setImgUrls] = useState({});
  const [correcting, setCorrecting] = useState({});
  const [newValues, setNewValues] = useState({});
  const [overrideNote, setOverrideNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(null);
  const [clarAnswers, setClarAnswers] = useState({});
  const [clarErrors, setClarErrors] = useState({});
  const [clarBusy, setClarBusy] = useState({});
  const [clarSuccess, setClarSuccess] = useState({});
  const [ocrByDoc, setOcrByDoc] = useState({});
  const ocrWorkerRef = useRef(null);
  const ocrWorkerPromiseRef = useRef(null);
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
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1] || '';
      if (id) setSid(id);
      else setMsg('Could not load.');
    } catch {
      setMsg('Could not load.');
    }
  }, []);
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
  useEffect(() => {
    return () => {
      const w = ocrWorkerRef.current;
      if (w && typeof w.terminate === 'function') {
        try { w.terminate(); } catch {}
      }
    };
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
  async function sendClarAnswer(clarId) {
    const raw = clarAnswers[clarId] || '';
    setClarErrors((p) => ({ ...p, [clarId]: '' }));
    setClarBusy((p) => ({ ...p, [clarId]: true }));
    try {
      const r = await fetch('/api/clarifications/' + encodeURIComponent(clarId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: raw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const friendly = j.error || 'Could not save. Please try again.';
        setClarErrors((p) => ({ ...p, [clarId]: friendly }));
      } else {
        setClarSuccess((p) => ({ ...p, [clarId]: true }));
        setClarAnswers((p) => ({ ...p, [clarId]: '' }));
        setClarErrors((p) => ({ ...p, [clarId]: '' }));
        setMsg('Answered. A person will decide.');
        load(sid);
      }
    } catch {
      setClarErrors((p) => ({ ...p, [clarId]: 'Could not save. Check internet.' }));
    }
    setClarBusy((p) => ({ ...p, [clarId]: false }));
  }
  const OCR_BUILTIN_DEFS = {
    birth_certificate: { id: 'birth_certificate', label: 'Birth certificate', fields: [{ key: 'full_name', type: 'name' }, { key: 'sex', type: 'choice' }, { key: 'date_of_birth', type: 'date' }, { key: 'place_of_birth', type: 'text' }, { key: 'mother_maiden_name', type: 'name' }, { key: 'father_name', type: 'name' }, { key: 'registry_number', type: 'code' }, { key: 'date_issued', type: 'date' }] },
    valid_id: { id: 'valid_id', label: 'Valid ID', fields: [{ key: 'full_name', type: 'name' }, { key: 'date_of_birth', type: 'date' }, { key: 'sex', type: 'choice' }, { key: 'address_line', type: 'text' }, { key: 'address_city_municipality', type: 'text' }, { key: 'address_province', type: 'text' }, { key: 'id_number', type: 'code' }, { key: 'date_issued', type: 'date' }] },
    report_card: { id: 'report_card', label: 'Report card', fields: [{ key: 'full_name', type: 'name' }, { key: 'school_name', type: 'text' }, { key: 'school_year', type: 'code' }, { key: 'grade_level', type: 'choice' }, { key: 'adviser_name', type: 'name' }, { key: 'general_average', type: 'number' }] },
    official_receipt: { id: 'official_receipt', label: 'Official receipt', fields: [{ key: 'store_name', type: 'text' }, { key: 'receipt_number', type: 'code' }, { key: 'receipt_date', type: 'date' }, { key: 'item_1_amount', type: 'number' }, { key: 'item_2_amount', type: 'number' }, { key: 'item_3_amount', type: 'number' }, { key: 'subtotal_amount', type: 'number' }, { key: 'vat_amount', type: 'number' }, { key: 'total_amount', type: 'number' }] },
  };
  function ocrGetFieldDef(docType, fieldKey) {
    const d = OCR_BUILTIN_DEFS[docType];
    if (d && Array.isArray(d.fields)) {
      const f = d.fields.find(function (x) { return x.key === fieldKey; });
      if (f) return f;
    }
    const k = String(fieldKey || '').toLowerCase();
    if (k.includes('name')) return { key: fieldKey, type: 'name' };
    if (k.includes('date')) return { key: fieldKey, type: 'date' };
    if (k.includes('amount') || k.includes('total') || k.includes('subtotal') || k.includes('vat') || k === 'general_average') return { key: fieldKey, type: 'number' };
    if (k === 'sex' || k === 'grade_level') return { key: fieldKey, type: 'choice' };
    if (k.includes('number') || k.includes('registry') || k.includes('code')) return { key: fieldKey, type: 'code' };
    return { key: fieldKey, type: 'text' };
  }
  async function handleOcrCompare(docId, docType) {
    if (!docId) return;
    const existing = ocrByDoc[docId];
    if (existing && existing.status === 'loading') return;
    setOcrByDoc(function (prev) { return Object.assign({}, prev, { [docId]: { status: 'loading', progress: 0, ocrText: null, perField: [], error: null, foundCount: 0, total: 0 } }); });
    let worker = ocrWorkerRef.current;
    if (!worker) {
      if (ocrWorkerPromiseRef.current) {
        try { worker = await ocrWorkerPromiseRef.current; } catch {}
      }
      if (!worker) {
        const promise = (async function () {
          const mod = await import('tesseract.js');
          const createWorker = mod.createWorker || (mod.default && mod.default.createWorker);
          if (!createWorker) throw new Error('Tesseract not available');
          const w = await createWorker('eng', 1, {
            workerPath: '/tesseract/worker.min.js',
            corePath: '/tesseract/tesseract-core.wasm.js',
            langPath: '/tesseract/lang-data',
            gzip: true,
            logger: function (m) {
              if (m && typeof m.progress === 'number') {
                const pct = Math.round(m.progress * 100);
                setOcrByDoc(function (prev) {
                  const cur = prev[docId];
                  if (!cur || cur.status !== 'loading') return prev;
                  return Object.assign({}, prev, { [docId]: Object.assign({}, cur, { progress: pct }) });
                });
              }
            },
          });
          ocrWorkerRef.current = w;
          return w;
        })();
        ocrWorkerPromiseRef.current = promise;
        try { worker = await promise; } catch {
          setOcrByDoc(function (prev) { return Object.assign({}, prev, { [docId]: { status: 'error', progress: 0, ocrText: null, perField: [], error: 'Could not start plain OCR. Please try again.', foundCount: 0, total: 0 } }); });
          ocrWorkerPromiseRef.current = null;
          return;
        }
        ocrWorkerPromiseRef.current = null;
      }
    }
    let blob = null;
    try {
      const resp = await fetch('/api/documents/' + encodeURIComponent(docId) + '/image-proxy');
      if (!resp.ok) {
        let friendly = 'Could not run plain OCR on this file. Please try again.';
        try { const jj = await resp.json(); if (jj && jj.error) friendly = jj.error; } catch {}
        setOcrByDoc(function (prev) { return Object.assign({}, prev, { [docId]: { status: 'error', progress: 0, ocrText: null, perField: [], error: friendly, foundCount: 0, total: 0 } }); });
        return;
      }
      blob = await resp.blob();
    } catch {
      setOcrByDoc(function (prev) { return Object.assign({}, prev, { [docId]: { status: 'error', progress: 0, ocrText: null, perField: [], error: 'Could not load image for plain OCR. Please try again.', foundCount: 0, total: 0 } }); });
      return;
    }
    let text = '';
    try {
      const result = await worker.recognize(blob);
      text = result && result.data && result.data.text ? String(result.data.text) : '';
    } catch {
      setOcrByDoc(function (prev) { return Object.assign({}, prev, { [docId]: { status: 'error', progress: 0, ocrText: null, perField: [], error: 'Could not run plain OCR on this file. Please try again.', foundCount: 0, total: 0 } }); });
      return;
    }
    let ocrFoundInTextFn = null;
    try {
      const mod2 = await import('@/lib/ocr-compare.js');
      ocrFoundInTextFn = mod2.ocrFoundInText || (mod2.default && mod2.default.ocrFoundInText) || null;
    } catch {}
    const docFields = data && data.fields && data.fields[docId] ? data.fields[docId] : [];
    const perField = [];
    let foundCount = 0;
    for (let i = 0; i < docFields.length; i++) {
      const f = docFields[i];
      const fieldKey = f.field_key;
      const expectedRaw = f.value_text != null ? f.value_text : (f.value != null ? f.value : '');
      const unreadable = f.unreadable === true;
      if (unreadable) { perField.push({ fieldKey: fieldKey, suriValue: '—', suriUnreadable: true, found: false }); continue; }
      const fieldDef = ocrGetFieldDef(docType, fieldKey);
      let found = false;
      try {
        if (ocrFoundInTextFn) found = !!ocrFoundInTextFn({ fieldDef: fieldDef, ocrText: text, expected: expectedRaw });
        else { const hay = String(text).toLowerCase(); const needle = String(expectedRaw).toLowerCase().trim(); found = !!needle && hay.indexOf(needle) >= 0; }
      } catch { found = false; }
      if (found) foundCount += 1;
      const displayVal = expectedRaw != null && String(expectedRaw).trim() !== '' ? String(expectedRaw) : '(empty)';
      perField.push({ fieldKey: fieldKey, suriValue: displayVal, suriUnreadable: false, found: found });
    }
    setOcrByDoc(function (prev) { return Object.assign({}, prev, { [docId]: { status: 'done', progress: 100, ocrText: text, perField: perField, error: null, foundCount: foundCount, total: docFields.length } }); });
  }
  function handleOcrHide(docId) {
    setOcrByDoc(function (prev) { const n = Object.assign({}, prev); delete n[docId]; return n; });
  }
  async function handleOcrCopy(text) {
    try { if (navigator && navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text || ''); } catch {}
  }
  if (!data) return (<main className="set-page"><h1>Your checklist</h1><p>{msg}</p></main>);
  const fieldsMap = data.fields || {};
  const checksAll = data.checks || [];
  const reviewsAll = data.review_actions || [];
  const docTypeById = {};
  for (const row of (data.rows || [])) {
    if (row && row.document_id && !docTypeById[row.document_id]) docTypeById[row.document_id] = row.doc_type;
  }
  // "Uploaded. Reading..." is a guess at upload time: hide it as soon as
  // no row is still reading.
  const stillReading = (data.rows || []).some((row) => row && (row.status === 'uploaded' || row.status === 'reading'));
  const showMsg = msg && msg !== 'Loading...' && !(msg === 'Uploaded. Reading takes ~30s.' && !stillReading);
  // Each check says what it compared against: "same as your profile" or
  // "same as {label}". Same-document checks (sum_equals plus the fixed
  // rule/value rules contains, equals, within_months, not_future) compare
  // within one document, so they show "result. reason" with no "same as"
  // suffix, like the receipt checks. The label arrives on each
  // check from the API (document settings, never hard-coded); the fallback
  // below rebuilds it from the row labels for the same result.
  const labelByType = {};
  for (const row of (data.rows || [])) {
    if (row && row.doc_type && row.label && !labelByType[row.doc_type]) labelByType[row.doc_type] = row.label;
  }
  function isSelfCheck(c) {
    if (!c) return false;
    if (c.rule === 'sum_equals') return true;
    // Fixed rule or value inside the SAME document (contains, equals,
    // within_months, not_future): no "same as" suffix, like receipt checks.
    // Saved self-like rows use compared_document_id = own id.
    if (c.document_id && c.compared_document_id && c.document_id === c.compared_document_id) return true;
    if (['contains', 'equals', 'within_months', 'not_future'].includes(c.rule)) return true;
    return false;
  }
  function comparedLabelText(c) {
    if (c && c.compared_label) return c.compared_label;
    if (!c || !c.compared_document_id) return 'your profile';
    const t = docTypeById[c.compared_document_id];
    return (t && labelByType[t]) || 'the other document';
  }
  // Rows saved earlier may end with a baked-in "— same as ...": strip it so
  // the line never says it twice.
  function cleanReason(reason) {
    return String(reason || '').replace(/\s*[—–-]\s*same as [^.]*\.?\s*$/i, '').trim();
  }
  function checkLine(c) {
    if (isSelfCheck(c)) {
      return (<span><b style={{ color: RESCOLOR[c.result] || '#000' }}>{c.result}</b>. {cleanReason(c.reason)}</span>);
    }
    return (<span><b style={{ color: RESCOLOR[c.result] || '#000' }}>{c.result}</b> — same as {comparedLabelText(c)}. {cleanReason(c.reason)}</span>);
  }
  function checksFor(docId) {
    if (!docId) return [];
    return checksAll.filter((c) => c.document_id === docId);
  }
  return (
    <main className="set-page">
      <h1>Your checklist</h1>
      <p>{data.process.label}</p>
      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => setView('applicant')} disabled={view === 'applicant'} style={SMALLBTN}>Applicant</button>
        <button type="button" onClick={() => setView('reviewer')} disabled={view === 'reviewer'} style={SMALLBTN}>Reviewer</button>
      </div>
      {showMsg && (<p style={{ border: '2px solid #000', padding: 12 }}><b>{msg}</b></p>)}
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
      <div className="set-wrap">
        {view === 'applicant' && (
        <section className="set-docs">
          <h2>Documents</h2>
          {(data.rows || []).map((row) => (
            <div key={row.doc_type} style={{ border: '1px solid #888', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <h3>{row.label}</h3>
              <p>Status: <b>{row.status}</b>{row.locked ? ' (locked)' : ''}</p>
              <p>Action: <b>{row.action}</b>{String(row.reason).trim().toLowerCase() !== String(row.action).trim().toLowerCase() ? ' — ' + row.reason : ''}</p>
              {row.action === 'please confirm' && (() => {
                const clarList = row.clarifications || [];
                const unanswered = clarList.filter(function (cl) { return cl && cl.answer == null && cl.question; });
                if (unanswered.length > 0) {
                  return (
                    <div style={{ marginTop: 10 }}>
                      {unanswered.map(function (cl) {
                        return (
                          <div key={cl.id} style={{ border: '1px solid var(--foreground)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--background)', maxWidth: '100%', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
                            <p style={{ margin: '4px 0' }}><b>Suri asks:</b> {cl.question}</p>
                            <label style={{ display: 'block', marginTop: 8, maxWidth: '100%' }}>
                              <span style={{ fontSize: 14 }}>Your answer (max 200):</span>
                              <input value={clarAnswers[cl.id] || ''} onChange={function (e) { setClarAnswers(function (p) { return { ...p, [cl.id]: e.target.value }; }); }} maxLength={200} placeholder="Short answer, e.g. Ma. is short for Maria on my ID" style={CLARINP} />
                            </label>
                            {clarErrors[cl.id] && <p style={{ color: '#a00', fontSize: 14, marginTop: 6, overflowWrap: 'break-word' }}>{clarErrors[cl.id]}</p>}
                            {clarSuccess[cl.id] && <p style={{ border: '1px solid #a60', background: '#FBF0D9', color: '#3D2F10', padding: 8, marginTop: 8, borderRadius: 6, maxWidth: '100%', overflowWrap: 'break-word' }}>Answered. A person will decide.</p>}
                            <button type="button" onClick={function () { sendClarAnswer(cl.id); }} disabled={!!clarBusy[cl.id]} style={CLARBTN}>{clarBusy[cl.id] ? 'Sending...' : 'Send answer'}</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                const hasCheck = checksFor(row.document_id).some(function (c) { return c.result === 'check'; });
                if (hasCheck || clarList.length === 0) {
                  return <p style={{ marginTop: 10, padding: 8, border: '1px solid #a60', borderRadius: 8, background: '#FBF0D9', color: '#3D2F10', maxWidth: '100%', overflowWrap: 'break-word' }}>Suri is preparing a question…</p>;
                }
                return null;
              })()}
              {row.action === 'answered, a person will decide' && (() => {
                const clarList = row.clarifications || [];
                const answered = clarList.filter(function (cl) { return cl && cl.answer != null; });
                if (answered.length === 0) return null;
                return (
                  <div style={{ marginTop: 10 }}>
                    {answered.map(function (cl) {
                      return (
                        <div key={cl.id} style={{ border: '1px solid #a60', borderRadius: 8, padding: 12, marginBottom: 10, background: '#FBF0D9', color: '#3D2F10', maxWidth: '100%', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
                          <p style={{ margin: '4px 0' }}><b>Suri asked:</b> {cl.question}</p>
                          <p style={{ margin: '4px 0' }}><b>Your answer:</b> {cl.answer}</p>
                          <p style={{ margin: '6px 0 0', fontSize: 14 }}>Answered. A person will decide.</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {checksFor(row.document_id).length > 0 && (
                <ul>
                  {checksFor(row.document_id).map((c, i) => (<li key={i}>{checkLine(c)}</li>))}
                </ul>
              )}
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
        <section className="set-docs">
          <h2>Reviewer</h2>
          {(data.rows || []).map((row) => {
            const docFields = row.document_id ? (fieldsMap[row.document_id] || []) : [];
            const docChecks = row.document_id ? checksAll.filter((c) => c.document_id === row.document_id) : [];
            const docReviews = row.document_id ? reviewsAll.filter((r) => r.document_id === row.document_id) : [];
            return (
            <div key={row.doc_type} style={{ border: '1px solid #888', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <h3>{row.label}</h3>
              <p>Status: <b>{row.status}</b>{row.locked ? ' (locked)' : ''}</p>
              <p>Action: <b>{row.action}</b> — {row.reason}</p>
              {!row.document_id && <p>(not uploaded yet)</p>}
              {row.document_id && (
              <div className="review-pair">
                <div>
                  {imgUrls[row.document_id] ? (<img src={imgUrls[row.document_id]} alt={row.label} style={{ width: '100%', height: 'auto', border: '1px solid #888' }} />) : (<button type="button" onClick={() => loadImage(row.document_id)} style={SMALLBTN}>Load image</button>)}
                </div>
                <div>
                  {docFields.length === 0 && <p>(no fields read yet)</p>}
                  {docFields.map((f) => {
                    const fr = docChecks.filter((c) => c.field_key === f.field_key);
                    const ck = row.document_id + ':' + f.field_key;
                    return (
                    <div key={f.field_key} style={{ borderTop: '1px solid #ccc', paddingTop: 8, marginTop: 8 }}>
                      <p><b>{f.field_key}</b>: {f.unreadable ? 'unreadable' : (f.value_text ?? '(empty)')} <small>({f.confidence})</small></p>
                      {fr.length === 0 && <p><small>no checks</small></p>}
                      {fr.map((c, i) => {
                        const clar = c.clarification || null;
                        return (
                          <div key={i} style={{ maxWidth: '100%', overflowWrap: 'break-word' }}>
                            <p>{checkLine(c)}</p>
                            {clar && c.result === 'check' && (
                              <div style={{ marginTop: 6, padding: 8, border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', maxWidth: '100%', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
                                <p style={{ margin: '4px 0' }}><b>Suri asked:</b> {clar.question}</p>
                                <p style={{ margin: '4px 0' }}><b>Applicant answered:</b> {clar.answer != null ? clar.answer : 'Not answered yet'}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                  <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => handleOcrCompare(row.document_id, row.doc_type)} disabled={ocrByDoc[row.document_id]?.status === 'loading'} aria-label="Compare with plain OCR (no AI) — runs in browser" aria-busy={ocrByDoc[row.document_id]?.status === 'loading'} style={Object.assign({}, SMALLBTN, { border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', color: 'var(--foreground)', cursor: 'pointer', borderStyle: 'dashed', width: '100%', maxWidth: '100%', boxSizing: 'border-box', marginRight: 0 })}>Compare with plain OCR</button>
                    {ocrByDoc[row.document_id]?.status === 'loading' && (<p style={{ margin: '8px 0 0', fontSize: 14 }} aria-live="polite">Reading with plain OCR… {ocrByDoc[row.document_id].progress}%</p>)}
                    {ocrByDoc[row.document_id]?.status === 'error' && (<p style={{ margin: '8px 0 0', fontSize: 14, color: '#a00', overflowWrap: 'break-word' }}>{ocrByDoc[row.document_id].error}</p>)}
                    {ocrByDoc[row.document_id]?.status === 'done' && (
                      <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', maxWidth: '100%', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
                        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>Plain OCR (no AI) vs Suri (Muse Spark)</p>
                        <p style={{ margin: '0 0 6px', fontSize: 12, color: '#666' }}>Plain OCR runs in your browser — no server cost.</p>
                        <p style={{ margin: '0 0 8px', fontSize: 14 }}>Plain OCR found {ocrByDoc[row.document_id].foundCount} of {ocrByDoc[row.document_id].total} fields.</p>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {ocrByDoc[row.document_id].perField.map(function (pf) {
                            return (
                              <div key={pf.fieldKey} style={{ padding: '6px 8px', border: '1px solid var(--foreground)', borderRadius: 6, background: 'var(--background)' }}>
                                <div style={{ fontSize: 14, overflowWrap: 'break-word' }}><b>{pf.fieldKey}:</b> Suri (Muse Spark): {pf.suriValue}</div>
                                <div style={{ fontSize: 14 }}>Plain OCR (no AI): {pf.suriUnreadable ? (<span style={{ color: '#888' }}>—</span>) : (pf.found ? (<span style={{ color: '#0a0' }}>✓ found</span>) : (<span style={{ color: '#888' }}>✗ not found</span>))}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: 8, maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'monospace', border: '1px solid var(--foreground)', borderRadius: 6, padding: 8, background: 'var(--background)', color: 'var(--foreground)', overflowWrap: 'break-word', wordBreak: 'break-word', boxSizing: 'border-box' }}>{ocrByDoc[row.document_id].ocrText || '(no text)'}</div>
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button type="button" onClick={() => handleOcrCopy(ocrByDoc[row.document_id].ocrText)} style={Object.assign({}, SMALLBTN, { marginRight: 0 })}>Copy OCR text</button>
                          <button type="button" onClick={() => handleOcrCompare(row.document_id, row.doc_type)} style={Object.assign({}, SMALLBTN, { marginRight: 0 })}>Run again</button>
                          <button type="button" onClick={() => handleOcrHide(row.document_id)} style={Object.assign({}, SMALLBTN, { marginRight: 0 })}>Hide</button>
                        </div>
                      </div>
                    )}
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
        {(data.process && Array.isArray(data.process.not_checked) && data.process.not_checked.length > 0) && (
          <section style={{ border: '1px solid #a60', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <h3>Check by hand</h3>
            <p><small>Suri can&apos;t check these yet. A person will need to:</small></p>
            <ul>{data.process.not_checked.map((t, i) => (<li key={i}>{t}</li>))}</ul>
          </section>
        )}
        <aside className="set-log">
          <h2>Suri&apos;s work log</h2>
          {(data.work_log || []).length === 0 && <p>(nothing yet)</p>}
          <ol>
            {(data.work_log || []).map((w, i) => (<li key={i}><small>{w.step_type}</small>: {w.message}</li>))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
