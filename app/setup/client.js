// app/setup/client.js
// Step 7c Part 3: describe -> confirm. No add-block UI, draft in state only.
// Phone-first like /start. Server re-validates on Confirm.
'use client';
import { useEffect, useRef, useState } from 'react';
import SuriHeader from '../components/SuriHeader.js';
import '../flow-polish.css';
const MAX_DESC = 1000;
const MAX_ANSWER = 500;
const EXAMPLE = 'Barangay clearance: valid ID + proof of billing. Names match. Address in Barangay Baybayin. Bill from the last 3 months.';
function docIdOf(e) { return (e && (e.reuse || e.id)) || ''; }
function builtinLabel(id) {
  if (id === 'valid_id') return 'Valid ID';
  if (id === 'birth_certificate') return 'Birth certificate';
  if (id === 'report_card') return 'Report card';
  if (id === 'official_receipt') return 'Official receipt';
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
    if (c.rule === 'age_limit') {
      const hasMin = Number.isInteger(c.min_age);
      const hasMax = Number.isInteger(c.max_age);
      if (hasMin && hasMax) return srcField + ' on ' + srcDoc + ' must be between ' + c.min_age + ' and ' + c.max_age + ' years old.';
      if (hasMin) return srcField + ' on ' + srcDoc + ' must be at least ' + c.min_age + ' years old.';
      if (hasMax) return srcField + ' on ' + srcDoc + ' must be at most ' + c.max_age + ' years old.';
      return srcField + ' on ' + srcDoc + ' is checked.';
    }
    return srcField + ' on ' + srcDoc + ' is checked.';
  });
  let requirement = null;
  if (d.requirement) {
    const r = d.requirement;
    requirement = 'First check ' + String(r.field || 'value').replace(/_/g, ' ') + ' on ' + docName(r.document) + ' (' + r.op + ' "' + r.value + '"): ' + r.message;
  }
  const not_checked = Array.isArray(d.not_checked) ? d.not_checked.slice(0, 5) : [];
  return { title: d.label || 'New process', documents: docs, checks, requirement, not_checked };
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
  const [needsMoreInfo, setNeedsMoreInfo] = useState('');
  const [attempts, setAttempts] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [moreAnswer, setMoreAnswer] = useState('');
  const [lastDraftDesc, setLastDraftDesc] = useState('');
  const answerRef = useRef(null);
  function setLabel(v) { const d = clone(draft); d.label = v; setDraft(d); }
  function setDocLabel(i, v) { const d = clone(draft); if (!d.documents[i].reuse) d.documents[i].label = v; setDraft(d); }
  function setFieldLabel(i, k, v) { const d = clone(draft); const f = (d.documents[i].fields || []).find((x) => x.key === k); if (f) f.label = v; setDraft(d); }
  function setCheckValue(i, v) { const d = clone(draft); if (d.checks[i]) d.checks[i].value = v; setDraft(d); }
  function setCheckMonths(i, v) { const d = clone(draft); if (d.checks[i]) d.checks[i].months = Number(v); setDraft(d); }
  function setReqMessage(v) { const d = clone(draft); if (d.requirement) d.requirement.message = v; setDraft(d); }
  async function build(descOverride) {
    const descToUse = typeof descOverride === 'string' ? descOverride : description;
    setBusy(true); setMsg('Building your checklist...');
    try {
      await fetch('/api/session', { method: 'POST' });
      const r = await fetch('/api/setup/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: descToUse }) });
      const j = await r.json();
      if (Array.isArray(j.attempts)) setAttempts(j.attempts);
      if (j.needs_more_info) { setNeedsMoreInfo(String(j.needs_more_info)); setDraft(null); setLastDraftDesc(descToUse); setMsg(''); setBusy(false); return; }
      if (!r.ok) { setNeedsMoreInfo(''); setMsg(j.error || 'Could not build. Please try again.'); setBusy(false); return; }
      setNeedsMoreInfo(''); setDraft(j.draft); setLastDraftDesc(descToUse); setMsg('');
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
  const hasDraft = !!draft && !needsMoreInfo;
  useEffect(() => {
    if (needsMoreInfo && answerRef.current) {
      answerRef.current.focus();
    }
  }, [needsMoreInfo]);
  function fieldLabelFallback(key) {
    const s = String(key || 'value').replace(/_/g, ' ').trim() || 'value';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return (
    <div className="checklist-page setup-page">
      <SuriHeader />
      <div className="setup-intro">
        <h1 className="checklist-h1">Set up your own check</h1>
        <p className="checklist-subtitle">Describe what you need, in plain words. Suri builds the checklist. You confirm it.</p>
      </div>
      <div className="landing-section-head">
        <span className="landing-section-title">01 — describe your check</span>
      </div>
      <label className="profile-label">
        <span className="mono profile-label-text">What do you want to check?</span>
        <textarea className="setup-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={EXAMPLE} rows={4} maxLength={MAX_DESC} />
        <span className={'mono setup-count' + (description.length > MAX_DESC - 100 ? ' setup-count--near' : '')}>{description.length} / {MAX_DESC}</span>
        <span className="mono setup-hint">Example: {EXAMPLE}</span>
        <span className="mono setup-hint">Keep it short. A check can have up to 4 documents and 20 rules.</span>
      </label>
      {(!draft && !needsMoreInfo && !lastDraftDesc) ? (
        <>
          <button type="button" onClick={() => build()} disabled={busy} className="checklist-btn-primary" style={{ width: '100%', marginTop: 12 }}>
            Draft my checklist
          </button>
          <p className="mono" style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: 8 }}>Suri drafts it first. Nothing is saved until you say so.</p>
        </>
      ) : (draft || needsMoreInfo) ? (
        description !== lastDraftDesc ? (
          <button type="button" onClick={() => build()} disabled={busy} className="checklist-btn-secondary" style={{ width: '100%', marginTop: 12 }}>
            Draft again with the new text
          </button>
        ) : null
      ) : null}
      {msg && <p className="checklist-msg">{msg}</p>}
      {attempts.length > 0 && (
        <div className="setup-log">
          <div className="setup-log-title">Suri&apos;s work log</div>
          <ul className="checklist-log-list">
            {attempts.map((a, i) => {
              const dotColor = a.result === 'ok' ? 'var(--match)' : a.result === 'needs_more_info' ? 'var(--check)' : 'var(--mismatch)';
              const label = a.result === 'ok' ? 'checklist ready' : a.result === 'needs_more_info' ? 'asked for more detail' : 'did not pass validation';
              return (
                <li key={i} className="checklist-log-row">
                  <span className="checklist-log-dot" style={{ background: dotColor }} />
                  <span className="checklist-log-text">Try {a.n}: {label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {needsMoreInfo && (
        <div className="setup-needs-more">
          <span className="mono setup-needs-label">Suri needs more detail</span>
          <p className="setup-needs-text">{needsMoreInfo}</p>
          <p className="setup-needs-hint">Try: which documents, which fields, what to check.</p>
          <label className="profile-label" style={{ marginTop: 12 }}>
            <span className="mono profile-label-text">Your answer</span>
            <textarea ref={answerRef} className="setup-textarea" value={moreAnswer} onChange={(e) => setMoreAnswer(e.target.value)} rows={3} maxLength={MAX_ANSWER} />
          </label>
          <button type="button" onClick={async () => { const a = moreAnswer.trim(); if (!a) return; const next = description ? description + "\n\n" + a : a; setDescription(next); await build(next); }} disabled={busy} className="checklist-btn-primary" style={{ width: '100%', marginTop: 8 }}>
            Answer and rebuild
          </button>
        </div>
      )}
      {draft && !needsMoreInfo && (
        <div>
          <div className="landing-section-head" style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="landing-section-title">02 — your checklist</span>
            <span className="mono" style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--check)', border: '1px solid var(--check)', borderRadius: '4px', padding: '2px 6px' }}>DRAFT · NOT SAVED YET</span>
          </div>
          <label className="profile-label">
            <span className="mono profile-label-text">Check name</span>
            <input className="profile-input" value={draft.label || ''} onChange={(e) => setLabel(e.target.value)} />
          </label>
          {(draft.documents || []).map((entry, di) => {
            const id = docIdOf(entry);
            if (entry.reuse) {
              return (
                <div key={id} className="setup-doc-card">
                  <div className="setup-doc-title">{builtinLabel(id)}</div>
                  <span className="mono setup-reused">Reused as-is.</span>
                </div>
              );
            }
            return (
              <div key={id} className="setup-doc-card">
                <label className="profile-label">
                  <span className="mono profile-label-text">Document name</span>
                  <input className="profile-input" value={entry.label || ''} onChange={(e) => setDocLabel(di, e.target.value)} />
                </label>
                {(entry.fields || []).map((f) => (
                  <div key={f.key} className="setup-field-row">
                    <label className="profile-label">
                      <span className="setup-field-label">
                        {f.label || fieldLabelFallback(f.key)} <span className="mono setup-field-meta">· {fieldTypeWord(f.type)} · {f.required ? 'required' : 'optional'}</span>
                      </span>
                      <input className="profile-input" value={f.label || ''} onChange={(e) => setFieldLabel(di, f.key, e.target.value)} placeholder={fieldLabelFallback(f.key)} />
                    </label>
                    <button type="button" onClick={() => setDraft(removeField(draft, di, f.key))} className="mono setup-text-btn">
                      Remove this field
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="landing-section-head">
            <span className="landing-section-title">03 — checks</span>
          </div>
          {(draft.checks || []).map((c, ci) => (
            <div key={ci} className="setup-check-card">
              <span className="mono setup-check-label">Check 0{ci + 1}</span>
              <p className="setup-check-text">{view && view.checks && view.checks[ci] ? view.checks[ci] : 'Check this document.'}</p>
              {(c.rule === 'equals' || c.rule === 'contains') && (
                <label className="profile-label">
                  <span className="mono profile-label-text">Value</span>
                  <input className="profile-input" value={c.value || ''} onChange={(e) => setCheckValue(ci, e.target.value)} />
                </label>
              )}
              {c.rule === 'within_months' && (
                <label className="profile-label">
                  <span className="mono profile-label-text">Months</span>
                  <input className="profile-input" type="number" min={1} max={24} value={c.months || ''} onChange={(e) => setCheckMonths(ci, e.target.value)} />
                </label>
              )}
              {c.message && <p className="checklist-foot">{String(c.message || '')}</p>}
              <button type="button" onClick={() => setDraft(removeCheck(draft, ci))} className="mono setup-text-btn">
                Remove this check
              </button>
            </div>
          ))}
          {draft.requirement && (
            <div className="setup-requirement-card">
              <span className="mono setup-check-label">First gate</span>
              <p className="setup-check-text">
                {String(draft.requirement.field).replace(/_/g, ' ')} on {draft.requirement.document} {draft.requirement.op} &quot;{draft.requirement.value}&quot;.
              </p>
              <label className="profile-label">
                <span className="mono profile-label-text">Gate message</span>
                <input className="profile-input" value={draft.requirement.message || ''} onChange={(e) => setReqMessage(e.target.value)} />
              </label>
            </div>
          )}
          {(draft.not_checked || []).length > 0 && (
            <div className="setup-not-checked">
              <p className="setup-not-checked-title">Suri can&apos;t check these yet — a person will need to:</p>
              <ul className="setup-not-checked-list">
                {(draft.not_checked || []).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mono" style={{ color: 'var(--text-2)', fontSize: '12px', marginTop: 12 }}>Looks right? Save it so you can start it from Your checks.</p>
          <button type="button" onClick={confirm} disabled={busy} className="checklist-btn-primary" style={{ width: '100%', marginTop: 8 }}>
            Save to Your checks
          </button>
        </div>
      )}
      <p className="checklist-foot" style={{ marginTop: 16 }}>
        Sample documents only. Never upload a real ID.
      </p>
    </div>
  );
}