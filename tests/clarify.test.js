// tests/clarify.test.js — Step 9B Act 2 pure helpers
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { compareFilipinoNames } = require('../lib/checks/names');
const { buildPairKey, fieldAllowsQuestion, validateQuestion, templateQuestion, validateAnswer, pickUniquePairs } = require('../lib/clarify');

describe('buildPairKey sorted+baseNormalize', () => {
  it('builds field|normA|normB sorted', () => {
    const k1 = buildPairKey('full_name', 'Ma. Theresa Santos Reyes', 'Maria Theresa Santos Reyes');
    const k2 = buildPairKey('full_name', 'Maria Theresa Santos Reyes', 'Ma. Theresa Santos Reyes');
    assert.equal(k1, k2);
    assert.equal(k1, 'full_name|ma theresa santos reyes|maria theresa santos reyes');
  });
  it('uses baseNormalize de la -> dela and accents', () => {
    const k = buildPairKey('full_name', 'Mar\u00eda De La Cruz', 'Maria Dela Cruz');
    assert.equal(k, 'full_name|maria dela cruz|maria dela cruz');
  });
  it('handles comma reorder', () => {
    const a = buildPairKey('full_name', 'Dela Cruz, Maria', 'Maria Dela Cruz');
    assert.equal(a, 'full_name|maria dela cruz|maria dela cruz');
  });
  it('empty values', () => {
    const k = buildPairKey('full_name', '', '');
    assert.equal(k, 'full_name||');
  });
});
describe('fieldAllowsQuestion default true for name', () => {
  it('name type default true when clarify absent', () => {
    const def = { fields: [{ key: 'full_name', type: 'name' }] };
    assert.equal(fieldAllowsQuestion(def, 'full_name'), true);
  });
  it('name explicit false opts out', () => {
    const def = { fields: [{ key: 'full_name', type: 'name', clarify: false }] };
    assert.equal(fieldAllowsQuestion(def, 'full_name'), false);
  });
  it('name explicit true stays true', () => {
    const def = { fields: [{ key: 'full_name', type: 'name', clarify: true }] };
    assert.equal(fieldAllowsQuestion(def, 'full_name'), true);
  });
  it('other types false unless explicit true', () => {
    const def = { fields: [{ key: 'date_of_birth', type: 'date' }, { key: 'store_name', type: 'text', clarify: true }] };
    assert.equal(fieldAllowsQuestion(def, 'date_of_birth'), false);
    assert.equal(fieldAllowsQuestion(def, 'store_name'), true);
  });
  it('unknown field returns false', () => {
    const def = { fields: [{ key: 'full_name', type: 'name' }] };
    assert.equal(fieldAllowsQuestion(def, 'nope'), false);
  });
});
describe('trigger Ma./Maria -> check eligible', () => {
  function eligible(result, rule, fieldDef) {
    return result === 'check' && rule === 'filipino_name' && fieldAllowsQuestion(fieldDef, 'full_name');
  }
  const nameDef = { fields: [{ key: 'full_name', type: 'name', clarify: true }] };
  const dateDef = { fields: [{ key: 'date_of_birth', type: 'date' }] };
  it('Ma. vs Maria is check and eligible', () => {
    const r = compareFilipinoNames('Ma. Theresa Santos Reyes', 'Maria Theresa Santos Reyes');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /Ma\./);
    assert.equal(eligible(r.result, 'filipino_name', nameDef), true);
  });
  it('accent-only is check eligible', () => {
    const r = compareFilipinoNames('Jos\u00e9 Cruz', 'Jose Cruz');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /accent/i);
    assert.equal(eligible(r.result, 'filipino_name', nameDef), true);
  });
  it('missing suffix Jr. is check eligible', () => {
    const r = compareFilipinoNames('Juan Dela Cruz', 'Juan Dela Cruz Jr.');
    assert.equal(r.result, 'check');
    assert.equal(eligible(r.result, 'filipino_name', nameDef), true);
  });
  it('Sto. vs Santo is check eligible', () => {
    const r = compareFilipinoNames('Sto. Nino Ramos', 'Santo Nino Ramos');
    assert.equal(r.result, 'check');
    assert.equal(eligible(r.result, 'filipino_name', nameDef), true);
  });
  it('Sta. vs Santa is check eligible', () => {
    const r = compareFilipinoNames('Sta. Maria Ramos', 'Santa Maria Ramos');
    assert.equal(r.result, 'check');
    assert.equal(eligible(r.result, 'filipino_name', nameDef), true);
  });
  it('extra words is check eligible', () => {
    const r = compareFilipinoNames('Maria Dela Cruz', 'Maria Dela Cruz Santos');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /extra words/);
    assert.equal(eligible(r.result, 'filipino_name', nameDef), true);
  });
  it('mismatch not eligible', () => {
    const r = compareFilipinoNames('Maria Santos', 'Jose Reyes');
    assert.equal(r.result, 'mismatch');
    assert.equal(eligible(r.result, 'filipino_name', nameDef), false);
  });
  it('match not eligible', () => {
    const r = compareFilipinoNames('Maria Santos Dela Cruz', 'Maria Santos Dela Cruz');
    assert.equal(r.result, 'match');
    assert.equal(eligible(r.result, 'filipino_name', nameDef), false);
  });
  it('same_date never eligible', () => {
    assert.equal(eligible('check', 'same_date', dateDef), false);
  });
});
describe('pickUniquePairs dedup mirror rows to 1, 5 unique -> pick 3 cap ordered; existingCount 3 -> 0', () => {
  const nameDoc = { fields: [{ key: 'full_name', type: 'name', clarify: true }] };
  const getDef = () => nameDoc;
  it('dedup mirror rows to 1', () => {
    const rows = [
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Ma. Santos', value_b: 'Maria Santos', created_at: '2026-10-30T01:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria Santos', value_b: 'Ma. Santos', created_at: '2026-10-30T01:00:01Z' },
    ];
    const picked = pickUniquePairs(rows, getDef, 0);
    assert.equal(picked.length, 1);
    assert.equal(picked[0].pair_key, 'full_name|ma santos|maria santos');
  });
  it('5 unique -> pick 3 cap ordered by created_at, field_key, pair_key', () => {
    const rows = [
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria A', value_b: 'Ma. A', created_at: '2026-10-30T03:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria B', value_b: 'Ma. B', created_at: '2026-10-30T01:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria C', value_b: 'Ma. C', created_at: '2026-10-30T02:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria D', value_b: 'Ma. D', created_at: '2026-10-30T04:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria E', value_b: 'Ma. E', created_at: '2026-10-30T05:00:00Z' },
    ];
    const picked = pickUniquePairs(rows, getDef, 0);
    assert.equal(picked.length, 3);
    assert.equal(picked[0]._value_a, 'Maria B');
    assert.equal(picked[1]._value_a, 'Maria C');
    assert.equal(picked[2]._value_a, 'Maria A');
  });
  it('existingCount 3 -> 0', () => {
    const rows = [{ field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Ma. X', value_b: 'Maria X', created_at: '2026-10-30T01:00:00Z' }];
    const picked = pickUniquePairs(rows, getDef, 3);
    assert.equal(picked.length, 0);
  });
  it('remaining cap respects existingCount 1 -> pick 2 only', () => {
    const rows = [
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria 1', value_b: 'Ma. 1', created_at: '2026-10-30T01:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria 2', value_b: 'Ma. 2', created_at: '2026-10-30T02:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Maria 3', value_b: 'Ma. 3', created_at: '2026-10-30T03:00:00Z' },
    ];
    const picked = pickUniquePairs(rows, getDef, 1);
    assert.equal(picked.length, 2);
  });
  it('ignores mismatch/match and wrong rule', () => {
    const rows = [
      { field_key: 'full_name', rule: 'filipino_name', result: 'mismatch', value_a: 'A', value_b: 'B', created_at: '2026-10-30T01:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'match', value_a: 'A', value_b: 'A', created_at: '2026-10-30T01:00:00Z' },
      { field_key: 'full_name', rule: 'same_date', result: 'check', value_a: '2020-01-01', value_b: '2020-01-01', created_at: '2026-10-30T01:00:00Z' },
      { field_key: 'full_name', rule: 'filipino_name', result: 'check', value_a: 'Ma. Santos', value_b: 'Maria Santos', created_at: '2026-10-30T01:00:00Z' },
    ];
    const picked = pickUniquePairs(rows, getDef, 0);
    assert.equal(picked.length, 1);
  });
});
describe('validateQuestion rejects >160/no ?/<a>/http/empty, template always <=160 ?', () => {
  it('rejects >160', () => {
    const long = 'a'.repeat(160) + '?';
    assert.equal(validateQuestion(long).ok, false);
  });
  it('rejects no ?', () => {
    assert.equal(validateQuestion('Is this correct').ok, false);
  });
  it('rejects <a> html', () => {
    assert.equal(validateQuestion('Is <a> tag?').ok, false);
  });
  it('rejects http link', () => {
    assert.equal(validateQuestion('See https://example.com?').ok, false);
  });
  it('rejects empty', () => {
    assert.equal(validateQuestion('').ok, false);
    assert.equal(validateQuestion('   ').ok, false);
  });
  it('rejects control chars', () => {
    assert.equal(validateQuestion('Is ok?\u0001').ok, false);
  });
  it('accepts valid question', () => {
    const q = 'Is "Ma. Santos" the same person as "Maria Santos" for Full name?';
    assert.equal(validateQuestion(q).ok, true);
  });
  it('template always <=160 and ends with ?', () => {
    const t = templateQuestion('Full name', 'Ma. Theresa Santos Reyes', 'Maria Theresa Santos Reyes');
    assert.ok(t.length <= 160);
    assert.equal(t[t.length - 1], '?');
    assert.ok(validateQuestion(t).ok);
    const longLabel = 'a'.repeat(100);
    const longA = 'b'.repeat(100);
    const longB = 'c'.repeat(100);
    const t2 = templateQuestion(longLabel, longA, longB);
    assert.ok(t2.length <= 160);
    assert.equal(t2[t2.length - 1], '?');
  });
});
describe('validateAnswer rejects empty/>200/<script>/controls, trims, accepts 200', () => {
  it('rejects empty', () => {
    assert.equal(validateAnswer('').ok, false);
    assert.equal(validateAnswer('   ').ok, false);
  });
  it('rejects >200', () => {
    assert.equal(validateAnswer('a'.repeat(201)).ok, false);
  });
  it('rejects <script>', () => {
    assert.equal(validateAnswer('<script>alert(1)</script>').ok, false);
  });
  it('rejects controls', () => {
    assert.equal(validateAnswer('hello\u0000world').ok, false);
    assert.equal(validateAnswer('line1\nline2').ok, false);
  });
  it('trims', () => {
    const r = validateAnswer('  My name is Maria  ');
    assert.equal(r.ok, true);
    assert.equal(r.value, 'My name is Maria');
  });
  it('accepts 200', () => {
    const ok = 'a'.repeat(200);
    assert.equal(validateAnswer(ok).ok, true);
    assert.equal(validateAnswer(ok).value.length, 200);
  });
  it('accepts normal answer', () => {
    assert.equal(validateAnswer('Ma. is Maria — initials on my ID').ok, true);
  });
});
