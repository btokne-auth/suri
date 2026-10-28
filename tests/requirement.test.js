// tests/requirement.test.js
// Step 6: requirement check cases (pure, no database, no API cost).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkRequirementCity, compareSameDate, buildCheckRows, comparedLabel, newestByCreatedAt, newestPerType, decideRequirement } = require('../lib/checks/run-checks');
const linawan = require('../lib/processes/linawan-scholarship-intake');

function readable(value) {
  return { value, confidence: 'high', unreadable: false };
}

describe('requirement check', () => {
  it('Linawan passes', () => {
    const r = checkRequirementCity('Linawan', linawan);
    assert.equal(r.outcome, 'pass');
  });

  it('another town fails with the process message', () => {
    const r = checkRequirementCity('Cebu City', linawan);
    assert.equal(r.outcome, 'fail');
    assert.equal(r.message, 'This program is for Linawan residents.');
  });

  it('unreadable city is retake, never fail', () => {
    assert.equal(checkRequirementCity(null, linawan).outcome, 'retake');
    assert.equal(checkRequirementCity('', linawan).outcome, 'retake');
    assert.equal(checkRequirementCity('   ', linawan).outcome, 'retake');
  });

  it('case and extra spaces still pass', () => {
    assert.equal(checkRequirementCity('LINAWAN', linawan).outcome, 'pass');
    assert.equal(checkRequirementCity('  linawan ', linawan).outcome, 'pass');
  });

  it('different spelling fails as a flag', () => {
    const r = checkRequirementCity('Linawan City', linawan);
    assert.equal(r.outcome, 'fail');
    assert.equal(r.message, 'This program is for Linawan residents.');
  });

  it('mismatched birth date is flagged', () => {
    const rows = buildCheckRows({
      docType: 'birth_certificate',
      documentId: 'doc-a',
      myFields: {
        full_name: readable('Maria Santos Dela Cruz'),
        date_of_birth: readable('2015-06-15'),
      },
      profileFullName: 'Maria Santos Dela Cruz',
      profileDob: '2016-01-02',
      others: [],
    });
    const dob = rows.find((r) => r.field_key === 'date_of_birth');
    assert.ok(dob);
    assert.equal(dob.result, 'mismatch');
    assert.match(dob.reason, /Birth date is different/);
  });

  it('same birth date matches, Ma. vs Maria is check', () => {
    const rows = buildCheckRows({
      docType: 'birth_certificate',
      documentId: 'doc-a',
      myFields: {
        full_name: readable('Ma. Teresa Santos'),
        date_of_birth: readable('2015-06-15'),
      },
      profileFullName: 'Maria Teresa Santos',
      profileDob: '2015-06-15',
      others: [],
    });
    assert.equal(rows.find((r) => r.field_key === 'date_of_birth').result, 'match');
    assert.equal(rows.find((r) => r.field_key === 'full_name').result, 'check');
  });

  it('only the newest valid_id decides, older ones are ignored', () => {
    const oldId = { id: 'id-old', created_at: '2026-10-27T10:00:00Z' };
    const newId = { id: 'id-new', created_at: '2026-10-27T11:00:00Z' };
    assert.equal(newestByCreatedAt([oldId, newId]).id, 'id-new');
    // Newest is Linawan: passes even though the older city differs.
    const fields = {
      'id-old': { address_city_municipality: readable('Cebu City') },
      'id-new': { address_city_municipality: readable('Linawan') },
    };
    assert.equal(decideRequirement(newestByCreatedAt([oldId, newId]), fields, linawan).outcome, 'pass');
    // Newest is another town: fails even though the older one passed.
    const fields2 = {
      'id-old': { address_city_municipality: readable('Linawan') },
      'id-new': { address_city_municipality: readable('Cebu City') },
    };
    const lost = decideRequirement(newestByCreatedAt([oldId, newId]), fields2, linawan);
    assert.equal(lost.outcome, 'fail');
    assert.equal(lost.message, 'This program is for Linawan residents.');
    // No requirement document: skipped.
    assert.equal(decideRequirement(null, {}, linawan).outcome, 'skip');
  });

  it('replaced uploads are ignored: newest per type wins', () => {
    const oldBc = { docId: 'bc-old', docType: 'birth_certificate', created_at: '2026-10-27T10:00:00Z', fields: { date_of_birth: readable('2000-01-01') } };
    const newBc = { docId: 'bc-new', docType: 'birth_certificate', created_at: '2026-10-27T11:00:00Z', fields: { date_of_birth: readable('2015-06-15') } };
    const active = newestPerType([oldBc, newBc]);
    assert.equal(Object.keys(active).length, 1);
    assert.equal(active.birth_certificate.docId, 'bc-new');
    // A valid_id comparing against birth_certificate uses only the newest BC:
    // the old BC's 2000 date must not produce a mismatch.
    const rows = buildCheckRows({
      docType: 'valid_id',
      documentId: 'id-1',
      myFields: { date_of_birth: readable('2015-06-15') },
      profileFullName: null,
      profileDob: null,
      others: [oldBc, newBc],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].result, 'match');
    assert.equal(rows[0].compared_document_id, 'bc-new');
  });

  it('compared label: null means the profile', () => {
    assert.equal(comparedLabel(null, {}), 'your profile');
    assert.equal(comparedLabel(undefined, {}), 'your profile');
  });

  it('compared label uses the settings label, not a hard-coded name', () => {
    assert.equal(comparedLabel('bc-1', { 'bc-1': 'birth_certificate' }), 'Birth certificate');
    assert.equal(comparedLabel('id-9', { 'id-9': 'valid_id' }), "Valid ID (voter's ID style)");
  });

  it('compared label falls back for unknown documents', () => {
    assert.equal(comparedLabel('zzz', {}), 'the other document');
    assert.equal(comparedLabel('zzz', { 'zzz': 'nope' }), 'the other document');
  });

  it('stored reasons stay pure: no baked-in "same as"', () => {
    const rows = buildCheckRows({
      docType: 'valid_id',
      documentId: 'id-1',
      myFields: {
        full_name: readable('Maria Santos Dela Cruz'),
        date_of_birth: readable('2015-06-15'),
      },
      profileFullName: 'Maria Santos Dela Cruz',
      profileDob: '2015-06-15',
      others: [{ docId: 'bc-1', docType: 'birth_certificate', created_at: '2026-10-27T11:00:00Z', fields: { full_name: readable('Maria Santos Dela Cruz'), date_of_birth: readable('2015-06-15') } }],
    });
    assert.ok(rows.length >= 2);
    for (const r of rows) assert.ok(!/same as/i.test(r.reason), 'reason must not contain "same as": ' + r.reason);
  });

  it('unreadable side is skipped, never mismatch', () => {
    assert.equal(compareSameDate('date_of_birth', null, '2015-06-15'), null);
    const rows = buildCheckRows({
      docType: 'birth_certificate',
      documentId: 'doc-a',
      myFields: {
        full_name: { value: null, confidence: 'low', unreadable: true },
        date_of_birth: readable('2015-06-15'),
      },
      profileFullName: 'Maria Santos Dela Cruz',
      profileDob: '2015-06-15',
      others: [],
    });
    assert.equal(rows.some((r) => r.field_key === 'full_name'), false);
  });
});
