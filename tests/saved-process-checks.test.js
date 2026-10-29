// tests/saved-process-checks.test.js
// Step 7c Part 1: process-level rows mirror on both docs. Pure, no DB.
// MATCH wording uses the field's label, never the key. Mismatch keeps the
// office's own message. Built-in processes never use these four rules.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildProcessCheckRows } = require('../lib/checks/run-checks');
const NOW = Date.UTC(2026, 9, 29);
function readable(value) { return { value, confidence: 'high', unreadable: false }; }
function bundle(checks, extra) {
  return Object.assign({ checks, docIdByType: { valid_id: 'a', proof_of_billing: 'b' }, docsById: { a: { fields: { full_name: readable('Maria Dela Cruz') } }, b: { fields: { full_name: readable('Maria Dela Cruz'), billing_address: readable('Purok 1, Barangay Baybayin'), billing_date: readable('2026-09-15') } } }, nowMs: NOW }, extra || {});
}
function docsWithLabels() {
  return { proof_of_billing: { label: 'Proof of billing', fields: [{ key: 'billing_address', label: 'Billing address' }, { key: 'billing_date', label: 'Billing date' }] }, valid_id: { label: "Valid ID (voter's ID style)", fields: [{ key: 'address_line', label: 'Address Line' }] } };
}
describe('process check rows', () => {
  it('filipino_name mirrors on both docs', () => { const rows = buildProcessCheckRows(bundle([{ document: 'valid_id', field: 'full_name', compare_to: 'proof_of_billing.full_name', rule: 'filipino_name', message: 'Names must match.' }])); assert.equal(rows.length, 2); const ids = rows.map((r) => r.document_id).sort(); assert.deepStrictEqual(ids, ['a', 'b']); assert.equal(rows[0].compared_document_id, 'b'); assert.equal(rows[1].compared_document_id, 'a'); });
  it('contains is single-sided self-like', () => { const rows = buildProcessCheckRows(bundle([{ document: 'proof_of_billing', field: 'billing_address', compare_to: 'self', rule: 'contains', value: 'Baybayin', message: 'Must be Baybayin.' }])); assert.equal(rows.length, 1); assert.equal(rows[0].document_id, 'b'); assert.equal(rows[0].compared_document_id, 'b'); });
  it('within_months single-sided', () => { const rows = buildProcessCheckRows(bundle([{ document: 'proof_of_billing', field: 'billing_date', compare_to: 'self', rule: 'within_months', months: 3, message: 'Bill too old.' }])); assert.equal(rows.length, 1); assert.equal(rows[0].result, 'match'); });
  it('profile compare uses null side', () => { const rows = buildProcessCheckRows(bundle([{ document: 'valid_id', field: 'full_name', compare_to: 'profile.full_name', rule: 'filipino_name', message: 'Must match profile.' }], { profileFullName: 'Maria Dela Cruz' })); assert.equal(rows.length, 1); assert.equal(rows[0].compared_document_id, null); });
  it('office message on failure', () => { const b = bundle([{ document: 'proof_of_billing', field: 'billing_address', compare_to: 'self', rule: 'contains', value: 'Baybayin', message: 'Must be Baybayin.' }]); b.docsById.b.fields.billing_address = readable('Cebu City'); const rows = buildProcessCheckRows(b); assert.equal(rows[0].result, 'mismatch'); assert.equal(rows[0].reason, 'Must be Baybayin.'); });
  it('unreadable skips', () => { const b = bundle([{ document: 'valid_id', field: 'full_name', compare_to: 'proof_of_billing.full_name', rule: 'filipino_name', message: 'Names must match.' }]); b.docsById.a.fields.full_name = { value: null, confidence: 'low', unreadable: true }; assert.equal(buildProcessCheckRows(b).length, 0); });
  it('contains MATCH uses the field label', () => { const rows = buildProcessCheckRows(bundle([{ document: 'proof_of_billing', field: 'billing_address', compare_to: 'self', rule: 'contains', value: 'Baybayin', message: 'Must be Baybayin.' }], { docs: docsWithLabels() })); assert.equal(rows[0].result, 'match'); assert.equal(rows[0].reason, 'Billing address includes "Baybayin".'); });
  it('within_months MATCH uses the field label', () => { const rows = buildProcessCheckRows(bundle([{ document: 'proof_of_billing', field: 'billing_date', compare_to: 'self', rule: 'within_months', months: 3, message: 'Bill too old.' }], { docs: docsWithLabels() })); assert.equal(rows[0].result, 'match'); assert.equal(rows[0].reason, 'Billing date is within the last 3 months.'); });
  it('MATCH falls back to Title-Case key without stored labels', () => { const rows = buildProcessCheckRows(bundle([{ document: 'proof_of_billing', field: 'billing_date', compare_to: 'self', rule: 'within_months', months: 3, message: 'Bill too old.' }])); assert.equal(rows[0].result, 'match'); assert.equal(rows[0].reason, 'Billing Date is within the last 3 months.'); });
  it('equals MATCH uses the field label', () => { const b = bundle([{ document: 'valid_id', field: 'address_line', compare_to: 'self', rule: 'equals', value: 'Linawan', message: 'Must be Linawan.' }], { docs: docsWithLabels() }); b.docsById.a.fields.address_line = readable('Linawan'); const rows = buildProcessCheckRows(b); assert.equal(rows.length, 1); assert.equal(rows[0].result, 'match'); assert.equal(rows[0].reason, 'Address Line is "Linawan".'); });
  it('not_future MATCH uses the field label', () => { const rows = buildProcessCheckRows(bundle([{ document: 'proof_of_billing', field: 'billing_date', compare_to: 'self', rule: 'not_future', message: 'Bill in future.' }], { docs: docsWithLabels() })); assert.equal(rows[0].result, 'match'); assert.equal(rows[0].reason, 'Billing date is not in the future.'); });
});
