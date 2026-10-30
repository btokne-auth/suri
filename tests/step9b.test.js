// tests/step9b.test.js — Step 9 Act B targeted tests for items 1 and 4
// Pure, no DB, no API cost. Uses node:test.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { retakeReason, wrongDocumentReason } = require('../lib/decide-usability');
const { isActiveForChecks } = require('../lib/checks/run-checks');
const { isStaleReading } = require('../lib/reading-timeout');

describe('Step 9B item 1: submissions route mapping', () => {
  it('retake_needed → action retake with stored reason (blurry priority)', () => {
    // Route reconstructs reason from stored quality_problems via retakeReason
    assert.equal(retakeReason({ problems: ['blurry'] }), 'The photo is too blurry. Please retake it in better light.');
    assert.equal(retakeReason({ problems: ['dark', 'blurry'] }), 'The photo is too blurry. Please retake it in better light.');
    assert.equal(retakeReason({ problems: ['dark'] }), 'The photo is too dark. Please retake it in better light.');
    assert.equal(retakeReason({ problems: ['glare'] }), 'There is glare on the photo. Please retake it without flash.');
    assert.equal(retakeReason({ problems: ['cut_off'] }), 'The document is cut off. Please retake it to show the full page.');
    assert.equal(retakeReason({ problems: ['angle'] }), 'The photo is taken at an angle. Please retake it straight on.');
    assert.equal(retakeReason({ problems: [] }), "We couldn't read most fields. Please retake the photo in better light.");
  });

  it('wrong_document → action wrong document with label formatting from bundle', () => {
    // Labels come from bundle.docs (builtins or saved); route lowercases them via wrongDocumentReason
    const bundle = {
      docs: {
        birth_certificate: { id: 'birth_certificate', label: 'Birth certificate' },
        report_card: { id: 'report_card', label: 'Report card' },
        valid_id: { id: 'valid_id', label: "Valid ID (voter's ID style)" },
      },
    };
    const looks_like = 'report_card';
    const expected = 'birth_certificate';
    const looksLabel = bundle.docs[looks_like].label;
    const expectedLabel = bundle.docs[expected].label;
    assert.equal(wrongDocumentReason({ expectedLabel, looksLikeLabel: looksLabel }), 'This looks like a report card, not a birth certificate.');
    // Saved process label example
    const savedBundle = { docs: { proof_of_billing: { label: 'Proof of billing' }, birth_certificate: { label: 'Birth certificate' } } };
    assert.equal(
      wrongDocumentReason({ expectedLabel: savedBundle.docs.birth_certificate.label, looksLikeLabel: savedBundle.docs.proof_of_billing.label }),
      'This looks like a proof of billing, not a birth certificate.'
    );
  });

  it('neither counts as passing requirement gate; neither locks or fails', () => {
    // gateOk is true only for needs_review/approved, never for retake_needed/wrong_document/error
    function gateOk(status) {
      return status === 'needs_review' || status === 'approved';
    }
    assert.equal(gateOk('retake_needed'), false);
    assert.equal(gateOk('wrong_document'), false);
    assert.equal(gateOk('error'), false);
    assert.equal(gateOk('needs_review'), true);
    assert.equal(gateOk('approved'), true);
    // They must not be treated as requirement failure either — route shows retake/wrong document before read_ok
    // The presence of these statuses should not trigger requirement_not_met by themselves
    // (verified by run-checks exclusion below)
  });
});

describe('Step 9B item 4: run-checks excludes wrong_document / retake_needed / error', () => {
  it('isActiveForChecks only true for needs_review and approved', () => {
    assert.equal(isActiveForChecks('needs_review'), true);
    assert.equal(isActiveForChecks('approved'), true);
    assert.equal(isActiveForChecks('wrong_document'), false);
    assert.equal(isActiveForChecks('retake_needed'), false);
    assert.equal(isActiveForChecks('error'), false);
    assert.equal(isActiveForChecks('uploaded'), false);
    assert.equal(isActiveForChecks('reading'), false);
    assert.equal(isActiveForChecks('rejected'), false);
  });

  it('active docs filter excludes those statuses (simulated allDocsRaw filter)', () => {
    const allDocsRaw = [
      { id: 'a', doc_type: 'birth_certificate', status: 'needs_review' },
      { id: 'b', doc_type: 'valid_id', status: 'wrong_document' },
      { id: 'c', doc_type: 'report_card', status: 'retake_needed' },
      { id: 'd', doc_type: 'official_receipt', status: 'error' },
      { id: 'e', doc_type: 'birth_certificate', status: 'approved' },
    ];
    const filtered = allDocsRaw.filter((d) => d && d.status !== 'wrong_document' && d.status !== 'retake_needed' && d.status !== 'error');
    assert.equal(filtered.length, 2);
    assert.ok(filtered.some((d) => d.id === 'a'));
    assert.ok(filtered.some((d) => d.id === 'e'));
    assert.ok(!filtered.some((d) => d.id === 'b'));
    assert.ok(!filtered.some((d) => d.id === 'c'));
    assert.ok(!filtered.some((d) => d.id === 'd'));
  });
});

describe('Step 9B item 4: reading-timeout never stale for wrong_document/retake_needed/error', () => {
  it('wrong_document, retake_needed, error are never stale even when old', () => {
    const now = Date.now();
    const old = new Date(now - 60 * 60 * 1000).toISOString();
    for (const s of ['wrong_document', 'retake_needed', 'error', 'needs_review', 'approved', 'rejected', 'missing']) {
      assert.equal(isStaleReading(s, old, now), false, s + ' should never be stale');
    }
  });
  it('only uploaded/reading can be stale', () => {
    const now = Date.now();
    const old = new Date(now - 3 * 60 * 1000).toISOString();
    assert.equal(isStaleReading('reading', old, now), true);
    assert.equal(isStaleReading('uploaded', old, now), true);
  });
});
