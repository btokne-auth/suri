// tests/ocr-compare.test.js — Step 9E Act 1 shared plain-OCR scoring
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  escapeRegExp,
  expandShortNames,
  dateCandidates,
  ocrFoundInText,
  ocrFieldCorrect,
} = require('../lib/ocr-compare');

describe('lib/ocr-compare browser-safe', () => {
  it('has no server-only, fs, path, crypto', () => {
    const p = path.join(__dirname, '..', 'lib', 'ocr-compare.js');
    const text = fs.readFileSync(p, 'utf8');
    assert.equal(text.includes('server-only'), false, 'must not contain server-only');
    assert.ok(text.includes('normalize-amount'), 'should import normalize-amount');
    assert.ok(text.includes('checks/text'), 'should import checks/text');
    assert.ok(text.includes('checks/names'), 'should import checks/names');
    assert.equal(/require\(['\"]fs['\"]\)/.test(text), false);
    assert.equal(/require\(['\"]path['\"]\)/.test(text), false);
    assert.equal(/require\(['\"]crypto['\"]\)/.test(text), false);
  });

  it('normalize-amount is browser-safe', () => {
    const p = path.join(__dirname, '..', 'lib', 'normalize-amount.js');
    const text = fs.readFileSync(p, 'utf8');
    assert.equal(text.includes('server-only'), false);
    assert.equal(/require\(['\"]fs/.test(text), false);
    const { normalizeAmount } = require('../lib/normalize-amount');
    assert.equal(typeof normalizeAmount, 'function');
    assert.equal(normalizeAmount('₱1,210.00'), 1210);
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metachars', () => {
    assert.equal(escapeRegExp('a.b*c'), 'a\\.b\\*c');
    assert.equal(escapeRegExp('[test]'), '\\[test\\]');
    assert.equal(escapeRegExp('(a|b)'), '\\(a\\|b\\)');
  });
});

describe('expandShortNames', () => {
  it('expands ma, sto, sta', () => {
    assert.equal(expandShortNames('ma dela cruz'), 'maria dela cruz');
    assert.equal(expandShortNames('sto nino'), 'santo nino');
    assert.equal(expandShortNames('sta cruz'), 'santa cruz');
    assert.equal(expandShortNames('maria'), 'maria');
    assert.equal(expandShortNames('mama'), 'mama');
  });
});

describe('dateCandidates', () => {
  it('returns 12 variants for valid ymd', () => {
    const cands = dateCandidates('2024-03-05');
    assert.equal(cands.length, 12);
    const lower = cands.map((c) => c.toLowerCase());
    assert.ok(lower.includes('2024-03-05'));
    assert.ok(lower.includes('2024/03/05'));
    assert.ok(lower.includes('05/03/2024'));
    assert.ok(lower.includes('03/05/2024'));
    assert.ok(lower.includes('5 march 2024'));
    assert.ok(lower.includes('05 march 2024'));
    assert.ok(lower.includes('march 5 2024'));
    assert.ok(lower.includes('march 05 2024'));
    assert.ok(lower.includes('5 mar 2024'));
    assert.ok(lower.includes('mar 5 2024'));
    assert.ok(lower.includes('5-march-2024'));
    assert.ok(lower.includes('2024 march 5'));
  });

  it('fallback for invalid date', () => {
    assert.deepEqual(dateCandidates('not-a-date'), ['not-a-date']);
    assert.deepEqual(dateCandidates(''), ['']);
    assert.deepEqual(dateCandidates(null), ['']);
  });

  it('pads and month names correctly for 2021-01-09', () => {
    const cands = dateCandidates('2021-01-09');
    assert.ok(cands.includes('2021-01-09'));
    assert.ok(cands.includes('2021/01/09'));
    assert.ok(cands.includes('9 january 2021'));
    assert.ok(cands.includes('09 january 2021'));
    assert.ok(cands.includes('january 9 2021'));
    assert.ok(cands.includes('jan 9 2021'));
  });
});

describe('ocrFoundInText per-type', () => {
  it('empty hay or expected -> false', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'text' }, ocrText: '', expected: 'hello' }), false);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'text' }, ocrText: 'hello', expected: '' }), false);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'text' }, ocrText: '   ', expected: 'hello' }), false);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'text' }, ocrText: null, expected: 'hello' }), false);
  });

  it('text: case and space tolerant substring', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'text' }, ocrText: '  Hello   World  ', expected: 'hello world' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'text' }, ocrText: 'no match here', expected: 'hello' }), false);
    assert.equal(ocrFieldCorrect({ type: 'text' }, 'Hello World', 'hello'), true);
  });

  it('name: Ma.=Maria, Sto.=Santo, Sta.=Santa', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Ma. Santos', expected: 'Maria Santos' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Maria Santos', expected: 'Ma. Santos' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Sto. Nino de Manila', expected: 'Santo Nino' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Sta. Cruz', expected: 'Santa Cruz' }), true);
  });

  it('name: de la -> dela and comma reorder, accent tolerant', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'de la Cruz Maria', expected: 'Dela Cruz Maria' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Dela Cruz, Maria', expected: 'Maria Dela Cruz' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Jose', expected: 'José' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'José Rizal', expected: 'Jose Rizal' }), true);
  });

  it('name: suffix Jr. present as substring', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Juan Dela Cruz Jr.', expected: 'Juan Dela Cruz' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Juan Dela Cruz Jr.', expected: 'Juan Dela Cruz Jr.' }), true);
  });

  it('name: negative', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: 'Juan Santos', expected: 'Pedro Santos' }), false);
  });

  it('date: all 12 candidates found', () => {
    const expected = '2024-03-05';
    const cands = dateCandidates(expected);
    for (const cand of cands) {
      const hay = `Date: ${cand} extra text`;
      assert.equal(ocrFoundInText({ fieldDef: { type: 'date' }, ocrText: hay, expected }), true, `should find ${cand}`);
    }
    assert.equal(ocrFoundInText({ fieldDef: { type: 'date' }, ocrText: 'born on 2024/03/05 here', expected }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'date' }, ocrText: 'born on 05/03/2024 here', expected }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'date' }, ocrText: 'born on 5 March 2024 here', expected }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'date' }, ocrText: 'on Mar 5 2024 we celebrate', expected }), true);
  });

  it('date: negative not found', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'date' }, ocrText: 'Date: 2023-12-31', expected: '2024-03-05' }), false);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'date' }, ocrText: 'no date here', expected: '2024-03-05' }), false);
  });

  it('number: normalizeAmount with peso, PHP, commas, tokens', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: 'Total: 1,210.00', expected: '₱1,210.00' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: 'Amount is 2500 pesos', expected: 'PHP 2,500' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: 'price 1210', expected: 1210 }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: 'asdf 1,200.00 xyz 999', expected: '1200' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: '100.01', expected: '100.00' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: '100.02', expected: '100.00' }), false);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: '100.005', expected: '100.00' }), true);
  });

  it('number: negative and empty', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: 'no numbers here', expected: '100' }), false);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: '', expected: '100' }), false);
  });

  it('choice: word-boundary Male not inside Female', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'choice' }, ocrText: 'Gender: Male', expected: 'Male' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'choice' }, ocrText: 'Gender: Female', expected: 'Male' }), false);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'choice' }, ocrText: 'Gender: Female', expected: 'Female' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'choice' }, ocrText: 'female', expected: 'Female' }), true);
  });

  it('code: flat space/hyphen/underscore insensitive', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'code' }, ocrText: 'Code: A B-123', expected: 'AB123' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'code' }, ocrText: 'AB123', expected: 'A B-123' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'code' }, ocrText: 'A_B-123', expected: 'AB123' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'code' }, ocrText: 'AB 124', expected: 'AB123' }), false);
  });

  it('code: plain indexOf fallback', () => {
    assert.equal(ocrFoundInText({ fieldDef: { type: 'code' }, ocrText: 'AB123 is here', expected: 'AB123' }), true);
  });

  it('default text type handles null fieldDef', () => {
    assert.equal(ocrFoundInText({ fieldDef: null, ocrText: 'hello world', expected: 'hello' }), true);
    assert.equal(ocrFoundInText({ fieldDef: {}, ocrText: 'hello', expected: 'hello' }), true);
  });

  it('never throws on bad input', () => {
    assert.doesNotThrow(() => ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: null, expected: null }));
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name' }, ocrText: null, expected: null }), false);
    assert.doesNotThrow(() => ocrFoundInText({ fieldDef: { type: 'choice' }, ocrText: 'test [', expected: '[' }));
  });
});

describe('cross-check synthetic OCR snippets', () => {
  it('synthetic noisy block', () => {
    const hay = `
      Republic of the Philippines
      Name: Maria Santos Dela Cruz
      Date of Birth: 5 March 2024
      Amount: PHP 1,210.00
      Code: A B-123
      Gender: Female
    `;
    assert.equal(ocrFoundInText({ fieldDef: { type: 'name', key: 'full_name' }, ocrText: hay, expected: 'Ma. Santos Dela Cruz' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'date' }, ocrText: hay, expected: '2024-03-05' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'number' }, ocrText: hay, expected: '1210.00' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'code' }, ocrText: hay, expected: 'AB123' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'choice' }, ocrText: hay, expected: 'Female' }), true);
    assert.equal(ocrFoundInText({ fieldDef: { type: 'choice' }, ocrText: hay, expected: 'Male' }), false);
  });

  it('ocr compare matches eval inline logic for sample values', () => {
    const { normalizeAmount } = require('../lib/normalize-amount');
    assert.equal(normalizeAmount('₱1,210.00'), 1210);
    assert.equal(normalizeAmount('PHP 1,210'), 1210);
    assert.equal(normalizeAmount('1,210.00'), 1210);
  });
});
