// app/setup/client.js
// Step 7c Part 3: describe -> confirm. No add-block UI, draft in state only.
// Phone-first like /start. Server re-validates on Confirm.
'use client';
import { useState } from 'react';
const INP = { display: 'block', width: '100%', maxWidth: '100%', padding: 12, minHeight: 44, fontSize: 16, marginTop: 4, border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', color: 'var(--foreground)' };
const BTN = { padding: '14px 20px', minHeight: 48, fontSize: 17, width: '100%', marginTop: 16 };
const CARD = { border: '1px solid #888', borderRadius: 8, padding: 12, marginBottom: 8 };
const EXAMPLE = 'Barangay clearance: valid ID + proof of billing. Names match. Address in Barangay Baybayin. Bill from the last 3 months.';
function docIdOf(e) { return (e && (e.reuse || e.id)) || ''; }
function builtinLabel(id) {
  if (id === 'valid_id') return "Valid ID (voter's ID style)";
  if (id === 'birth_certificate') return 'Birth certificate';
  if (id === 'report_card') return 'Report card (Form 138 style)';
  if (id === 'official_receipt') return 'Official receipt (sample store)';
  return String(id);
}
function fieldTypeWord(t) { return String(t || 'text'); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function localView(d) {
  if (!d) return null;
  const docs = (d.documents || []).map((entry) => {
    const id = docIdOf(entry);
    const label = entry.reuse ? builtinLabel(id) : (entry.label || id);
    let fields = [];
    if (entry.reuse) {
      fields = [];
    } else {
      fields = (entry.fields || []).map((f) => (f.label || f.key) + ' (' + fieldTypeWord(f.type) + (f.required ? ', required' : '') + ')');
    }
    return { id, label, reused: !!entry.reuse, fields };
  });
  function docName(id) {
    const found = (d.documents || []).find((e) => docIdOf(e) === id);
    if (!found) return String(id);
    return found.reuse ? builtinLabel(id) : (found.label || id);
  }
  function fieldName(docId, key) {
    const found = (d.documents || []).find((e) => docIdOf(e) === docId);
    if (found && !found.reuse) {
      const f = (found.fields || []).find((x) => x.key === key);
      if (f && f.label) return f.label;
    }
    return String(key).replace(/_/g, ' ');
  }
  const checks = (d.checks || []).map((c) => {
    if (!c || typeof c !== 'object') return 'Check this document.';
    const srcDoc = docName(c.document);
    const srcField = fieldName(c.document, c.field);
    const ct = String(c.compare_to || '');
    if (c.rule === 'filipino_name') {
      if (ct === 'profile.full_name') return srcField + ' on ' + srcDoc + ' matches your profile name.';
      const dot = ct.indexOf('.');
      if (dot > 0) return srcField + ' on ' + srcDoc + ' matches the name on ' + docName(ct.slice(0, dot)) + '.';
      return srcField + ' on ' + srcDoc + ' matches across documents.';
    }
    if (c.rule === 'same_date') {
      if (ct === 'profile.date_of_birth') return srcField + ' on ' + srcDoc + ' matches your profile birth date.';
      const dot = ct.indexOf('.');
      if (dot > 0) return srcField + ' on ' + srcDoc + ' matches the date on ' + docName(ct.slice(0, dot)) + '.';
      return srcField + ' on ' + srcDoc + ' matches across documents.';
    }
    if (c.rule === 'equals') return srcField + ' must equal "' + c.value + '".';
    if (c.rule === 'contains') return srcField + ' must contain "' + c.value + '".';
    if (c.rule === 'not_future') return srcField + ' must not be in the future.';
    if (c.rule === 'within_months') return srcField + ' must be within the last ' + c.months + ' month' + (c.months === 1 ? '' : 's') + '.';
    return srcField + ' on ' + srcDoc + ' is checked.';
  });
  let requirement = null;
  if (d.requirement) {
    const r = d.requirement;
    requirement = 'First check ' + String(r.field || 'value').replace(/_/g, ' ') + ' on ' + docName(r.document) + ' (' + r.op + ' "' + r.value + '"): ' + r.message;
  }
  return { title: d.label || 'New process', documents: docs, checks, requirement };
}
function removeField(draft, docIdx, key) {
  const d = clone(draft);
  const entry = d.documents[docIdx];
  const id = docIdOf(entry);
  if (entry && !entry.reuse) entry.fields = (entry.fields || []).filter((f) => f.key !== key);
  d.checks = (d.checks || []).filter((c) => !((c.document === id && c.field === key) || String(c.compare_to || '') === id + '.' + key));
  if (d.requirement && d.requirement.document === id && d.requirement.field === key) delete d.requirement;
  return d;
}
function removeCheck(draft, idx) {
  const d = clone(draft);
  d.checks = (d.checks || []).filter((_, i) => i !== idx);
  return d;
}
export default function SetupClient() {
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  function setLabel(v) { const d = clone(draft); d.label = v; setDraft(d); }
  function setDocLabel(i, v) { const d = clone(draft); if (!d.documents[i].reuse) d.documents[i].label = v; setDraft(d); }
  function setFieldLabel(i, k, v) { const d = clone(draft); const f = (d.documents[i].fields || []).find((x) => x.key === k); if (f) f.label = v; setDraft(d); }
  function setCheckValue(i, v) { const d = clone(draft); if (d.checks[i]) d.checks[i].value = v; setDraft(d); }
  function setCheckMonths(i, v) { const d = clone(draft); if (d.checks[i]) d.checks[i].months = Number(v); setDraft(d); }
  function setReqMessage(v) { const d = clone(draft); if (d.requirement) d.requirement.message = v; setDraft(d); }
  async function build() {
    setBusy(true); setMsg('Building your checklist...');
    try {
      await fetch('/api/session', { method: 'POST' });
      const r = await fetch('/api/setup/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description }) });
      const j = await r.json();
      if (Array.isArray(j.attempts)) setAttempts(j.attempts);
      if (!r.ok) { setMsg(j.error || 'Could not build. Please try again.'); setBusy(false); return; }
      setDraft(j.draft); setMsg('');
    } catch { setMsg('Could not build. Please try again.'); }
    setBusy(false);
  }
  async function confirm() {
    setBusy(true); setMsg('Saving...');
    try {
      const r = await fetch('/api/setup/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, attempts }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || 'Could not save. Please try again.'); setBusy(false); return; }
      window.location.href = '/start';
    } catch { setMsg('Could not save. Please try again.'); setBusy(false); }
  }
  const view = localView(draft);
  return (
    <main className="start-page">
      <h1>Set up your own check</h1>
      <p>Describe what you need, in plain words. Suri builds the checklist. You confirm it.</p>
      <label>Describe your check<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={EXAMPLE} rows={5} style={Object.assign({}, INP, { minHeight: 120 })} /></label>
      <button type="button" onClick={build} disabled={busy} style={BTN}>Build my check</button>
      {msg && <p>{msg}</p>}
      {attempts.length > 0 && (
        <div style={CARD}>
          <strong>Suri&apos;s work log</strong>
          <ul>{attempts.map((a, i) => (<li key={i}>Try {a.n}: {a.result === 'ok' ? 'checklist ready' : 'did not pass validation'}</li>))}</ul>
        </div>
      )}
      {draft && (
        <div>
          <h2>Your checklist</h2>
          <label>Check name<input value={draft.label || ''} onChange={(e) => setLabel(e.target.value)} style={INP} /></label>
          {(draft.documents || []).map((entry, di) => {
            const id = docIdOf(entry);
            if (entry.reuse) {
              return (<div key={id} style={CARD}><strong>{builtinLabel(id)}</strong><p><small>Reused as-is.</small></p></div>);
            }
            return (
              <div key={id} style={CARD}>
                <label>Document name<input value={entry.label || ''} onChange={(e) => setDocLabel(di, e.target.value)} style={INP} /></label>
                {(entry.fields || []).map((f) => (
                  <div key={f.key} style={{ marginTop: 8 }}>
                    <label>{f.key} ({fieldTypeWord(f.type)}{f.required ? ', required' : ''})<input value={f.label || ''} onChange={(e) => setFieldLabel(di, f.key, e.target.value)} style={INP} /></label>
                    <button type="button" onClick={() => setDraft(removeField(draft, di, f.key))} style={{ minHeight: 44, fontSize: 16, marginTop: 4 }}>Remove this field</button>
                  </div>
                ))}
              </div>
            );
          })}
          <h3>Checks</h3>
          {(draft.checks || []).map((c, ci) => (
            <div key={ci} style={CARD}>
              <p>{view && view.checks && view.checks[ci] ? view.checks[ci] : 'Check this document.'}</p>
              {(c.rule === 'equals' || c.rule === 'contains') && (<label>Value<input value={c.value || ''} onChange={(e) => setCheckValue(ci, e.target.value)} style={INP} /></label>)}
              {c.rule === 'within_months' && (<label>Months<input type="number" min={1} max={24} value={c.months || ''} onChange={(e) => setCheckMonths(ci, e.target.value)} style={INP} /></label>)}
              <p><small>{String(c.message || '')}</small></p>
              <button type="button" onClick={() => setDraft(removeCheck(draft, ci))} style={{ minHeight: 44, fontSize: 16, marginTop: 4 }}>Remove this check</button>
            </div>
          ))}
          {draft.requirement && (
            <div style={CARD}>
              <p><strong>First gate:</strong> {String(draft.requirement.field).replace(/_/g, ' ')} on {draft.requirement.document} {draft.requirement.op} &quot;{draft.requirement.value}&quot;.</p>
              <label>Gate message<input value={draft.requirement.message || ''} onChange={(e) => setReqMessage(e.target.value)} style={INP} /></label>
            </div>
          )}
          <button type="button" onClick={confirm} disabled={busy} style={BTN}>Confirm and save</button>
        </div>
      )}
      <p><small>Sample documents only. Never upload a real ID.</small></p>
    </main>
  );
}