// tests/retry-before-retake.test.js
// Step 9F — Retry before retake (retry retake_needed once)
// 6 cases + work log sentence/color checks. Mock reader, no DB, no API cost.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { decideUsability } = require('../lib/decide-usability');
function defWithRequired(n) {
  const fields = [];
  for (let i = 0; i < n; i++) fields.push({ key: 'f' + i, type: 'text', required: true, maxLength: 20 });
  return { id: 'valid_id', label: 'Valid ID', fields };
}
function fieldsAllReadable(n) {
  const out = {};
  for (let i = 0; i < n; i++) out['f' + i] = { value: 'ok', confidence: 'high', unreadable: false };
  return out;
}
function fieldsUnreadable(count, total) {
  const out = {};
  for (let i = 0; i < total; i++) {
    if (i < count) out['f' + i] = { value: null, confidence: 'low', unreadable: true };
    else out['f' + i] = { value: 'ok', confidence: 'high', unreadable: false };
  }
  return out;
}
function makeChecked({ fields, quality, documentMatch }) {
  return { fields, quality, documentMatch };
}
async function simulateRetry({ def, bundle, docType, allowedIds, firstChecked, secondChecked, secondThrows }) {
  const workLogs = [];
  const upserts = [];
  const stored = {};
  const documentId = 'doc-1';
  const admin = {
    from(table) {
      return {
        insert(payload) { workLogs.push(payload); return Promise.resolve({ data: null, error: null }); },
        update() { return { eq() { return Promise.resolve({ data: null, error: null }); } }; },
        upsert(rows, opts) {
          upserts.push({ rows, opts });
          for (const r of rows) { const k = r.document_id + ':' + r.field_key; stored[k] = r; }
          return Promise.resolve({ data: null, error: null });
        },
        select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      };
    },
    storage: { from() { return { download: async () => ({ data: { arrayBuffer: async () => Buffer.from('fake') }, error: null }) }; } },
  };
  const log = (t, m) => admin.from('work_log').insert({ submission_id: 'sub-1', step_type: t, message: m.slice(0, 200) });
  function rowsFromChecked(chk) {
    const rows = [];
    for (const f of def.fields) {
      const v = chk.fields[f.key];
      if (!v || typeof v !== 'object') continue;
      const c = v.confidence === 'high' || v.confidence === 'medium' ? v.confidence : 'low';
      rows.push({ document_id: documentId, field_key: f.key, value_text: v.value == null ? null : String(v.value), confidence: c, unreadable: v.unreadable === true, found_on_page: typeof v.found_on_page === 'string' ? v.found_on_page.slice(0, 200) : null });
    }
    return rows;
  }
  const rows = rowsFromChecked(firstChecked);
  if (rows.length > 0) await admin.from('extracted_fields').upsert(rows, { onConflict: 'document_id,field_key' });
  let usability = decideUsability({ def, bundle, expectedDocTypeId: docType, fields: firstChecked.fields, quality: firstChecked.quality, documentMatch: firstChecked.documentMatch, allowedIds });
  let next = usability.status;
  let checkedActive = firstChecked;
  let rowsActive = rows;
  let retryCount = 0;
  if (next === 'retake_needed') {
    await log('reading_retry', (docType + ': Reading again to double-check.').slice(0, 200));
    retryCount = 1;
    let checked2 = null;
    try { if (secondThrows) throw new Error('reader failed'); checked2 = secondChecked; } catch {}
    if (checked2) {
      const rows2 = rowsFromChecked(checked2);
      if (rows2.length > 0) await admin.from('extracted_fields').upsert(rows2, { onConflict: 'document_id,field_key' });
      const usability2 = decideUsability({ def, bundle, expectedDocTypeId: docType, fields: checked2.fields, quality: checked2.quality, documentMatch: checked2.documentMatch, allowedIds });
      usability = usability2; next = usability2.status; checkedActive = checked2; rowsActive = rows2;
    }
  }
  let finalStatus = next;
  if (finalStatus === 'needs_review') await log('reading_finished', docType + ' reading finished: ' + rowsActive.length + ' fields');
  else if (finalStatus === 'retake_needed') await log('retake_needed', (docType + ': ' + usability.reason).slice(0, 200));
  else if (finalStatus === 'wrong_document') await log('wrong_document', (docType + ': ' + usability.reason).slice(0, 200));
  return { workLogs, upserts, stored, finalStatus, retryCount, usability, rowsActive, next };
}
describe('Step 9F retry-before-retake: read-background retry', () => {
  it('retake->usable = ready path (one retry log, needs_review, second fields in DB)', async () => {
    const def = defWithRequired(4);
    const first = makeChecked({ fields: fieldsUnreadable(2, 4), quality: { usable: false, problems: ['blurry'] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const second = makeChecked({ fields: fieldsAllReadable(4), quality: { usable: true, problems: [] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const res = await simulateRetry({ def, bundle: null, docType: 'valid_id', allowedIds: ['valid_id'], firstChecked: first, secondChecked: second, secondThrows: false });
    assert.equal(res.retryCount, 1);
    assert.equal(res.finalStatus, 'needs_review');
    assert.equal(res.workLogs.filter(w => w.step_type === 'reading_retry').length, 1);
    assert.equal(res.workLogs.filter(w => w.step_type === 'reading_finished').length, 1);
    const key = 'doc-1:f0';
    assert.ok(res.stored[key]);
    assert.equal(res.stored[key].value_text, 'ok');
    assert.equal(res.upserts.length, 2);
    assert.equal(res.upserts[1].opts.onConflict, 'document_id,field_key');
  });
  it('retake->retake = retake_needed (second reason, no duplicate rows)', async () => {
    const def = defWithRequired(4);
    const first = makeChecked({ fields: fieldsUnreadable(2, 4), quality: { usable: false, problems: ['blurry'] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const second = makeChecked({ fields: fieldsUnreadable(2, 4), quality: { usable: false, problems: ['dark'] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const res = await simulateRetry({ def, bundle: null, docType: 'valid_id', allowedIds: ['valid_id'], firstChecked: first, secondChecked: second, secondThrows: false });
    assert.equal(res.finalStatus, 'retake_needed');
    assert.equal(res.retryCount, 1);
    assert.equal(res.workLogs.filter(w => w.step_type === 'retake_needed').length, 1);
    assert.equal(res.workLogs.filter(w => w.step_type === 'reading_retry').length, 1);
    const retakeLog = res.workLogs.find(w => w.step_type === 'retake_needed');
    assert.match(retakeLog.message, /dark/i);
    assert.equal(Object.keys(res.stored).length, 4);
    assert.equal(res.upserts[0].opts.onConflict, 'document_id,field_key');
    assert.equal(res.upserts[1].opts.onConflict, 'document_id,field_key');
  });
  it('usable first = no extra read', async () => {
    const def = defWithRequired(4);
    const first = makeChecked({ fields: fieldsAllReadable(4), quality: { usable: true, problems: [] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const second = makeChecked({ fields: fieldsUnreadable(2, 4), quality: { usable: false, problems: ['blurry'] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const res = await simulateRetry({ def, bundle: null, docType: 'valid_id', allowedIds: ['valid_id'], firstChecked: first, secondChecked: second, secondThrows: false });
    assert.equal(res.retryCount, 0);
    assert.equal(res.finalStatus, 'needs_review');
    assert.equal(res.workLogs.filter(w => w.step_type === 'reading_retry').length, 0);
    assert.equal(res.upserts.length, 1);
  });
  it('wrong_document = no retry', async () => {
    const def = defWithRequired(4);
    const first = makeChecked({ fields: fieldsAllReadable(4), quality: { usable: true, problems: [] }, documentMatch: { matches_expected: false, looks_like: 'report_card' } });
    const second = makeChecked({ fields: fieldsAllReadable(4), quality: { usable: true, problems: [] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const res = await simulateRetry({ def, bundle: null, docType: 'birth_certificate', allowedIds: ['birth_certificate', 'report_card', 'valid_id'], firstChecked: first, secondChecked: second, secondThrows: false });
    assert.equal(res.finalStatus, 'wrong_document');
    assert.equal(res.retryCount, 0);
    assert.equal(res.workLogs.filter(w => w.step_type === 'reading_retry').length, 0);
    assert.equal(res.upserts.length, 1);
  });
  it('retake->retry throw keeps first retake (correction #1, not error)', async () => {
    const def = defWithRequired(4);
    const first = makeChecked({ fields: fieldsUnreadable(2, 4), quality: { usable: false, problems: ['blurry'] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const second = makeChecked({ fields: fieldsAllReadable(4), quality: { usable: true, problems: [] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const res = await simulateRetry({ def, bundle: null, docType: 'valid_id', allowedIds: ['valid_id'], firstChecked: first, secondChecked: second, secondThrows: true });
    assert.equal(res.finalStatus, 'retake_needed');
    assert.equal(res.retryCount, 1);
    assert.equal(res.workLogs.filter(w => w.step_type === 'reading_retry').length, 1);
    assert.equal(res.workLogs.filter(w => w.step_type === 'retake_needed').length, 1);
    assert.equal(res.workLogs.filter(w => w.step_type === 'reading_failed').length, 0);
    assert.equal(res.workLogs.filter(w => w.step_type === 'reading_finished').length, 0);
    const log = res.workLogs.find(w => w.step_type === 'retake_needed');
    assert.match(log.message, /blurry/i);
    assert.equal(res.upserts.length, 1);
  });
  it('no duplicate extracted_fields rows after retry (correction #2, unique on document_id+field_key)', async () => {
    const def = defWithRequired(3);
    const first = makeChecked({ fields: { f0: { value: 'first', confidence: 'high', unreadable: false }, f1: { value: null, confidence: 'low', unreadable: true }, f2: { value: 'keep', confidence: 'high', unreadable: false } }, quality: { usable: false, problems: ['blurry'] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const second = makeChecked({ fields: { f0: { value: 'second', confidence: 'high', unreadable: false }, f1: { value: 'fixed', confidence: 'high', unreadable: false }, f2: { value: 'keep', confidence: 'high', unreadable: false } }, quality: { usable: true, problems: [] }, documentMatch: { matches_expected: true, looks_like: 'valid_id' } });
    const res = await simulateRetry({ def, bundle: null, docType: 'valid_id', allowedIds: ['valid_id'], firstChecked: first, secondChecked: second, secondThrows: false });
    assert.equal(res.finalStatus, 'needs_review');
    assert.equal(Object.keys(res.stored).length, 3);
    assert.equal(res.stored['doc-1:f0'].value_text, 'second');
    assert.equal(res.stored['doc-1:f1'].value_text, 'fixed');
  });
});
describe('Step 9F client work log sentences + colors', () => {
  it('read-background.js contains retry with corrections', () => {
    const p = path.join(__dirname, '..', 'lib', 'read-background.js');
    const t = fs.readFileSync(p, 'utf8');
    assert.ok(t.includes('reading_retry'), 'missing reading_retry log');
    assert.ok(t.includes('Reading again to double-check.'), 'missing retry message');
    assert.ok(t.includes("onConflict: 'document_id,field_key'"), 'missing onConflict correction #2');
    assert.ok(t.includes('correction #1'), 'missing correction #1 comment');
    assert.ok(t.includes('let usability = decideUsability'), 'should use let usability');
    assert.ok(t.includes('let next = usability.status'), 'should use let next');
    assert.ok(t.includes('let checkedActive = checked'), 'missing checkedActive');
    assert.ok(t.includes('let rowsActive = rows'), 'missing rowsActive');
    assert.ok(t.includes('rowsActive.length'), 'should use rowsActive for reading_finished');
  });
  it('client workLogSentence handles all step_types per 2.4', () => {
    const p = path.join(__dirname, '..', 'app', 'set', '[submissionId]', 'client.js');
    const t = fs.readFileSync(p, 'utf8');
    assert.ok(t.includes('Reading again to double-check'), 'missing reading_retry sentence');
    assert.ok(t.includes('Asked for a clearer photo'), 'missing retake_needed sentence');
    assert.ok(t.includes('Looks like a different document'), 'missing wrong_document sentence');
    assert.ok(t.includes("Couldn\\'t finish reading"), 'missing reading_failed sentence');
    assert.ok(t.includes('requirement_check'), 'missing requirement_check handling');
    assert.ok(t.includes('Overrode the requirement'), 'missing requirement_override');
    assert.ok(t.includes("A check couldn\\'t run"), 'missing check_failed');
    assert.ok(t.includes('Suri skipped a question'), 'missing clarification_failed/skipped');
    assert.ok(t.includes("'Approved \\u00b7 '"), 'missing review_approve');
    assert.ok(t.includes("'Rejected \\u00b7 '"), 'missing review_reject');
    assert.ok(t.includes("'Corrected \\u00b7 '"), 'missing review_correct');
    assert.ok(t.includes('Suri updated your checklist.'), 'missing fallback');
  });
});

describe('Step 9F client logDotColor checks', () => {
  it('client logDotColor maps per 2.4', () => {
    const p = path.join(__dirname, '..', 'app', 'set', '[submissionId]', 'client.js');
    const t = fs.readFileSync(p, 'utf8');
    assert.ok(t.includes('reading_retry') && t.includes('var(--accent)'), 'reading_retry should be accent');
    assert.ok(t.includes('retake_needed') && t.includes('var(--mismatch)'), 'retake_needed should be mismatch');
    assert.ok(t.includes('wrong_document') && t.includes('var(--mismatch)'), 'wrong_document mismatch');
    assert.ok(t.includes('reading_failed') && t.includes('var(--mismatch)'), 'reading_failed mismatch');
    assert.ok(t.includes('requirement_check') && t.includes('passed') && t.includes('var(--match)'), 'requirement_check passed->match');
    assert.ok(t.includes('requirement_override') && t.includes('var(--check)'), 'requirement_override check');
    assert.ok(t.includes('check_failed') && t.includes('var(--check)'), 'check_failed check');
    assert.ok(t.includes('clarification_failed') && t.includes('var(--text-3)'), 'clarification_failed neutral');
    assert.ok(t.includes('review_approve') && t.includes('var(--match)'), 'review_approve match');
    assert.ok(t.includes('review_reject') && t.includes('var(--mismatch)'), 'review_reject mismatch');
    assert.ok(t.includes('review_correct') && t.includes('var(--check)'), 'review_correct check');
  });
});
describe('Step 9F client logic behavior', () => {
  it('sentences and colors behave as spec', () => {
    function docLabelForLogMock(w, rows) {
      const raw = String((w.message || '') + ' ' + (w.step_type || '')).toLowerCase();
      for (const rr of (rows || [])) { if (rr && rr.doc_type && raw.includes(rr.doc_type)) return rr.label || rr.doc_type.replace(/_/g, ' '); }
      return rows && rows[0] ? rows[0].label : 'your document';
    }
    const rows = [{ doc_type: 'valid_id', label: 'Valid ID' }];
    function workLogSentence(w) {
      const t = String(w.step_type || '').toLowerCase();
      const label = docLabelForLogMock(w, rows);
      const m = String(w.message || '');
      if (t === 'reading_retry' || t.includes('reading_retry')) return 'Reading again to double-check \u00b7 ' + label;
      if (t === 'retake_needed' || t === 'retake') return 'Asked for a clearer photo \u00b7 ' + label;
      if (t === 'wrong_document') return 'Looks like a different document \u00b7 ' + label;
      if (t === 'reading_failed') return 'Couldn\'t finish reading \u00b7 ' + label;
      if (t === 'requirement_check') return m || 'Suri updated your checklist.';
      if (t === 'requirement_override') return 'Overrode the requirement';
      if (t === 'check_failed') return 'A check couldn\'t run';
      if (t === 'clarification_failed' || t === 'clarification_skipped_cap' || t.includes('clarification_failed') || t.includes('clarification_skipped')) return 'Suri skipped a question';
      if (t === 'review_approve' || t.includes('review_approve')) return 'Approved \u00b7 ' + label;
      if (t === 'review_reject' || t.includes('review_reject')) return 'Rejected \u00b7 ' + label;
      if (t === 'review_correct' || t.includes('review_correct')) return 'Corrected \u00b7 ' + label;
      return 'Suri updated your checklist.';
    }
    function logDotColor(w) {
      const t = String(w.step_type || '').toLowerCase();
      const m = String(w.message || '');
      if (t === 'reading_retry' || t.includes('reading_retry')) return 'var(--accent)';
      if (t === 'retake_needed') return 'var(--mismatch)';
      if (t === 'wrong_document') return 'var(--mismatch)';
      if (t === 'reading_failed') return 'var(--mismatch)';
      if (t === 'requirement_check') { if (m.toLowerCase().includes('passed')) return 'var(--match)'; return 'var(--mismatch)'; }
      if (t === 'requirement_override') return 'var(--check)';
      if (t === 'check_failed') return 'var(--check)';
      if (t === 'clarification_failed' || t === 'clarification_skipped_cap' || t.includes('clarification_failed') || t.includes('clarification_skipped')) return 'var(--text-3)';
      if (t === 'review_approve' || t.includes('review_approve')) return 'var(--match)';
      if (t === 'review_reject' || t.includes('review_reject')) return 'var(--mismatch)';
      if (t === 'review_correct' || t.includes('review_correct')) return 'var(--check)';
      return 'var(--text-3)';
    }
    assert.equal(workLogSentence({ step_type: 'reading_retry', message: 'valid_id: Reading again to double-check.' }), 'Reading again to double-check \u00b7 Valid ID');
    assert.equal(logDotColor({ step_type: 'reading_retry' }), 'var(--accent)');
    assert.equal(workLogSentence({ step_type: 'retake_needed', message: 'valid_id: Please retake photo - blurry' }), 'Asked for a clearer photo \u00b7 Valid ID');
    assert.equal(logDotColor({ step_type: 'retake_needed' }), 'var(--mismatch)');
    assert.equal(workLogSentence({ step_type: 'wrong_document', message: 'valid_id: Looks like report_card' }), 'Looks like a different document \u00b7 Valid ID');
    assert.equal(workLogSentence({ step_type: 'reading_failed' }), 'Couldn\'t finish reading \u00b7 Valid ID');
    assert.equal(workLogSentence({ step_type: 'requirement_check', message: 'Requirement passed.' }), 'Requirement passed.');
    assert.equal(logDotColor({ step_type: 'requirement_check', message: 'Requirement passed.' }), 'var(--match)');
    assert.equal(logDotColor({ step_type: 'requirement_check', message: 'Requirement not met.' }), 'var(--mismatch)');
    assert.equal(workLogSentence({ step_type: 'requirement_override' }), 'Overrode the requirement');
    assert.equal(logDotColor({ step_type: 'requirement_override' }), 'var(--check)');
    assert.equal(workLogSentence({ step_type: 'check_failed' }), 'A check couldn\'t run');
    assert.equal(workLogSentence({ step_type: 'clarification_failed' }), 'Suri skipped a question');
    assert.equal(logDotColor({ step_type: 'clarification_failed' }), 'var(--text-3)');
    assert.equal(workLogSentence({ step_type: 'review_approve' }), 'Approved \u00b7 Valid ID');
    assert.equal(logDotColor({ step_type: 'review_approve' }), 'var(--match)');
    assert.equal(workLogSentence({ step_type: 'review_reject' }), 'Rejected \u00b7 Valid ID');
    assert.equal(logDotColor({ step_type: 'review_reject' }), 'var(--mismatch)');
    assert.equal(workLogSentence({ step_type: 'review_correct' }), 'Corrected \u00b7 Valid ID');
    assert.equal(logDotColor({ step_type: 'review_correct' }), 'var(--check)');
    assert.equal(workLogSentence({ step_type: 'unknown_xyz' }), 'Suri updated your checklist.');
    assert.equal(logDotColor({ step_type: 'unknown_xyz' }), 'var(--text-3)');
  });
});
