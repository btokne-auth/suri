// tests/age-check.test.js
// Step 7e: age limit check — Manila time, Feb 29, missing/future, min/max/both.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { todayInManila, computeAgeYears, compareAge } = require('../lib/checks/dates');

describe('todayInManila', () => {
  it('Oct 28 16:00 UTC is Oct 29 in Manila', () => {
    const nowMs = Date.UTC(2026, 9, 28, 16);
    assert.equal(todayInManila(nowMs), Date.UTC(2026, 9, 29));
  });
  it('UTC midnight same Manila date when offset keeps same day', () => {
    const nowMs = Date.UTC(2026, 9, 29, 0);
    assert.equal(todayInManila(nowMs), Date.UTC(2026, 9, 29));
  });
  it('late UTC still same Manila next day', () => {
    const nowMs = Date.UTC(2026, 9, 29, 20);
    assert.equal(todayInManila(nowMs), Date.UTC(2026, 9, 30));
  });
});

describe('computeAgeYears', () => {
  const nowManilaOct29 = Date.UTC(2026, 9, 29);
  it('exactly 18 on birthday', () => {
    assert.equal(computeAgeYears('2008-10-29', nowManilaOct29), 18);
  });
  it('one day before birthday is 17', () => {
    assert.equal(computeAgeYears('2008-10-30', nowManilaOct29), 17);
  });
  it('one day after birthday is still 18', () => {
    assert.equal(computeAgeYears('2008-10-28', nowManilaOct29), 18);
  });
  it('Feb 29 birthday counts on Mar 1 in non-leap year', () => {
    const feb28_2025 = Date.UTC(2025, 1, 28);
    const mar01_2025 = Date.UTC(2025, 2, 1);
    assert.equal(computeAgeYears('2004-02-29', feb28_2025), 20);
    assert.equal(computeAgeYears('2004-02-29', mar01_2025), 21);
  });
  it('Feb 29 birthday in leap year on Feb 29', () => {
    const feb29_2024 = Date.UTC(2024, 1, 29, 2);
    assert.equal(computeAgeYears('2004-02-29', feb29_2024), 20);
    const feb28_2024 = Date.UTC(2024, 1, 28, 2);
    assert.equal(computeAgeYears('2004-02-29', feb28_2024), 19);
  });
  it('Manila vs UTC edge: Oct 29 birthday with UTC Oct 28 16:00 is 18 in Manila', () => {
    const manilaEdge = Date.UTC(2026, 9, 28, 16);
    assert.equal(computeAgeYears('2008-10-29', manilaEdge), 18);
    const utcOct28 = Date.UTC(2026, 9, 28, 10);
    assert.equal(computeAgeYears('2008-10-29', utcOct28), 17);
  });
  it('invalid date returns null', () => {
    assert.equal(computeAgeYears('not-a-date', nowManilaOct29), null);
    assert.equal(computeAgeYears('2025-02-30', nowManilaOct29), null);
  });
});

