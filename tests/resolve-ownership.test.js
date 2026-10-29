// tests/resolve-ownership.test.js
// Step 7c Part 2: resolveProcess + resolveDocumentType + validateExtractionWithDef.
// Fake admin client only (no database, no API cost). Builtins need no database.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  SAVED_KEY_RE,
  isSavedProcessId,
  validateSavedDefinition,
  resolveProcess,
  resolveDocumentType,
  listProcessesForUser,
} = require('../lib/processes/resolve');
const { validateExtractionWithDef } = require('../lib/validation');

const OWNER = 'user-owner';
const OTHER = 'user-other';
const KEY = 'saved_1a2b3c4d';

function goodDefinition() {
  return {
    id: KEY,
    label: 'Barangay clearance check',
    documents: ['valid_id', 'proof_of_billing'],
    docDefs: {
      proof_of_billing: {
        id: 'proof_of_billing',
        label: 'Proof of billing',
        fields: [
          { key: 'full_name', type: 'name', label: 'Full name', required: true, maxLength: 100 },
          { key: 'billing_address', type: 'text', label: 'Billing address', required: true, maxLength: 120 },
          { key: 'billing_date', type: 'date', label: 'Billing date', required: true },
        ],
      },
    },
    checks: [
      { document: 'valid_id', field: 'full_name', compare_to: 'proof_of_billing.full_name', rule: 'filipino_name', message: 'Names must match on both documents.' },
      { document: 'proof_of_billing', field: 'billing_address', compare_to: 'self', rule: 'contains', value: 'Baybayin', message: 'Address must be in Barangay Baybayin.' },
      { document: 'proof_of_billing', field: 'billing_date', compare_to: 'self', rule: 'within_months', months: 3, message: 'Bill must be from the last 3 months.' },
    ],
    requirement: { document: 'valid_id', field: 'address_line', op: 'contains', value: 'Baybayin', message: 'For Barangay Baybayin residents.' },
    needs_profile: false,
  };
}

// Minimal fake admin: from(table).select().eq().maybeSingle() for one row,
// from(table).select().eq() (awaited directly) for list rows.
function fakeAdmin(savedRows) {
  const rows = Array.isArray(savedRows) ? savedRows : [];
  return {
    from(table) {
      if (table !== 'saved_processes') throw new Error('unexpected table ' + table);
      return {
        select() { return this; },
        eq(col, val) {
          const matched = rows.filter((r) => r && r[col] === val);
          const q = {
            maybeSingle: async () => ({ data: matched.length > 0 ? matched[0] : null }),
            then(resolve) { resolve({ data: matched }); },
          };
          return q;
        },
      };
    },
  };
}

describe('saved process keys', () => {
  it('accepts saved_ + 8 hex, rejects others', () => {
    assert.equal(SAVED_KEY_RE.test('saved_1a2b3c4d'), true);
    assert.equal(isSavedProcessId('saved_1a2b3c4d'), true);
    assert.equal(isSavedProcessId('linawan_scholarship_intake'), false);
    assert.equal(isSavedProcessId('saved_xyz'), false);
    assert.equal(isSavedProcessId(''), false);
  });
});

describe('validateSavedDefinition', () => {
  it('accepts the barangay shape, computes needs_profile false', () => {
    const clean = validateSavedDefinition(goodDefinition());
    assert.ok(clean);
    assert.equal(clean.id, KEY);
    assert.deepStrictEqual(clean.documents, ['valid_id', 'proof_of_billing']);
    assert.equal(clean.needs_profile, false);
    assert.equal(clean.docDefs.proof_of_billing.label, 'Proof of billing');
  });
  it('rejects bad id, bad label, bad documents', () => {
    const d = goodDefinition();
    assert.equal(validateSavedDefinition(Object.assign({}, d, { id: 'nope' })), null);
    assert.equal(validateSavedDefinition(Object.assign({}, d, { label: 'abc' })), null);
    assert.equal(validateSavedDefinition(Object.assign({}, d, { documents: [] })), null);
  });
  it('rejects a broken check reference', () => {
    const d = goodDefinition();
    d.checks = [{ document: 'nope', field: 'full_name', compare_to: 'self', rule: 'equals', value: 'x', message: 'Broken check here.' }];
    assert.equal(validateSavedDefinition(d), null);
  });
});

