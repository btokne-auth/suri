// tests/setup-honesty.test.js
// Step 7d: honesty rule — lenient sanitization, single source honestyCheck.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateDraft, honestyCheck, DEFAULT_NEEDS_MORE_INFO, sanitizeNotChecked, sanitizeNeedsMoreInfo, earlyNeedsMoreInfo } = require('../lib/processes/draft-schema');
const { validateSavedDefinition } = require('../lib/processes/resolve');
function baseDraft(overrides = {}) {
  return { label: 'Test process label', documents: [{ reuse: 'valid_id' }], checks: [], ...overrides };
}
describe('sanitizeNotChecked', () => {
  it('trims, drops empty, cuts to 160, keeps first 5', () => {
    const long = 'a'.repeat(200);
    const input = ['  hello  ', ' ', '', '  ', 'two', 'three', 'four', 'five', 'six', long];
    const out = sanitizeNotChecked(input);
    assert.deepEqual(out.slice(0, 2), ['hello', 'two']);
    assert.equal(out.length, 5);
    assert.equal(out[4], 'five');
    const out2 = sanitizeNotChecked([long, 'b', 'c']);
    assert.equal(out2[0].length, 160);
  });
  it('non-array returns undefined lenient', () => {
    assert.equal(sanitizeNotChecked('not array'), undefined);
    assert.equal(sanitizeNotChecked(null), undefined);
  });
});
describe('sanitizeNeedsMoreInfo', () => {
  it('trims and keeps valid', () => {
    assert.equal(sanitizeNeedsMoreInfo('  Hello world? This is valid.  '), 'Hello world? This is valid.');
  });
  it('longer than 200 cut', () => {
    const long = 'a'.repeat(300);
    const out = sanitizeNeedsMoreInfo(long);
    assert.equal(out.length, 200);
  });
  it('shorter than 10 -> DEFAULT', () => {
    assert.equal(sanitizeNeedsMoreInfo('hi'), DEFAULT_NEEDS_MORE_INFO);
    assert.equal(sanitizeNeedsMoreInfo(''), undefined);
  });
});
describe('validateDraft lenient', () => {
  it('6 items ->5 ok', () => {
    const d = baseDraft({ checks: [{ document: 'valid_id', field: 'full_name', compare_to: 'self', rule: 'contains', value: 'Bay', message: 'Must contain Bay.' }], not_checked: ['a','b','c','d','e','f'] });
    const r = validateDraft(d);
    assert.equal(r.ok, true);
    assert.equal(r.draft.not_checked.length, 5);
  });
  it('200 char ->160 ok', () => {
    const long = 'a'.repeat(200);
    const d = baseDraft({ checks: [{ document: 'valid_id', field: 'full_name', compare_to: 'self', rule: 'contains', value: 'Bay', message: 'Must contain Bay.' }], not_checked: [long] });
    const r = validateDraft(d);
    assert.equal(r.ok, true);
    assert.equal(r.draft.not_checked[0].length, 160);
  });
  it('empty dropped ok', () => {
    const d = baseDraft({ checks: [{ document: 'valid_id', field: 'full_name', compare_to: 'self', rule: 'contains', value: 'Bay', message: 'Must contain Bay.' }], not_checked: ['  ', '', 'valid item', '   '] });
    const r = validateDraft(d);
    assert.equal(r.ok, true);
    assert.deepEqual(r.draft.not_checked, ['valid item']);
  });
  it('needs_more_info 300 ->200 ok', () => {
    const long = 'a'.repeat(300);
    const d = baseDraft({ checks: [{ document: 'valid_id', field: 'full_name', compare_to: 'self', rule: 'contains', value: 'Bay', message: 'Must contain Bay.' }], needs_more_info: long });
    const r = validateDraft(d);
    assert.equal(r.ok, true);
    assert.equal(r.draft.needs_more_info.length, 200);
  });
  it('needs_more_info hi ->DEFAULT ok', () => {
    const d = baseDraft({ checks: [{ document: 'valid_id', field: 'full_name', compare_to: 'self', rule: 'contains', value: 'Bay', message: 'Must contain Bay.' }], needs_more_info: 'hi' });
    const r = validateDraft(d);
    assert.equal(r.ok, true);
    assert.equal(r.draft.needs_more_info, DEFAULT_NEEDS_MORE_INFO);
  });
});
describe('honestyCheck', () => {
  it('0+empty -> needs_more_info model q', () => {
    const d = baseDraft({ checks: [], not_checked: [], needs_more_info: 'Which documents do you need to check please?' });
    const h = honestyCheck(d);
    assert.ok(h && h.needs_more_info === 'Which documents do you need to check please?');
  });
  it('0+empty missing -> DEFAULT', () => {
    const d = baseDraft({ checks: [], not_checked: [] });
    const h = honestyCheck(d);
    assert.equal(h.needs_more_info, DEFAULT_NEEDS_MORE_INFO);
  });
  it('0+non-empty -> null allowed', () => {
    const d = baseDraft({ checks: [], not_checked: ['Applicant is at least 18 — check ID birth date by hand.'] });
    assert.equal(honestyCheck(d), null);
  });
  it('checks present -> null even if needs_more_info', () => {
    const d = baseDraft({ checks: [{ document: 'valid_id', field: 'full_name', compare_to: 'self', rule: 'contains', value: 'Bay', message: 'Must contain Bay.' }], needs_more_info: 'Should be ignored' });
    assert.equal(honestyCheck(d), null);
  });
  it('invented doc 0+empty -> needs_more_info', () => {
    const d = { label: 'Check my papers', documents: [{ id: 'submitted_papers', label: 'Submitted Papers', fields: [{ key: 'full_name', type: 'text', label: 'Full name', required: true, maxLength: 80 }] }], checks: [], not_checked: [] };
    const parsed = validateDraft(d);
    assert.equal(parsed.ok, true);
    const h = honestyCheck(parsed.draft);
    assert.ok(h && typeof h.needs_more_info === 'string');
    assert.equal(h.needs_more_info, DEFAULT_NEEDS_MORE_INFO);
  });
  it('age18 0+non-empty -> allowed', () => {
    const d = baseDraft({ checks: [], not_checked: ['Applicant is at least 18 — staff must verify birth date on ID.'] });
    assert.equal(honestyCheck(d), null);
    assert.equal(validateDraft(d).ok, true);
  });
});
describe('validateSavedDefinition lenient', () => {
  it('missing -> [] not null', () => {
    const def = { id: 'saved_1a2b3c4d', label: 'Test process label', documents: ['valid_id'], docDefs: {}, checks: [], requirement: null, needs_profile: false };
    const clean = validateSavedDefinition(def);
    assert.ok(clean);
    assert.deepEqual(clean.not_checked, []);
  });
  it('malformed -> []', () => {
    const def = { id: 'saved_1a2b3c4d', label: 'Test process label', documents: ['valid_id'], docDefs: {}, checks: [], requirement: null, needs_profile: false, not_checked: 'bad' };
    const clean = validateSavedDefinition(def);
    assert.ok(clean);
    assert.deepEqual(clean.not_checked, []);
  });
  it('preserves good', () => {
    const def = { id: 'saved_1a2b3c4d', label: 'Test process label', documents: ['valid_id'], docDefs: {}, checks: [], requirement: null, needs_profile: false, not_checked: ['Check age by hand.'] };
    const clean = validateSavedDefinition(def);
    assert.deepEqual(clean.not_checked, ['Check age by hand.']);
  });
});
describe('earlyNeedsMoreInfo', () => {
  it('question + no docs + no checks -> returns question', () => {
    const q = 'Which documents do you need to check please?';
    const parsed = { needs_more_info: q, documents: [], checks: [] };
    assert.equal(earlyNeedsMoreInfo(parsed), q);
  });
  it('question + documents present -> null', () => {
    const q = 'Which documents do you need to check please?';
    const parsed = { needs_more_info: q, documents: [{ reuse: 'valid_id' }], checks: [] };
    assert.equal(earlyNeedsMoreInfo(parsed), null);
  });
  it('no question -> null', () => {
    const parsed = { documents: [], checks: [] };
    assert.equal(earlyNeedsMoreInfo(parsed), null);
    assert.equal(earlyNeedsMoreInfo({ needs_more_info: '   ', documents: [], checks: [] }), null);
  });
});