describe('compareAge min/max/both', () => {
  const now = Date.UTC(2026, 9, 29);
  it('exactly 18 on birthday — match at least 18', () => {
    const r = compareAge('2008-10-29', { min_age: 18, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'match');
    assert.equal(r.reason, 'Age is 18 — at least 18.');
  });
  it('one day before 18 — mismatch', () => {
    const r = compareAge('2008-10-30', { min_age: 18, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'mismatch');
    assert.equal(r.reason, 'Age is 17 — must be at least 18.');
  });
  it('min only: older than min is match', () => {
    const r = compareAge('2007-10-29', { min_age: 18, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'match');
    assert.equal(r.reason, 'Age is 19 — at least 18.');
  });
  it('max only: 30 at most 65 is match', () => {
    const r = compareAge('1996-10-29', { max_age: 65, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'match');
    assert.equal(r.reason, 'Age is 30 — at most 65.');
  });
  it('max only: 70 at most 65 is mismatch', () => {
    const r = compareAge('1956-10-29', { max_age: 65, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'mismatch');
    assert.equal(r.reason, 'Age is 70 — must be at most 65.');
  });
  it('both bounds: 30 between 18 and 65 is match', () => {
    const r = compareAge('1996-10-29', { min_age: 18, max_age: 65, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'match');
    assert.equal(r.reason, 'Age is 30 — between 18 and 65.');
  });
  it('both bounds: 16 between 18 and 65 is mismatch', () => {
    const r = compareAge('2010-10-29', { min_age: 18, max_age: 65, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'mismatch');
    assert.equal(r.reason, 'Age is 16 — must be between 18 and 65.');
  });
  it('both bounds: 70 between 18 and 65 is mismatch', () => {
    const r = compareAge('1956-10-29', { min_age: 18, max_age: 65, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'mismatch');
    assert.equal(r.reason, 'Age is 70 — must be between 18 and 65.');
  });
});

describe('compareAge missing/future/Manila', () => {
  const now = Date.UTC(2026, 9, 29);
  it('missing date returns check with label', () => {
    const r = compareAge('', { min_age: 18, label: 'Birth Date', nowMs: now });
    assert.equal(r.result, 'check');
    assert.equal(r.reason, "Birth Date can't be checked — birth date is missing or unreadable, please confirm.");
  });
  it('null date returns check', () => {
    const r = compareAge(null, { min_age: 18, label: 'Birth Date', nowMs: now });
    assert.equal(r.result, 'check');
  });
  it('unreadable date returns check', () => {
    const r = compareAge('invalid', { min_age: 18, label: 'Birth Date', nowMs: now });
    assert.equal(r.result, 'check');
    assert.equal(r.reason, "Birth Date can't be checked — birth date is missing or unreadable, please confirm.");
  });
  it('future date returns check', () => {
    const r = compareAge('2027-01-01', { min_age: 18, label: 'Birth Date', nowMs: now });
    assert.equal(r.result, 'check');
    assert.equal(r.reason, 'Birth date is in the future, please confirm.');
  });
  it('Feb 29 case: before birthday in non-leap', () => {
    const feb28 = Date.UTC(2025, 1, 28);
    const r1 = compareAge('2004-02-29', { min_age: 21, label: 'Birth date', nowMs: feb28 });
    assert.equal(r1.result, 'mismatch');
    assert.match(r1.reason, /Age is 20/);
    const mar01 = Date.UTC(2025, 2, 1);
    const r2 = compareAge('2004-02-29', { min_age: 21, label: 'Birth date', nowMs: mar01 });
    assert.equal(r2.result, 'match');
    assert.match(r2.reason, /Age is 21/);
  });
  it('Manila vs UTC edge: age uses Manila date', () => {
    const manilaEdge = Date.UTC(2026, 9, 28, 16);
    const r = compareAge('2008-10-29', { min_age: 18, label: 'Birth date', nowMs: manilaEdge });
    assert.equal(r.result, 'match');
    assert.equal(r.reason, 'Age is 18 — at least 18.');
  });
  it('future via next day birth', () => {
    const r = compareAge('2026-10-30', { min_age: 18, label: 'Birth date', nowMs: now });
    assert.equal(r.result, 'check');
    assert.equal(r.reason, 'Birth date is in the future, please confirm.');
  });
  it('mismatch with custom message appends after age', () => {
    const r = compareAge('2007-10-29', { min_age: 21, label: 'Birth date', nowMs: now, message: 'Applicant must be at least 21 years old.' });
    assert.equal(r.result, 'mismatch');
    assert.equal(r.reason, 'Age is 19 — must be at least 21. Applicant must be at least 21 years old.');
  });
  it('max mismatch with custom message appends', () => {
    const r = compareAge('1956-10-29', { max_age: 65, label: 'Birth date', nowMs: now, message: 'Applicant must be at most 65 years old.' });
    assert.equal(r.result, 'mismatch');
    assert.equal(r.reason, 'Age is 70 — must be at most 65. Applicant must be at most 65 years old.');
  });
  it('between mismatch with custom message appends', () => {
    const r = compareAge('2010-10-29', { min_age: 18, max_age: 65, label: 'Birth date', nowMs: now, message: 'Age must be between 18 and 65.' });
    assert.equal(r.result, 'mismatch');
    assert.equal(r.reason, 'Age is 16 — must be between 18 and 65. Age must be between 18 and 65.');
  });
  it('match does not append custom message', () => {
    const r = compareAge('2008-10-29', { min_age: 18, label: 'Birth date', nowMs: now, message: 'Applicant must be at least 18 years old.' });
    assert.equal(r.result, 'match');
    assert.equal(r.reason, 'Age is 18 — at least 18.');
  });
});

