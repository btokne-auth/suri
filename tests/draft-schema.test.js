// tests/draft-schema.test.js
// Step 7c Part 1: draft shape + limits + compatibility. No DB, no API cost.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateDraft, checkDraftCompatibility } = require('../lib/processes/draft-schema');
const { getDocumentType } = require('../lib/documents');
function newDoc(id, n, keyPrefix) {
  const fields = [];
  for (let i = 0; i < n; i++) fields.push({ key: (keyPrefix || 'f') + '_' + i, type: 'text', label: 'Field ' + i, required: false, maxLength: 40 });
  return { id, label: 'Doc ' + id, fields };
}
function barangayDraft() {
  return { label: 'Barangay clearance check', documents: [{ reuse: 'valid_id' }, { id: 'proof_of_billing', label: 'Proof of billing', fields: [{ key: 'full_name', type: 'name', label: 'Full name', required: true, maxLength: 100 }, { key: 'billing_address', type: 'text', label: 'Billing address', required: true, maxLength: 120 }, { key: 'billing_date', type: 'date', label: 'Billing date', required: true }] }], checks: [{ document: 'valid_id', field: 'full_name', compare_to: 'proof_of_billing.full_name', rule: 'filipino_name', message: 'Names must match on both documents.' }, { document: 'proof_of_billing', field: 'billing_address', compare_to: 'self', rule: 'contains', value: 'Baybayin', message: 'Address must be in Barangay Baybayin.' }, { document: 'proof_of_billing', field: 'billing_date', compare_to: 'self', rule: 'within_months', months: 3, message: 'Bill must be from the last 3 months.' }], requirement: { document: 'valid_id', field: 'address_line', op: 'contains', value: 'Baybayin', message: 'For Barangay Baybayin residents.' } };
}
describe('draft schema', () => {
  it('good barangay draft passes shape', () => { assert.equal(validateDraft(barangayDraft()).ok, true); });
  it('unknown field type rejected', () => { const d = barangayDraft(); d.documents[1].fields[0].type = 'email'; assert.equal(validateDraft(d).ok, false); });
  it('unknown rule rejected', () => { const d = barangayDraft(); d.checks[0].rule = 'fuzzy_match'; assert.equal(validateDraft(d).ok, false); });
  it('5 documents rejected', () => { const d = { label: 'Five docs process', documents: [newDoc('doc_a', 1), newDoc('doc_b', 1), newDoc('doc_c', 1), newDoc('doc_d', 1), newDoc('doc_e', 1)], checks: [] }; assert.equal(validateDraft(d).ok, false); });
  it('13 fields rejected', () => { const d = { label: 'Big doc process', documents: [newDoc('big_doc', 13, 'k')], checks: [] }; assert.equal(validateDraft(d).ok, false); });
  it('bad within_months rejected', () => { for (const m of [0, 99, undefined]) { const d = barangayDraft(); if (m === undefined) delete d.checks[2].months; else d.checks[2].months = m; assert.equal(validateDraft(d).ok, false, 'months=' + m); } });
  it('value on wrong rule rejected', () => { const d = barangayDraft(); d.checks.push({ document: 'valid_id', field: 'date_of_birth', compare_to: 'proof_of_billing.billing_date', rule: 'same_date', value: 'x', message: 'Bad value use.' }); assert.equal(validateDraft(d).ok, false); });
  it('duplicate keys rejected', () => { const d = { label: 'Dup keys process', documents: [{ id: 'dup_doc', label: 'Dup doc', fields: [{ key: 'same_key', type: 'text', label: 'One', required: true }, { key: 'same_key', type: 'text', label: 'Two', required: false }] }], checks: [] }; assert.equal(validateDraft(d).ok, false); });
  it('requirement outside docs rejected', () => { const d = barangayDraft(); d.requirement.document = 'nope'; assert.equal(validateDraft(d).ok, false); });
  it('builtin id collision rejected', () => { const d = { label: 'Collision process', documents: [{ id: 'valid_id', label: 'Fake valid id', fields: [{ key: 'full_name', type: 'name', label: 'Name', required: true }] }], checks: [] }; assert.equal(validateDraft(d).ok, false); });
  it('description key rejected', () => { const d = barangayDraft(); d.description = 'office words'; assert.equal(validateDraft(d).ok, false); });
});
describe('draft compatibility', () => {
  it('good barangay draft is compatible', () => { const r = checkDraftCompatibility(barangayDraft(), getDocumentType); assert.equal(r.ok, true); });
  it('unknown field ref fails', () => { const d = barangayDraft(); d.checks[0].field = 'nope'; const r = checkDraftCompatibility(d, getDocumentType); assert.equal(r.ok, false); });
  it('type mismatch fails', () => { const d = barangayDraft(); d.checks[1].rule = 'within_months'; d.checks[1].months = 3; delete d.checks[1].value; const r = checkDraftCompatibility(d, getDocumentType); assert.equal(r.ok, false); });
  it('sum_equals rejected in drafts', () => { const d = barangayDraft(); d.checks.push({ document: 'proof_of_billing', field: 'billing_address', compare_to: 'self', rule: 'sum_equals', message: 'Sums must match here.' }); assert.equal(checkDraftCompatibility(d, getDocumentType).ok, false); });
});
describe('draft schema age_limit', () => {
  function baseAgeDraft() {
    return { label: 'Age check process', documents: [{ reuse: 'valid_id' }], checks: [{ document: 'valid_id', field: 'date_of_birth', compare_to: 'self', rule: 'age_limit', min_age: 18, message: 'Must be at least 18.' }] };
  }
  it('accept valid age_limit min only', () => { const d = baseAgeDraft(); assert.equal(validateDraft(d).ok, true); assert.equal(checkDraftCompatibility(d, getDocumentType).ok, true); });
  it('accept valid age_limit max only', () => { const d = baseAgeDraft(); delete d.checks[0].min_age; d.checks[0].max_age = 65; assert.equal(validateDraft(d).ok, true); assert.equal(checkDraftCompatibility(d, getDocumentType).ok, true); });
  it('accept valid age_limit between', () => { const d = baseAgeDraft(); d.checks[0].max_age = 65; assert.equal(validateDraft(d).ok, true); assert.equal(checkDraftCompatibility(d, getDocumentType).ok, true); });
  it('reject age_limit with no bounds', () => { const d = baseAgeDraft(); delete d.checks[0].min_age; assert.equal(validateDraft(d).ok, false); });
  it('reject age_limit with min_age 200', () => { const d = baseAgeDraft(); d.checks[0].min_age = 200; assert.equal(validateDraft(d).ok, false); });
  it('reject age_limit with max_age 200', () => { const d = baseAgeDraft(); d.checks[0].max_age = 200; d.checks[0].min_age = 18; assert.equal(validateDraft(d).ok, false); });
  it('reject max < min', () => { const d = baseAgeDraft(); d.checks[0].min_age = 65; d.checks[0].max_age = 18; assert.equal(validateDraft(d).ok, false); });
  it('reject value on age_limit', () => { const d = baseAgeDraft(); d.checks[0].value = 'something'; assert.equal(validateDraft(d).ok, false); });
  it('reject months on age_limit', () => { const d = baseAgeDraft(); d.checks[0].months = 3; assert.equal(validateDraft(d).ok, false); });
  it('reject age_limit on text field', () => { const d = baseAgeDraft(); d.checks[0].field = 'address_line'; assert.equal(checkDraftCompatibility(d, getDocumentType).ok, false); });
  it('reject age_limit with non-self compare_to', () => { const d = baseAgeDraft(); d.checks[0].compare_to = 'profile.date_of_birth'; assert.equal(checkDraftCompatibility(d, getDocumentType).ok, false); });
});