describe('resolveProcess ownership (fake admin)', () => {
  const owned = [{ process_key: KEY, user_id: OWNER, definition: goodDefinition() }];
  it('builtin resolves with no database', async () => {
    const b = await resolveProcess(null, 'linawan_scholarship_intake', OWNER);
    assert.ok(b && b.isBuiltin === true);
    assert.ok(b.docs.valid_id && b.docs.birth_certificate && b.docs.report_card);
  });
  it('owner resolves their saved process', async () => {
    const b = await resolveProcess(fakeAdmin(owned), KEY, OWNER);
    assert.ok(b && b.isBuiltin === false);
    assert.equal(b.def.id, KEY);
    assert.ok(b.docs.valid_id && b.docs.proof_of_billing);
    assert.equal(b.docs.proof_of_billing.label, 'Proof of billing');
  });
  it('wrong owner gets null (404 at the caller)', async () => {
    assert.equal(await resolveProcess(fakeAdmin(owned), KEY, OTHER), null);
  });
  it('unknown key gets null', async () => {
    assert.equal(await resolveProcess(fakeAdmin(owned), 'saved_ffffffff', OWNER), null);
    assert.equal(await resolveProcess(fakeAdmin([]), KEY, OWNER), null);
  });
});

describe('resolveDocumentType', () => {
  it('builtins first, then inline defs', async () => {
    const b = await resolveProcess(fakeAdmin([{ process_key: KEY, user_id: OWNER, definition: goodDefinition() }]), KEY, OWNER);
    assert.ok(resolveDocumentType(b, 'valid_id'));
    const inline = resolveDocumentType(b, 'proof_of_billing');
    assert.ok(inline && inline.label === 'Proof of billing');
    assert.equal(resolveDocumentType(b, 'nope'), null);
  });
});

describe('listProcessesForUser (fake admin)', () => {
  it('builtins always; owned saved appended', async () => {
    const list = await listProcessesForUser(fakeAdmin([{ process_key: KEY, user_id: OWNER, definition: goodDefinition() }]), OWNER);
    assert.ok(list.some((p) => p.id === 'linawan_scholarship_intake'));
    assert.ok(list.some((p) => p.id === 'receipt_check'));
    const saved = list.find((p) => p.id === KEY);
    assert.ok(saved && saved.needs_profile === false && saved.hasRequirement === true);
  });
  it('other visitor sees builtins only', async () => {
    const list = await listProcessesForUser(fakeAdmin([{ process_key: KEY, user_id: OWNER, definition: goodDefinition() }]), OTHER);
    assert.ok(!list.some((p) => p.id === KEY));
  });
});

describe('validateExtractionWithDef date floor', () => {
  const proofDef = goodDefinition().docDefs.proof_of_billing;
  function env(value) { return { fields: { full_name: { value: 'Maria Dela Cruz', confidence: 'high', unreadable: false }, billing_address: { value: 'Purok 1, Barangay Baybayin', confidence: 'high', unreadable: false }, billing_date: { value, confidence: 'high', unreadable: false } } }; }
  it('default floor flags 1899, keeps the value', () => {
    const res = validateExtractionWithDef(proofDef, env('1899-12-31'));
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === 'billing_date'));
    assert.equal(res.fields.billing_date.value, '1899-12-31');
  });
  it('1900-01-01 and today pass the floor', () => {
    assert.equal(validateExtractionWithDef(proofDef, env('1900-01-01')).ok, true);
    assert.equal(validateExtractionWithDef(proofDef, env('2026-09-15')).ok, true);
  });
  it('dateFloor null disables the floor', () => {
    assert.equal(validateExtractionWithDef(proofDef, env('1899-12-31'), { dateFloor: null }).ok, true);
  });
});

