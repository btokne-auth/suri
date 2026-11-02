// tests/wrong-doc-other.test.js
// A clear photo of an unknown kind of paper says "doesn't look like", not "retake".
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { decideUsability, wrongDocumentReason } = require('../lib/decide-usability');

const def = {
  id: 'official_receipt',
  label: 'Official receipt',
  fields: [
    { key: 'store_name', required: true },
    { key: 'receipt_number', required: true },
    { key: 'receipt_date', required: true },
    { key: 'total_amount', required: true },
  ],
};
const empty = {
  store_name: { value: null, confidence: 'low', unreadable: true },
  receipt_number: { value: null, confidence: 'low', unreadable: true },
  receipt_date: { value: null, confidence: 'low', unreadable: true },
  total_amount: { value: null, confidence: 'low', unreadable: true },
};
const base = { def, bundle: null, expectedDocTypeId: 'official_receipt', fields: empty, allowedIds: ['official_receipt'] };

describe('wrong document vs retake for unknown papers', () => {
  it('clear photo of another kind of paper -> wrong document', () => {
    const r = decideUsability({ ...base, quality: { usable: true, problems: [] }, documentMatch: { matches_expected: false, looks_like: 'other' } });
    assert.equal(r.status, 'wrong_document');
    assert.equal(r.looks_like, null);
    assert.equal(r.reason, "This doesn't look like an official receipt. Please upload the right document.");
  });
  it('blurry photo of unknown paper -> still retake', () => {
    const r = decideUsability({ ...base, quality: { usable: false, problems: ['blurry'] }, documentMatch: { matches_expected: false, looks_like: 'other' } });
    assert.equal(r.status, 'retake_needed');
  });
  it('photo problem listed but usable -> still retake', () => {
    const r = decideUsability({ ...base, quality: { usable: true, problems: ['glare'] }, documentMatch: { matches_expected: false, looks_like: 'other' } });
    assert.equal(r.status, 'retake_needed');
  });
  it('model says it matches but fields unreadable -> retake', () => {
    const r = decideUsability({ ...base, quality: { usable: true, problems: [] }, documentMatch: { matches_expected: true, looks_like: 'official_receipt' } });
    assert.equal(r.status, 'retake_needed');
  });
  it('other but most fields read -> normal review', () => {
    const fields = {
      store_name: { value: 'Tindahan', confidence: 'high', unreadable: false },
      receipt_number: { value: 'OR-1', confidence: 'high', unreadable: false },
      receipt_date: { value: '2026-10-12', confidence: 'high', unreadable: false },
      total_amount: { value: 210, confidence: 'high', unreadable: false },
    };
    const r = decideUsability({ ...base, fields, quality: { usable: true, problems: [] }, documentMatch: { matches_expected: false, looks_like: 'other' } });
    assert.equal(r.status, 'needs_review');
  });
  it('reason wording uses a/an', () => {
    assert.equal(wrongDocumentReason({ expectedLabel: 'Birth certificate', looksLikeLabel: 'Report card' }), 'This looks like a report card, not a birth certificate.');
    assert.equal(wrongDocumentReason({ expectedLabel: 'Official receipt', looksLikeLabel: 'another document' }), "This doesn't look like an official receipt. Please upload the right document.");
  });
});
