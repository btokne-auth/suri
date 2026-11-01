// app/set/[submissionId]/client.js
// Step 6: readiness checklist + work log. Plain, phone-first.
// Step 7: Applicant / Reviewer switch (demo mode, same visitor only).
// No single-document page, no free-text description.
'use client';
import { useEffect, useRef, useState } from 'react';
import SuriHeader from '../../components/SuriHeader.js';
const BTN = { padding: '12px 16px', minHeight: 48, fontSize: 16, width: '100%' };
const SMALLBTN = { padding: '10px 12px', minHeight: 44, fontSize: 16, marginRight: 8, marginTop: 8 };
const RESCOLOR = { match: '#0a0', check: '#a60', mismatch: '#a00', invalid: '#a00' };
const CLARINP = { display: 'block', width: '100%', maxWidth: '100%', padding: 12, minHeight: 44, fontSize: 16, marginTop: 4, border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box' };
const CLARBTN = { padding: '12px 16px', minHeight: 44, fontSize: 16, marginTop: 8, border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', color: 'var(--foreground)', cursor: 'pointer', maxWidth: '100%' };
// Checklist 10b helpers — applicant only, no API change
function fieldLabelFallback(key) {
  const s = String(key || 'value').replace(/_/g, ' ').trim() || 'value';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function humanFieldLabel(key) {
  return fieldLabelFallback(key);
}
function displayDocLabel(label) {
  return String(label || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}
function modelDisplayName(id) {
  if (id === 'muse-spark-1.3') return 'Meta Muse Spark 1.3';
  if (String(id).indexOf('muse-spark-open') >= 0) return 'Meta Muse Spark Open';
  return String(id);
}
function modelNote(message) {
  const m = /\| model=([^|]+) \| ([\d.]+)s/.exec(String(message || ''));
  if (!m) return '';
  return ' · ' + modelDisplayName(m[1].trim()) + ' · ' + m[2] + ' s';
}
function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}
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
  const [docFeedback, setDocFeedback] = useState({});
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
  const [expandedChecks, setExpandedChecks] = useState({});
  const [replaceOpen, setReplaceOpen] = useState({});
  const [showAllLog, setShowAllLog] = useState(false);
  const initialLogSeenRef = useRef(null);
  const [selectedPreviews, setSelectedPreviews] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const previewsRef = useRef({});
  const ocrWorkerRef = useRef(null);
  const ocrWorkerPromiseRef = useRef(null);
  const files = useRef({});
  useEffect(() => { previewsRef.current = selectedPreviews; }, [selectedPreviews]);
  useEffect(() => {
    return () => {
      const cur = previewsRef.current || {};
      for (const k in cur) {
        const v = cur[k];
        if (v && v.url) try { URL.revokeObjectURL(v.url); } catch {}
      }
    };
  }, []);
  useEffect(() => {
    if (data && Array.isArray(data.work_log) && initialLogSeenRef.current === null) {
      initialLogSeenRef.current = new Set((data.work_log || []).map(function (e) { return e.created_at; }));
    }
  }, [data]);
  function handleFilePick(docType) {
    return function (e) {
      const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      setUploadErrors(function (p) { const n = Object.assign({}, p); delete n[docType]; return n; });
      const prev = selectedPreviews[docType];
      if (prev && prev.url) try { URL.revokeObjectURL(prev.url); } catch {}
      if (!f) {
        setSelectedPreviews(function (p) { const n = Object.assign({}, p); delete n[docType]; return n; });
        return;
      }
      const isImage = f.type && f.type.startsWith('image/');
      let url = '';
      try { if (isImage) url = URL.createObjectURL(f); } catch {}
      const sizeLabel = formatFileSize(f.size);
      setSelectedPreviews(function (p) { return Object.assign({}, p, { [docType]: { name: f.name || 'photo', sizeLabel: sizeLabel, url: url, isImage: !!isImage } }); });
    };
  }
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
    if (!picked) { setUploadErrors(function (p) { return Object.assign({}, p, { [t]: 'Choose a photo first.' }); }); return; }
    setBusy(t); setUploadErrors(function (p) { const n = Object.assign({}, p); delete n[t]; return n; });
    try {
      const f = await shrinkForUpload(picked);
      const fd = new FormData();
      fd.append('submission_id', sid);
      fd.append('doc_type', t);
      fd.append('file', f);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (r.ok) {
        const cur = previewsRef.current[t] || selectedPreviews[t];
        if (cur && cur.url) try { URL.revokeObjectURL(cur.url); } catch {}
        setSelectedPreviews(function (p) { const n = Object.assign({}, p); delete n[t]; return n; });
        if (files.current[t]) try { files.current[t].value = ''; } catch {}
        let docLabelUpload = t;
        try { const rowUp = (data && data.rows) ? data.rows.find(function (rw) { return rw && rw.doc_type === t; }) : null; if (rowUp && rowUp.label) docLabelUpload = rowUp.label; } catch {}
        setDocFeedback(function (p) { return Object.assign({}, p, { [t]: { text: '✓ ' + displayDocLabel(docLabelUpload) + ' uploaded.', ts: Date.now() } }); });
        setReplaceOpen(function (p) { return Object.assign({}, p, { [t]: false }); });
        load(sid);
      } else {
        setUploadErrors(function (p) { return Object.assign({}, p, { [t]: 'Upload failed: ' + (j.error || r.status) }); });
      }
    } catch {
      setUploadErrors(function (p) { return Object.assign({}, p, { [t]: 'Upload failed. Try again.' }); });
    }
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
    const feedbackKey = action === 'correct' && fieldKey ? docId + ':' + fieldKey : docId;
    try {
      const body = { action };
      if (action === 'correct') {
        body.field_key = fieldKey;
        body.new_value = newValues[docId + ':' + fieldKey] || '';
      }
      const r = await fetch('/api/documents/' + encodeURIComponent(docId) + '/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setDocFeedback(function (p) { return Object.assign({}, p, { [feedbackKey]: { text: 'Reviewer action failed: ' + (j.error || r.status), ts: Date.now() } }); }); }
      else {
        let docLabel = 'Document';
        try { const rr = (data && data.rows) ? data.rows.find(function(rw){return rw && rw.document_id===docId;}) : null; if (rr && rr.label) docLabel = displayDocLabel(rr.label); } catch {}
        let msgText = '';
        if (action === 'approve') msgText = '✓ ' + docLabel + ' approved.';
        else if (action === 'reject') msgText = '✓ ' + docLabel + ' rejected.';
        else if (action === 'correct') { let fl = fieldKey ? humanFieldLabel(fieldKey) : 'Field'; msgText = '✓ ' + fl + ' corrected.'; }
        else msgText = '✓ Saved.';
        setDocFeedback(function (p) { return Object.assign({}, p, { [feedbackKey]: { text: msgText, ts: Date.now() } }); });
        setCorrecting((p) => ({ ...p, [docId + ':' + fieldKey]: false }));
        load(sid);
      }
    } catch { setDocFeedback(function (p) { return Object.assign({}, p, { [feedbackKey]: { text: 'Reviewer action failed. Try again.', ts: Date.now() } }); }); }
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
        setDocFeedback(function (p) { return Object.assign({}, p, { [clarId]: { text: '✓ Answered. A person will decide.', ts: Date.now() } }); });
        setData(function (prev) {
          if (!prev || !Array.isArray(prev.rows)) return prev;
          const nextRows = prev.rows.map(function (row) {
            if (!row || !Array.isArray(row.clarifications)) return row;
            let found = false;
            const nextClars = row.clarifications.map(function (cl) {
              if (cl && cl.id === clarId) { found = true; return Object.assign({}, cl, { answer: raw, status: 'answered' }); }
              return cl;
            });
            if (!found) return row;
            return Object.assign({}, row, { clarifications: nextClars, action: 'answered, a person will decide', reason: 'You answered. A person will decide.' });
          });
          return Object.assign({}, prev, { rows: nextRows });
        });
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
  if (!data) {
    const isLoading = msg === 'Loading...';
    return (
      <main className="checklist-page">
        <SuriHeader />
        <div className="checklist-intro">
          <span className="checklist-intro-label mono">YOUR PAPERS</span>
          <h1 className="checklist-h1 mono">Your checklist</h1>
        </div>
        <p className="mono" style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: 16 }}>{isLoading ? 'Loading your checklist…' : (msg || 'Could not load.')}</p>
      </main>
    );
  }
  const fieldsMap = data.fields || {};
  const checksAll = data.checks || [];
  const reviewsAll = data.review_actions || [];
  const docTypeById = {};
  for (const row of (data.rows || [])) {
    if (row && row.document_id && !docTypeById[row.document_id]) docTypeById[row.document_id] = row.doc_type;
  }
  const stillReading = (data.rows || []).some((row) => row && (row.status === 'uploaded' || row.status === 'reading'));
  const isUploadMsg = msg && (msg.indexOf('Uploaded. Reading') === 0 || msg.indexOf('Uploading') === 0 || msg.indexOf('Upload ') === 0 || msg.indexOf('Choose a file') === 0);
  const showMsg = msg && msg !== 'Loading...' && !isUploadMsg && !(msg === 'Uploaded. Reading takes ~30s.' && !stillReading) && msg !== data.process.override_note && msg !== 'Overridden. A person decides.';
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
    if (c && c.compared_label) return displayDocLabel(c.compared_label);
    if (!c || !c.compared_document_id) return 'your profile';
    const t = docTypeById[c.compared_document_id];
    return displayDocLabel((t && labelByType[t]) || 'the other document');
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
    const cmp = comparedLabelText(c);
    const suffix = c.result === 'match' ? ' — same as ' + cmp : ' — compared with ' + cmp;
    return (<span><b style={{ color: RESCOLOR[c.result] || '#000' }}>{c.result}</b>{suffix}. {cleanReason(c.reason)}</span>);
  }
  function checksFor(docId) {
    if (!docId) return [];
    return checksAll.filter((c) => c.document_id === docId);
  }
  function renderApplicantClarifications(row) {
    if (!row) return null;
    const action = row.action;
    const clarList = Array.isArray(row.clarifications) ? row.clarifications : [];
    if (action === 'please confirm') {
      const unanswered = clarList.filter(function (cl) { return cl && cl.answer == null && cl.question; });
      if (unanswered.length > 0) {
        return (
          <div style={{ marginTop: 10 }}>
            {unanswered.map(function (cl) {
              return (
                <div key={cl.id} className="checklist-ask">
                  <span className="checklist-ask-label mono">SURI ASKS</span>
                  <p className="checklist-ask-q">{cl.question}</p>
                  <label style={{ display: 'block', maxWidth: '100%' }}>
                    <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Your answer</span>
                    <input value={clarAnswers[cl.id] || ''} onChange={function (e) { setClarAnswers(function (p) { return { ...p, [cl.id]: e.target.value }; }); }} maxLength={200} placeholder="Short answer, e.g. Ma. is short for Maria on my ID" className="checklist-ask-input" />
                  </label>
                  {clarErrors[cl.id] && <p style={{ color: 'var(--mismatch)', fontSize: 14, marginTop: 6, overflowWrap: 'break-word' }}>{clarErrors[cl.id]}</p>}
                  <div className="checklist-ask-actions"><button type="button" onClick={function () { sendClarAnswer(cl.id); }} disabled={!!clarBusy[cl.id]} className="checklist-btn-primary">{clarBusy[cl.id] ? 'Sending...' : 'Send answer'}</button></div>
                  {docFeedback[cl.id] && (<p key={docFeedback[cl.id].ts} className="doc-feedback">{docFeedback[cl.id].text}</p>)}
                </div>
              );
            })}
          </div>
        );
      }
      const hasCheck = checksFor(row.document_id).some(function (c) { return c && c.result === 'check'; });
      if (hasCheck || clarList.length === 0) {
        return <p className="checklist-ask-q" style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 8 }}>Suri is preparing a question…</p>;
      }
      return null;
    }
    if (action === 'answered, a person will decide') {
      const answered = clarList.filter(function (cl) { return cl && cl.answer != null; });
      if (answered.length === 0) return null;
      return (
        <div style={{ marginTop: 10 }}>
          {answered.map(function (cl) {
            return (
              <div key={cl.id} className="checklist-ask">
                <span className="checklist-ask-label mono">SURI ASKED</span>
                <p className="checklist-ask-q">{cl.question}</p>
                <p className="checklist-ask-q" style={{ color: 'var(--text-2)' }}>Your answer: {cl.answer}</p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Answered. A person will decide.</p>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }
  // 10b applicant tag mapping — explicit, NEVER default READY
  function getTag(row, docChecks) {
    const checks = Array.isArray(docChecks) ? docChecks : (row && row.document_id ? checksFor(row.document_id) : []);
    if (!row || !row.document_id) return { text: '+ UPLOAD', cls: 'checklist-tag-upload', markerBg: 'var(--text-2)' };
    if (row.status === 'uploaded' || row.status === 'reading') return { text: 'READING…', cls: 'checklist-tag-reading', markerBg: 'var(--accent)' };
    if (row.action === 'ready') return { text: '✓ READY', cls: 'checklist-tag-ready', markerBg: 'var(--match)' };
    if (row.action === 'please confirm' || row.action === 'answered, a person will decide') return { text: '▪ CONFIRM', cls: 'checklist-tag-confirm', markerBg: 'var(--check)' };
    if (row.status === 'retake_needed') return { text: '↻ RETAKE', cls: 'checklist-tag-fix', markerBg: 'var(--mismatch)' };
    if (row.status === 'wrong_document') return { text: '✕ WRONG DOCUMENT', cls: 'checklist-tag-fix', markerBg: 'var(--mismatch)' };
    if (row.status === 'error') return { text: '↻ TRY AGAIN', cls: 'checklist-tag-fix', markerBg: 'var(--mismatch)' };
    if (row.status === 'approved') return { text: '✓ APPROVED', cls: 'checklist-tag-ready', markerBg: 'var(--match)' };
    if (row.status === 'rejected') return { text: '✕ REJECTED', cls: 'checklist-tag-fix', markerBg: 'var(--mismatch)' };
    const hasMismatch = checks.some(function (c) { return c && (c.result === 'mismatch' || c.result === 'invalid'); });
    if (hasMismatch) return { text: '✕ MISMATCH', cls: 'checklist-tag-fix', markerBg: 'var(--mismatch)' };
    return { text: '▪ CONFIRM', cls: 'checklist-tag-confirm', markerBg: 'var(--check)' };
  }
  function isReadRow(r) {
    return !!(r && r.document_id && r.status !== 'uploaded' && r.status !== 'reading');
  }
  function formatManilaTime(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return ''; }
  }
  function plainReason(reason) {
    const s = String(reason || '');
    return displayDocLabel(s.replace(' (form 138 style)', '')) || s;
  }
  function reviewerDecisionText(docId, reviews) {
    const list = (reviews || []).filter(function (r) { return r && r.document_id === docId && (r.action === 'approve' || r.action === 'reject'); });
    if (!list.length) return null;
    const last = list[list.length - 1];
    const t = formatManilaTime(last.created_at);
    if (last.action === 'approve') return 'Approved by a reviewer' + (t ? ' · ' + t : '');
    return 'Rejected by a reviewer' + (t ? ' · ' + t : '');
  }
  function docLabelForLog(w) {
    if (!w) return 'your document';
    const raw = String((w.message || '') + ' ' + (w.step_type || '')).toLowerCase();
    for (const rr of (data.rows || [])) {
      if (rr && rr.doc_type && raw.includes(rr.doc_type)) return displayDocLabel(rr.label) || rr.doc_type.replace(/_/g, ' ');
    }
    for (const rr of (data.rows || [])) {
      if (rr && rr.label) {
        const ll = String(rr.label).toLowerCase();
        if (ll && raw.includes(ll.toLowerCase().slice(0, 8))) return displayDocLabel(rr.label);
      }
    }
    if (data && data.process && data.process.label) return data.process.label;
    return 'your document';
  }
  // Bug fix: parse check counts only when the number is directly
  // followed by its label (match / to confirm / mismatch / to fix).
  // The old code used (\d+).*?(fix|mismatch|confirm) which counted
  // the "1" from "1 document(s)" as a fix count. We now require
  // "<number> <label>" so document counts are never included.
  function parseCheckCounts(msg) {
    const s = String(msg || '');
    let match = null, confirm = null, mismatch = null;
    const mMatch = s.match(/(\d+)\s*match\b/i);
    if (mMatch) match = parseInt(mMatch[1], 10);
    const mConfirm = s.match(/(\d+)\s*to\s*confirm\b/i);
    if (mConfirm) confirm = parseInt(mConfirm[1], 10);
    else {
      const mConfirm2 = s.match(/(\d+)\s*confirm\b/i);
      if (mConfirm2 && !s.match(/to\s*confirm/i)) confirm = parseInt(mConfirm2[1], 10);
    }
    const mMismatch = s.match(/(\d+)\s*mismatch\b/i);
    if (mMismatch) mismatch = parseInt(mMismatch[1], 10);
    else {
      const mFix = s.match(/(\d+)\s*to\s*fix\b/i);
      if (mFix) mismatch = parseInt(mFix[1], 10);
      else {
        const mFix2 = s.match(/(\d+)\s*fix\b/i);
        if (mFix2) mismatch = parseInt(mFix2[1], 10);
      }
    }
    if (match === null && confirm === null && mismatch === null) return null;
    return { match: match ?? 0, confirm: confirm ?? 0, mismatch: mismatch ?? 0 };
  }
  function workLogSentence(w) {
    if (!w) return 'Suri · Suri updated your checklist.';
    const t = String(w.step_type || '').toLowerCase();
    const label = docLabelForLog(w);
    const m = String(w.message || '');
    let base = '';
    if (t === 'upload' || t.includes('upload')) base = 'Received \u00b7 ' + label;
    else if (t === 'reading_retry' || t.includes('reading_retry')) base = 'Reading again to double-check \u00b7 ' + label;
    else if (t === 'retake_needed' || t === 'retake') base = 'Asked for a clearer photo \u00b7 ' + label;
    else if (t === 'wrong_document') base = 'Looks like a different document \u00b7 ' + label;
    else if (t === 'reading_failed') base = 'Couldn\'t finish reading \u00b7 ' + label;
    else if (t === 'requirement_check') base = m || 'Suri updated your checklist.';
    else if (t === 'requirement_override') base = 'A reviewer overrode the requirement';
    else if (t === 'check_failed') base = 'A check couldn\'t run';
    else if (t === 'clarification_failed' || t === 'clarification_skipped_cap' || t.includes('clarification_failed') || t.includes('clarification_skipped')) base = 'Suri skipped a question';
    else if (t === 'review_approve' || t.includes('review_approve')) base = 'A reviewer approved \u00b7 ' + label;
    else if (t === 'review_reject' || t.includes('review_reject')) base = 'A reviewer rejected \u00b7 ' + label;
    else if (t === 'review_correct' || t.includes('review_correct')) base = 'A reviewer corrected \u00b7 ' + label;
    else if (t === 'reading_started' || (t.includes('reading') && t.includes('start'))) base = 'Reading \u00b7 ' + label;
    else if (t === 'reading_finished' || t === 'reading' || t.includes('reading_finish')) {
      const num = (m.match(/\d+/) || [])[0];
      base = (num ? 'Read ' + num + ' fields \u00b7 ' + label : 'Read \u00b7 ' + label) + modelNote(w.message);
    } else if (t === 'check_finished' || t.includes('check')) {
      const counts = parseCheckCounts(m);
      if (counts) {
        let s = 'Checked \u00b7 ' + counts.match + ' match';
        if (counts.confirm > 0) s += ' \u00b7 ' + counts.confirm + ' to confirm';
        if (counts.mismatch > 0) s += ' \u00b7 ' + counts.mismatch + ' to fix';
        base = s;
      } else base = 'Checked \u00b7 ' + label;
    } else if (t.includes('clarification_asked') || t.includes('asked')) base = 'Asked \u00b7 ' + label;
    else if (t.includes('clarification_answered') || t.includes('answered')) base = 'Answered \u00b7 ' + label;
    else if (t.includes('review')) base = 'Reviewed \u00b7 ' + label;
    else base = 'Suri updated your checklist.';
    let prefix = 'Suri \u00b7 ';
    if (t === 'review_approve' || t === 'review_reject' || t === 'review_correct' || t === 'requirement_override' || t.includes('review_approve') || t.includes('review_reject') || t.includes('review_correct') || t.includes('requirement_override')) prefix = 'Reviewer \u00b7 ';
    else if (t === 'clarification_answered' || t.includes('clarification_answered')) prefix = view === 'reviewer' ? 'Applicant \u00b7 ' : 'You \u00b7 ';
    return prefix + base;
  }
  function formatLogTime(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      const now = Date.now();
      const diff = now - d.getTime();
      if (diff < 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (diff < 60000) return 'just now';
      if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return mins === 1 ? '1 min ago' : mins + ' min ago';
      }
      const isToday = new Date().toDateString() === d.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (isToday) return timeStr;
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return timeStr + ' \u00b7 ' + dateStr;
    } catch { return ''; }
  }
  function formatLogFullTime(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso || '');
      return d.toLocaleString();
    } catch { return String(iso || ''); }
  }
  function logDotColor(w) {
    if (!w) return 'var(--text-3)';
    const t = String(w.step_type || '').toLowerCase();
    const m = String(w.message || '');
    if (t === 'upload' || t.includes('upload')) return 'var(--text-3)';
    if (t === 'reading_retry' || t.includes('reading_retry')) return 'var(--accent)';
    if (t === 'retake_needed') return 'var(--mismatch)';
    if (t === 'wrong_document') return 'var(--mismatch)';
    if (t === 'reading_failed') return 'var(--mismatch)';
    if (t === 'requirement_check') {
      if (m.toLowerCase().includes('passed')) return 'var(--match)';
      return 'var(--mismatch)';
    }
    if (t === 'requirement_override') return 'var(--check)';
    if (t === 'check_failed') return 'var(--check)';
    if (t === 'clarification_failed' || t === 'clarification_skipped_cap' || t.includes('clarification_failed') || t.includes('clarification_skipped')) return 'var(--text-3)';
    if (t === 'review_approve' || t.includes('review_approve')) return 'var(--match)';
    if (t === 'review_reject' || t.includes('review_reject')) return 'var(--mismatch)';
    if (t === 'review_correct' || t.includes('review_correct')) return 'var(--check)';
    if (t === 'reading_started' || (t.includes('reading') && t.includes('start'))) return 'var(--text-3)';
    if (t === 'reading_finished' || t === 'reading' || t.includes('reading_finish')) return 'var(--accent)';
    if (t === 'check_finished' || t.includes('check')) {
      const counts = parseCheckCounts(m);
      if (counts) {
        if (counts.mismatch > 0) return 'var(--mismatch)';
        if (counts.confirm > 0) return 'var(--check)';
        return 'var(--match)';
      }
      return 'var(--match)';
    }
    return 'var(--text-3)';
  }
  // applicant progress/analysis
  const rowsForProgress = Array.isArray(data.rows) ? data.rows : [];
  const readCount = rowsForProgress.filter(isReadRow).length;
  const totalCount = rowsForProgress.length;
  const allRead = totalCount > 0 && rowsForProgress.every(isReadRow);
  let readyN = 0, confirmN = 0, fixN = 0;
  for (const r of rowsForProgress) {
    const tg = getTag(r, r.document_id ? checksFor(r.document_id) : []);
    if (tg.text === '✓ READY') readyN += 1;
    else if (tg.text === '▪ CONFIRM') confirmN += 1;
    else if (['↻ RETAKE', '✕ WRONG DOCUMENT', '↻ TRY AGAIN', '✕ MISMATCH', '✕ REJECTED'].includes(tg.text)) fixN += 1;
  }
  const checklistPageClass = 'checklist-page';
  return (
    <main className={checklistPageClass}>
      <header className="checklist-header">
        <div className="checklist-brand">
          <svg width="22" height="22" viewBox="0 0 28 28" aria-hidden="true"><path d="M2 8V2h6M20 2h6v6M26 20v6h-6M8 26H2v-6" fill="none" stroke="#8B8D94" strokeWidth="1.8" /><text x="14" y="19.5" textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="16" fill="#EDEDEF">S</text><rect x="4" y="13.2" width="20" height="1.6" fill="#7B8CFF" /></svg>
          <span className="checklist-title mono">Suri</span>
        </div>
        <div role="group" aria-label="View" className="checklist-tabs">
          <div aria-hidden="true" className={'checklist-tabs-pill ' + (view === 'applicant' ? 'checklist-tabs-pill-applicant' : 'checklist-tabs-pill-reviewer')}></div>
          <button type="button" onClick={() => setView('applicant')} className={view === 'applicant' ? 'checklist-tab checklist-tab-active' : 'checklist-tab'}>applicant</button>
          <button type="button" onClick={() => setView('reviewer')} className={view === 'reviewer' ? 'checklist-tab checklist-tab-active' : 'checklist-tab'}>reviewer</button>
        </div>
      </header>
      <div className="checklist-intro">
        <span className="checklist-intro-label mono">YOUR PAPERS</span>
        <h1 className="checklist-h1 mono">{data.process.label}</h1>
      </div>
      {showMsg && (<p className="checklist-msg"><b>{msg}</b></p>)}
      {data.submission.status === 'requirement_not_met' && data.process.requirement_message && (<p className="checklist-msg"><b>{data.process.requirement_message}</b> A person still decides.</p>)}
      {data.process.override_note && (<p className="checklist-msg checklist-msg--override"><b>Overridden:</b> {data.process.override_note}</p>)}
      {view === 'reviewer' && data.submission.status === 'requirement_not_met' && (
        <div className="reviewer-override">
          <h3>Requirement override</h3>
          <p>A flag, a person decides. Add a short note to unlock the other documents.</p>
          <label>Note: <input value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} maxLength={200} /></label>
          <button type="button" onClick={sendOverride} disabled={reviewBusy === 'override'} className="reviewer-btn-approve">{reviewBusy === 'override' ? 'Saving...' : 'Override requirement'}</button>
        </div>
      )}
      <div key={view} className="checklist-view">
        <div className="set-wrap" style={{ marginTop: 24 }}>
          {view === 'applicant' && (
          <section className="set-docs" style={{ flex: '2 1 360px' }}>
            <div className="checklist-progress">
              <span className="checklist-progress-count mono">{readCount} OF {totalCount} READ</span>
            </div>
          <div className="checklist-stats">
            <div className="checklist-stat"><span className="checklist-stat-num mono">{readyN}</span><span className="checklist-stat-label mono"><span className="checklist-stat-dot" style={{ background: 'var(--match)' }}></span>READY</span></div>
            <div className="checklist-stat"><span className="checklist-stat-num mono">{confirmN}</span><span className="checklist-stat-label mono"><span className="checklist-stat-dot" style={{ background: 'var(--check)' }}></span>CONFIRM</span></div>
            <div className="checklist-stat"><span className="checklist-stat-num mono">{fixN}</span><span className="checklist-stat-label mono"><span className="checklist-stat-dot" style={{ background: 'var(--mismatch)' }}></span>TO FIX</span></div>
          </div>
          {allRead && (<div className="checklist-analysis mono">ANALYSIS COMPLETE · {readyN} READY · {confirmN} TO CONFIRM{fixN > 0 ? ' · ' + fixN + ' TO FIX' : ''}</div>)}
          <div className="checklist-manifest" style={{ marginTop: 16 }}>
          {(data.rows || []).map(function (row, idx) {
            const docChecks = row.document_id ? checksFor(row.document_id) : [];
            const tag = getTag(row, docChecks);
            const isReading = row.status === 'uploaded' || row.status === 'reading';
            return (
              <div key={row.doc_type} className="checklist-row">
                <span className="checklist-marker" style={{ background: tag.markerBg }} aria-hidden="true"></span>
                <div className="checklist-row-main">
                  <span className="checklist-docid mono">DOC-0{idx + 1}</span>
                  <span className="checklist-docname">{displayDocLabel(row.label)}</span>
                  <span className="checklist-sentence">{String(row.reason || '').replace(/\s*\((?:[^)]*\bstyle|sample[^)]*)\)/gi, '')}</span>
                  {isReading ? (
                    <>
                      <div className="checklist-skeleton" aria-hidden="true">
                        <pre className="checklist-skeleton-pre mono">{'░░▒▒ ▒▒░░░░ ▒▒▒░ ░░▒▒▒ ░░▒▒\n' + (function () { const def = OCR_BUILTIN_DEFS[row.doc_type]; const keys = def && def.fields ? def.fields.map(function (f) { return f.key; }) : []; const labels = keys.length ? keys.map(humanFieldLabel) : ['Document']; return labels.map(function (lbl) { return lbl.toUpperCase().padEnd(12) + ' ░░▒▒▒ ░░▒▒ ░▒\n'; }).join(''); })() + '▒░░▒▒ ░▒▒▒░░ ▒▒░░▒▒░ ░▒▒ ▒░░\n░▒▒▒░░ ▒▒░ ▒▒▒░░ ░▒▒░ ▒░ ░▒▒'}</pre>
                        <div className="checklist-beam"></div>
                      </div>
                      <span className="checklist-reading-label mono">Reading — usually about 30 seconds.</span>
                    </>
                  ) : (
                    <>
                      {docChecks.length > 0 && (function () {
                        const attention = docChecks.filter(function (c) { return c.result !== 'match'; });
                        const passing = docChecks.filter(function (c) { return c.result === 'match'; });
                        const expKey = row.doc_type || String(idx);
                        const isExpanded = !!expandedChecks[expKey];
                        return (
                          <div className="checklist-checks">
                            {attention.filter(function (c) { return (cleanReason(c.reason) || '').trim() !== (row.reason || '').trim(); }).map(function (c, i) {
                              const tone = c.result === 'match' ? 'checklist-checkline-match' : c.result === 'check' ? 'checklist-checkline-check' : 'checklist-checkline-mismatch';
                              const fieldLabel = humanFieldLabel(c.field_key);
                              const baseReason = cleanReason(c.reason) || '';
                              const sameSuffix = isSelfCheck(c) ? '' : (c.result === 'match' ? ' — same as ' + comparedLabelText(c) : ' — compared with ' + comparedLabelText(c));
                              return (<div key={'a-' + i} className={'checklist-checkline ' + tone}><b>{c.result}</b> · {fieldLabel}{sameSuffix}. {baseReason}</div>);
                            })}
                            {passing.length > 0 && (
                              <button type="button" className="checklist-checks-toggle" aria-expanded={isExpanded} onClick={function () { setExpandedChecks(function (p) { return Object.assign({}, p, { [expKey]: !p[expKey] }); }); }}>{'✓ ' + passing.length + ' checks passed'}</button>
                            )}
                            {isExpanded && passing.filter(function (c) { return (cleanReason(c.reason) || '').trim() !== (row.reason || '').trim(); }).map(function (c, i) {
                              const tone = 'checklist-checkline-match';
                              const fieldLabel = humanFieldLabel(c.field_key);
                              const baseReason = cleanReason(c.reason) || '';
                              const sameSuffix = isSelfCheck(c) ? '' : ' — same as ' + comparedLabelText(c);
                              return (<div key={'p-' + i} className={'checklist-checkline ' + tone}><b>{c.result}</b> · {fieldLabel}{sameSuffix}. {baseReason}</div>);
                            })}
                          </div>
                        );
                      })()}
                      {!row.locked && (function () {
                        const tagText = tag.text;
                        const needsDirect = !row.document_id || tagText === '↻ RETAKE' || tagText === '✕ WRONG DOCUMENT' || tagText === '↻ TRY AGAIN';
                        const repKey = row.doc_type || String(idx);
                        const isOpen = !!replaceOpen[repKey];
                        const preview = selectedPreviews[row.doc_type] || null;
                        const hasFile = !!preview;
                        const uploadControls = (
                          <>
                            <div className="upload-row">
                              <label className="upload-btn">+ photo<input type="file" hidden id={'file-' + row.doc_type} ref={function (el) { files.current[row.doc_type] = el; }} accept="image/jpeg,image/png,application/pdf" capture="environment" aria-label={'Upload ' + displayDocLabel(row.label)} onChange={handleFilePick(row.doc_type)} /></label>
                              <button className={"upload-btn" + (hasFile ? " upload-btn--primary" : "")} disabled={!hasFile || busy === row.doc_type} onClick={function () { upload(row.doc_type); }}>{busy === row.doc_type ? 'Uploading…' : 'Upload'}</button>
                            </div>
                            {preview && (
                              <div className="checklist-file-preview">
                                {preview.url && preview.isImage && (<img src={preview.url} alt={'Selected photo: ' + preview.name} className="checklist-file-thumb" />)}
                                <span className="checklist-file-meta"><span className="checklist-file-name" title={preview.name}>{preview.name}</span><span className="checklist-file-size"> · {preview.sizeLabel}</span></span>
                                <button type="button" className="checklist-replace-btn" onClick={function () { const inp = files.current[row.doc_type]; if (inp) inp.click(); }}>change</button>
                              </div>
                            )}
                            {busy === row.doc_type && (<p className="checklist-upload-status mono">Uploading…</p>)}
                            {uploadErrors[row.doc_type] && (<p className="checklist-upload-error">{uploadErrors[row.doc_type]}</p>)}
                          </>
                        );
                        if (needsDirect) return uploadControls;
                        if (!isOpen) {
                          return (<div className="checklist-upload-replace"><button type="button" className="checklist-replace-btn" onClick={function () { setReplaceOpen(function (p) { return Object.assign({}, p, { [repKey]: true }); }); }}>replace photo</button></div>);
                        }
                        return (<div><div className="checklist-upload-replace"><button type="button" className="checklist-replace-btn" onClick={function () { setReplaceOpen(function (p) { return Object.assign({}, p, { [repKey]: false }); }); }}>cancel</button></div>{uploadControls}</div>);
                      })()}
                      {docFeedback[row.doc_type] && (<p key={docFeedback[row.doc_type].ts} className="doc-feedback">{docFeedback[row.doc_type].text}</p>)}
                      {renderApplicantClarifications(row)}
                    </>
                  )}
                </div>
                <span className={'checklist-tag ' + tag.cls}>{tag.text}</span>
              </div>
              );
            })}
          </div>
          <p className="checklist-foot mono" style={{ marginTop: 16 }}>Sample documents only. Uploads are deleted after 7 days. A person always decides.</p>
        </section>
        )}
        {view === 'reviewer' && (
        <section className="set-docs">
          <div className="reviewer-header">
            <p className="reviewer-header-subtitle">Review each document and decide.</p>
            {data.submission.status === 'requirement_not_met' && (<span className="reviewer-header-badge">● needs a decision</span>)}
          </div>
          {(data.rows || []).map(function (row, idx) {
            const docFields = row.document_id ? (fieldsMap[row.document_id] || []) : [];
            const docChecks = row.document_id ? checksAll.filter((c) => c.document_id === row.document_id) : [];
            const docReviews = row.document_id ? reviewsAll.filter((r) => r.document_id === row.document_id) : [];
            return (
            <div key={row.doc_type} className="reviewer-card">
              {function () {
                const docChecks = row.document_id ? checksFor(row.document_id) : [];
                const tag = getTag(row, docChecks);
                const tagMap = { 'checklist-tag-upload': 'reviewer-tag-upload', 'checklist-tag-reading': 'reviewer-tag-reading', 'checklist-tag-ready': 'reviewer-tag-ready', 'checklist-tag-confirm': 'reviewer-tag-confirm', 'checklist-tag-fix': 'reviewer-tag-fix' };
                const tagCls = tagMap[tag.cls] || tag.cls;
                const decision = reviewerDecisionText(row.document_id, reviewsAll);
                return (
                  <>
                    <div className="reviewer-card-header">
                      <span className="reviewer-card-marker" style={{ background: tag.markerBg }} aria-hidden="true"></span>
                      <span className="reviewer-card-docid mono">DOC-0{idx + 1}</span>
                      <span className="reviewer-card-name">{displayDocLabel(row.label)}</span>
                      <span className="reviewer-card-sentence">{plainReason(row.reason)}</span>
                      <span className={'reviewer-card-tag ' + tagCls}>{tag.text}</span>
                    </div>
                    {(row.status === 'approved' || row.status === 'rejected') && (function () { const reviews = reviewsAll.filter(function (r) { return r && r.document_id === row.document_id && (r.action === 'approve' || r.action === 'reject'); }); const last = reviews.length ? reviews[reviews.length - 1] : null; const t = last ? formatManilaTime(last.created_at) : ''; const approved = row.status === 'approved'; return (<span className={"rv-decision rv-decision--" + (approved ? "approved" : "rejected")}>{approved ? "✓ Approved by a reviewer" : "✕ Rejected by a reviewer"}{t ? " · " + t : ""}</span>); })()}
                  </>
                );
              }()}
              {!row.document_id && null}
              {row.document_id && (
              <>
              <div className="rv-body">
                <div className="rv-photo"><a href={imgUrls[row.document_id]} target="_blank" rel="noopener noreferrer"><img src={imgUrls[row.document_id]} alt={displayDocLabel(row.label) + " photo"} /></a><div className="rv-photo-hint">Click to open full size</div></div>
                <div>
                  <div className="reviewer-fields">
                  {docFields.length === 0 && <p>(no fields read yet)</p>}
                  {docFields.map((f) => {
                    const fr = docChecks.filter((c) => c.field_key === f.field_key);
                    const ck = row.document_id + ':' + f.field_key;
                    return (
                    <div key={f.field_key} className="reviewer-field">
                      <span className="reviewer-field-label">{humanFieldLabel(f.field_key)}</span>
                      <span className="reviewer-field-value">{f.unreadable ? '—' : (f.value_text ?? '(empty)')}</span>
                      <span className="reviewer-field-meta">
                        <span className={f.confidence === 'low' ? 'reviewer-field-conf reviewer-field-conf--low' : 'reviewer-field-conf'}>{f.confidence || ''}</span>
                        {!correcting[ck] && (<button type="button" onClick={() => { setCorrecting((p) => ({ ...p, [ck]: true })); setNewValues((p) => ({ ...p, [ck]: f.unreadable ? '' : (f.value_text || '') })); }} className="reviewer-field-correct-btn">Correct</button>)}
                      </span>
                      {fr.length > 0 && (<div className="reviewer-field-checks">{fr.map((c, i) => {
                        const isSelf = isSelfCheck(c);
                        const suffix = isSelf ? '' : (c.result === 'match' ? ' — same as ' + comparedLabelText(c) : ' — compared with ' + comparedLabelText(c));
                        const cls = c.result === 'match' ? 'reviewer-checkline reviewer-checkline-match' : (c.result === 'check' ? 'reviewer-checkline reviewer-checkline-check' : 'reviewer-checkline reviewer-checkline-mismatch');
                        return (<div key={i} className={cls}><b>{c.result === 'match' ? '✓ ' : c.result === 'mismatch' ? '✕ ' : '▪ '}{cleanReason(c.reason)}</b>{suffix}</div>);
                      })}</div>)}
                      {correcting[ck] && (
                        <div>
                          <label>New value: <input value={newValues[ck] || ''} onChange={(e) => setNewValues((p) => ({ ...p, [ck]: e.target.value }))} style={{ display: 'block', width: '100%', padding: 10, minHeight: 44, fontSize: 16, marginTop: 4 }} /></label>
                          <button type="button" onClick={() => reviewAction(row.document_id, 'correct', f.field_key)} disabled={reviewBusy === row.document_id + 'correct' + f.field_key} style={SMALLBTN}>Save correction</button>
                          <button type="button" onClick={() => setCorrecting((p) => ({ ...p, [ck]: false }))} style={SMALLBTN}>Cancel</button>
                          {docFeedback[ck] && (<p key={docFeedback[ck].ts} className="doc-feedback">{docFeedback[ck].text}</p>)}
                        </div>
                      )}
                      {docFeedback[ck] && (<p key={docFeedback[ck].ts} className="doc-feedback">{docFeedback[ck].text}</p>)}
                    </div>
                    );
                  })}
                  </div>
                </div>
                </div>
                  {(row.clarifications || []).filter(function (cl) { return cl && cl.question; }).map(function (cl) {
                    return (
                      <div key={cl.id || cl.question} className="reviewer-clarif-card">
                        <span className="reviewer-clarif-label">SURI ASKED</span>
                        <p className="reviewer-clarif-q">{cl.question}</p>
                        {cl.answer ? (<><div className="reviewer-clarif-divider"></div><span className="reviewer-clarif-label">APPLICANT ANSWERED</span><p className="reviewer-clarif-a">{cl.answer}</p></>) : null}
                      </div>
                    );
                  })}
                  <div className="rv-actions">
                    <button className="rv-btn rv-btn--approve" onClick={() => reviewAction(row.document_id, 'approve')} disabled={reviewBusy === row.document_id + 'approve'}>✓ Approve</button>
                    <button className="rv-btn rv-btn--reject" onClick={() => reviewAction(row.document_id, 'reject')} disabled={reviewBusy === row.document_id + 'reject'}>✕ Reject</button>
                    <button className="rv-btn rv-btn--ghost" onClick={() => handleOcrCompare(row.document_id, row.doc_type)} disabled={ocrByDoc[row.document_id]?.status === 'loading'}>Compare with plain OCR</button>
                    {docFeedback[row.document_id] && <p className="rv-feedback">{docFeedback[row.document_id].text}</p>}
                  </div>
                  {ocrByDoc[row.document_id] && (
                    <section className="rv-ocr">
                      <div className="rv-ocr-head"><span className="rv-ocr-title">Plain OCR vs Suri</span><span className="rv-ocr-score">Suri read <b>{(function () { const fieldsForScore = fieldsMap[row.document_id] || []; return fieldsForScore.filter(function (f) { return f && !f.unreadable && f.value_text != null && String(f.value_text).trim() !== ''; }).length; })()}/{(fieldsMap[row.document_id] || []).length}</b> fields · Plain OCR found <b>{ocrByDoc[row.document_id].foundCount != null ? ocrByDoc[row.document_id].foundCount : ((ocrByDoc[row.document_id].perField || []).filter(function (x) { return x.found; }).length)}</b> of those values</span></div>
                      {ocrByDoc[row.document_id]?.status === 'loading' && (<div className="rv-ocr-loading">Running plain OCR… {ocrByDoc[row.document_id].progress}%</div>)}
                      {ocrByDoc[row.document_id]?.status === 'error' && (<p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--mismatch)', overflowWrap: 'break-word' }}>{ocrByDoc[row.document_id].error}</p>)}
                    {ocrByDoc[row.document_id]?.status === 'done' && (
                      <div>
                        {function () {
                          const pf = ocrByDoc[row.document_id].perField || [];
                          const fieldsForScore = fieldsMap[row.document_id] || [];
                          const total = fieldsForScore.length || pf.length || ocrByDoc[row.document_id].total || 0;
                          const suriRead = fieldsForScore.filter(function (f) { return f && !f.unreadable && f.value_text != null && String(f.value_text).trim() !== ''; }).length;
                          const ocrFound = ocrByDoc[row.document_id].foundCount != null ? ocrByDoc[row.document_id].foundCount : pf.filter(function (x) { return x.found; }).length;
                          return (
                            <>

                              <div className="rv-ocr-tablewrap"><table className="rv-ocr-table"><thead><tr><th>Field</th><th>Suri</th><th>Plain OCR</th></tr></thead>
                                  <tbody>
                                    {pf.map(function (item) {
                                      return (
                                        <tr key={item.fieldKey}>
                                          <td>{humanFieldLabel(item.fieldKey)}</td>
                                          <td>{item.suriValue}</td>
                                          <td className={item.found ? "rv-ocr-yes" : "rv-ocr-no"}>{item.found ? '✓ found in text' : '✕ not found'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <p className="rv-ocr-note">Plain OCR doesn't read fields. This only checks whether Suri's value appears somewhere in its raw text.</p>



                              <details className="rv-ocr-raw"><summary>Raw OCR text</summary><pre>{ocrByDoc[row.document_id].ocrText || '(no text)'}</pre>
                              </details>
                              <div className="rv-ocr-foot"><button className="rv-link" onClick={() => handleOcrCopy(ocrByDoc[row.document_id].ocrText)}>Copy text</button><button className="rv-link" onClick={() => handleOcrCompare(row.document_id, row.doc_type)}>Run again</button><button className="rv-link" onClick={() => handleOcrHide(row.document_id)}>Hide</button></div>
                            </>
                          );
                        }()}
                      </div>
                    )}
                    </section>
                  )}
                  {docReviews.length > 0 && (
                    <div className="reviewer-review-log">
                      <h4>Review log</h4>
                      <ol>
                        {docReviews.map(function (r, i) {
                          const t = formatManilaTime(r.created_at);
                          const label = r.action === 'approve' ? 'Approved' : r.action === 'reject' ? 'Rejected' : r.action === 'correct' ? 'Corrected ' + humanFieldLabel(r.field_key) : r.action;
                          return (<li key={i}>{label}{t ? ' · ' + t : ''}{r.action === 'correct' && (r.old_value || r.new_value) ? ' ' + (r.old_value || '(empty)') + ' → ' + (r.new_value || '(empty)') : ''}</li>);
                        })}
                      </ol>
                    </div>
                  )}
                </>
              )}
            </div>
            );
          })}
        </section>
        )}
        {(data.process && Array.isArray(data.process.not_checked) && data.process.not_checked.length > 0) && (
          <section className="checklist-hand" style={{ marginTop: 16 }}>
            <span className="checklist-hand-title mono">CHECK BY HAND</span>
            <p className="checklist-hand-note">Suri can&apos;t check these yet. A person will need to:</p>
            <ul className="checklist-hand-list">{data.process.not_checked.map(function (t, i) { return (<li key={i}>{t}</li>); })}</ul>
          </section>
        )}
        <aside className="checklist-log">
          <div className="checklist-log-head"><span className="checklist-log-title mono">01 — activity</span><span className="checklist-log-badge mono">WORK LOG</span></div>
          {(data.work_log || []).length === 0 && <p style={{ fontSize: 14, color: 'var(--text-2)' }}>(nothing yet)</p>}
          <ol className="checklist-log-list">
            {(function () {
              const raw = data.work_log || [];
              const seen = initialLogSeenRef.current;
              const mapped = raw.map(function (e) { return { sentence: workLogSentence(e), time: e.created_at, raw: e, dotColor: logDotColor(e), isNew: seen ? !seen.has(e.created_at) : false, relative: formatLogTime(e.created_at), full: formatLogFullTime(e.created_at) }; });
              const reversed = mapped.slice().reverse();
              const collapsed = [];
              reversed.forEach(function (item) {
                const last = collapsed[collapsed.length - 1];
                if (last && last.sentence === item.sentence) { last.count = (last.count || 1) + 1; if (item.isNew) last.isNew = true; } else { collapsed.push({ sentence: item.sentence, time: item.time, dotColor: item.dotColor, isNew: item.isNew, relative: item.relative, full: item.full, count: 1 }); }
              });
              const visible = showAllLog ? collapsed : collapsed.slice(0, 5);
              return (
                <>
                  {visible.map(function (entry, idx) {
                    const label = entry.count > 1 ? entry.sentence + ' \u00d7' + entry.count : entry.sentence;
                    const rowCls = entry.isNew ? 'checklist-log-row checklist-log-row--new' : 'checklist-log-row';
                    return (<li key={idx} className={rowCls}><span className="checklist-log-dot" style={{ background: entry.dotColor }} aria-hidden="true"></span><span className="checklist-log-text">{label}</span><span className="checklist-log-time mono" title={entry.full}>{entry.relative}</span></li>);
                  })}
                  {collapsed.length > 5 && !showAllLog && (
                    <li style={{ listStyle: 'none' }}><button type="button" className="checklist-log-more" onClick={function () { setShowAllLog(true); }}>Show all ({collapsed.length})</button></li>
                  )}
                  {collapsed.length > 5 && showAllLog && (
                    <li style={{ listStyle: 'none' }}><button type="button" className="checklist-log-more" onClick={function () { setShowAllLog(false); }}>Show less</button></li>
                  )}
                </>
              );
            })()}
          </ol>
        </aside>
        </div>
      </div>
    </main>
  );
}
