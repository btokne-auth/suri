// tests/names-fix.test.js — Step 10: short forms expanded first, small
// spelling differences and missing middle words ask instead of failing.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { compareFilipinoNames, isSmallSpellingDiff } = require('../lib/checks/names.js');

describe('name check: ask instead of guessing', () => {
  it('Ma. plus a one-letter typo asks and names both differences', () => {
    const r = compareFilipinoNames('Ma. Theresa Santos Reyes', 'Maria Theressa Santos Reyes');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /Ma\. is short for Maria/);
    assert.match(r.reason, /"Theresa" vs "Theressa"/);
  });
  it('Ma. alone still asks with the same message as before', () => {
    const r = compareFilipinoNames('Ma. Theresa Santos Reyes', 'Maria Theresa Santos Reyes');
    assert.deepEqual(r, { result: 'check', reason: 'Ma. is short for Maria, please confirm.' });
  });
  it('missing middle name asks', () => {
    const r = compareFilipinoNames('Ma. Theresa Santos Reyes', 'Maria Theresa Reyes');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /extra words "Santos"/);
  });
  it('one-letter surname typo asks', () => {
    const r = compareFilipinoNames('Theresa Reyes', 'Theresa Reys');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /Surname spelled differently: Reyes vs Reys/);
  });
  it('different person stays a mismatch', () => {
    const r = compareFilipinoNames('Ma. Theresa Santos Reyes', 'Bianca Mendoza Ramirez');
    assert.equal(r.result, 'mismatch');
    assert.match(r.reason, /Surname is different: Reyes vs Ramirez/);
  });
  it('different first name stays a mismatch', () => {
    assert.equal(compareFilipinoNames('Juan Santos Reyes', 'Pedro Santos Reyes').result, 'mismatch');
    assert.equal(compareFilipinoNames('Juan Cruz', 'Pedro Santos Cruz').reason, 'Name word 1 is different: Juan vs Pedro.');
  });
  it('a changed letter is a different name, not a typo', () => {
    assert.equal(compareFilipinoNames('Maria Santos Dela Cruz', 'Marta Santos Dela Cruz').result, 'mismatch');
  });
  it('extra word at the end asks', () => {
    const r = compareFilipinoNames('Maria Dela Cruz', 'Maria Dela Cruz Santos');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /extra words/);
  });
  it('short words must match exactly (no typo allowance under 4 letters)', () => {
    assert.equal(compareFilipinoNames('Ana Reyes', 'Ann Reyes').result, 'mismatch');
  });
  it('existing matches are unchanged', () => {
    assert.equal(compareFilipinoNames('Dela Cruz, Maria', 'Maria Dela Cruz').result, 'match');
    assert.equal(compareFilipinoNames('Juan Dela Cruz Jr.', 'Juan Dela Cruz').result, 'check');
    assert.equal(compareFilipinoNames('Sto. Nino Reyes', 'Santo Nino Reyes').result, 'check');
  });
  it('isSmallSpellingDiff', () => {
    assert.equal(isSmallSpellingDiff('theresa', 'theressa'), true);
    assert.equal(isSmallSpellingDiff('reyes', 'reys'), true);
    assert.equal(isSmallSpellingDiff('reyes', 'ryees'), true);
    assert.equal(isSmallSpellingDiff('reyes', 'ramirez'), false);
    assert.equal(isSmallSpellingDiff('reyes', 'royas'), false);
    assert.equal(isSmallSpellingDiff('maria', 'marta'), false);
    assert.equal(isSmallSpellingDiff('maria', 'mario'), false);
    assert.equal(isSmallSpellingDiff('ana', 'ann'), false);
  });
});
