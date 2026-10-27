// tests/names.test.js
//
// Build order step 6: Filipino name rule cases.
// Node's built-in test runner only (node --test). No other test library.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { compareFilipinoNames } = require('../lib/checks/names');

describe('filipino_name rule', () => {
  it('Ma. vs Maria = check', () => {
    const r = compareFilipinoNames('Ma. Teresa Santos', 'Maria Teresa Santos');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /Ma\./);
  });

  it('De La Cruz vs dela Cruz = match', () => {
    const r = compareFilipinoNames('Maria Santos De La Cruz', 'Maria Santos dela Cruz');
    assert.equal(r.result, 'match');
  });

  it('Dela Cruz vs Delacruz spacing = match', () => {
    const r = compareFilipinoNames('Maria Santos Dela Cruz', 'Maria Santos Delacruz');
    assert.equal(r.result, 'match');
  });

  it('case/space-insensitive = match', () => {
    const r = compareFilipinoNames('  MARIA  santos  dela cruz ', 'maria Santos Dela Cruz');
    assert.equal(r.result, 'match');
  });

  it('accent-only difference = check', () => {
    const r = compareFilipinoNames('Mar\u00eda Pe\u00f1a', 'Maria Pena');
    assert.equal(r.result, 'check');
    assert.match(r.reason, /accent/i);
  });

  it('comma format matches plain order', () => {
    const r = compareFilipinoNames('Dela Cruz, Maria Santos', 'Maria Santos Dela Cruz');
    assert.equal(r.result, 'match');
  });

  it('word-by-word difference names the word', () => {
    const r = compareFilipinoNames('Maria Santos Dela Cruz', 'Marta Santos Dela Cruz');
    assert.equal(r.result, 'mismatch');
    assert.match(r.reason, /word 1/);
  });

  it('Sto. vs Santo = check', () => {
    const r = compareFilipinoNames('Sto. Ni\u00f1o Ramos', 'Santo Ni\u00f1o Ramos');
    assert.equal(r.result, 'check');
  });

  it('Sta. vs Santa = check', () => {
    const r = compareFilipinoNames('Sta. Maria Ramos', 'Santa Maria Ramos');
    assert.equal(r.result, 'check');
  });

  it('Jr. present on one side only = check', () => {
    const r = compareFilipinoNames('Jose Cruz Jr.', 'Jose Cruz');
    assert.equal(r.result, 'check');
  });

  it('Jr. vs Sr. = mismatch', () => {
    const r = compareFilipinoNames('Jose Cruz Jr.', 'Jose Cruz Sr.');
    assert.equal(r.result, 'mismatch');
  });

  it('different surname = mismatch', () => {
    const r = compareFilipinoNames('Maria Santos Dela Cruz', 'Maria Santos Reyes');
    assert.equal(r.result, 'mismatch');
    assert.match(r.reason, /Surname/);
  });

  it('different person = mismatch with plain reason', () => {
    const r = compareFilipinoNames('Maria Santos', 'Jose Reyes');
    assert.equal(r.result, 'mismatch');
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
  });
});
