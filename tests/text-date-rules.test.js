// tests/text-date-rules.test.js
// Step 7c Part 1: contains + dates + requirement gate. Pure, pinned today.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { containsValue, equalsValue } = require('../lib/checks/text');
const { isWithinMonths, isNotFuture } = require('../lib/checks/dates');
const { compareContains, compareWithinMonths, compareNotFuture, checkRequirement } = require('../lib/checks/run-checks');
const NOW = Date.UTC(2026, 9, 29);
describe('text rules', () => {
  it('contains is case-insensitive', () => { assert.equal(containsValue('123 Barangay Baybayin St', 'baybayin'), true); });
  it('extra spaces ignored', () => { assert.equal(containsValue('  Baybayin   Main  ', ' baybayin  main '), true); });
  it('empty needle never matches', () => { assert.equal(containsValue('Baybayin', ''), false); assert.equal(containsValue('Baybayin', '   '), false); });
  it('equals ignores case/spaces', () => { assert.equal(equalsValue(' Linawan ', 'linawan'), true); assert.equal(equalsValue('Linawan', 'Cebu'), false); });
  it('compareContains mismatch uses office message', () => { const r = compareContains('billing_address', 'Cebu City', 'Baybayin', 'Must be Baybayin.'); assert.equal(r.result, 'mismatch'); assert.equal(r.reason, 'Must be Baybayin.'); });
  it('requirement contains gate', () => { const proc = { requirement: { document: 'valid_id', field: 'address_line', op: 'contains', value: 'Baybayin', message: 'Baybayin only.' } }; assert.equal(checkRequirement('Purok 1, Barangay Baybayin', proc).outcome, 'pass'); assert.equal(checkRequirement('Cebu City', proc).outcome, 'fail'); assert.equal(checkRequirement('', proc).outcome, 'retake'); });
});
describe('date rules', () => {
  it('not_future: today passes, tomorrow fails', () => { assert.equal(isNotFuture('2026-10-29', NOW), true); assert.equal(isNotFuture('2026-10-30', NOW), false); assert.equal(compareNotFuture('billing_date', '2026-10-30', { nowMs: NOW }).result, 'mismatch'); });
  it('within_months: cutoff passes, day before fails', () => { assert.equal(isWithinMonths('2026-07-29', 3, NOW), true); assert.equal(isWithinMonths('2026-07-28', 3, NOW), false); });
  it('within_months: future fails, invalid skips', () => { assert.equal(isWithinMonths('2026-10-30', 3, NOW), false); assert.equal(isWithinMonths('2026-02-30', 3, NOW), null); assert.equal(compareWithinMonths('billing_date', '2026-02-30', { months: 3, nowMs: NOW }), null); });
  it('recent bill matches', () => { const r = compareWithinMonths('billing_date', '2026-09-15', { months: 3, nowMs: NOW }); assert.equal(r.result, 'match'); });
});
