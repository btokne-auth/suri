// tests/reading-timeout.test.js
//
// Robustness fix: a document stuck in "reading" for more than 2 minutes
// is treated as "error" with a friendly message, and re-upload is allowed.
// Pure helper test (no database, no API cost). Node's built-in runner only.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { READING_TIMEOUT_MS, READING_TIMEOUT_MESSAGE, isStaleReading } = require('../lib/reading-timeout');

describe('reading timeout (stuck "reading" fix)', () => {
  it('timeout is 2 minutes', () => {
    assert.equal(READING_TIMEOUT_MS, 2 * 60 * 1000);
  });

  it('friendly message is exact', () => {
    assert.equal(READING_TIMEOUT_MESSAGE, 'Reading took too long. Please upload again.');
  });

  it('reading older than 2 minutes is stale', () => {
    const now = Date.now();
    const old = new Date(now - 3 * 60 * 1000).toISOString();
    assert.equal(isStaleReading('reading', old, now), true);
  });

  it('uploaded older than 2 minutes is stale', () => {
    const now = Date.now();
    const old = new Date(now - 5 * 60 * 1000).toISOString();
    assert.equal(isStaleReading('uploaded', old, now), true);
  });

  it('fresh reading (under 2 minutes) is not stale', () => {
    const now = Date.now();
    const fresh = new Date(now - 30 * 1000).toISOString();
    assert.equal(isStaleReading('reading', fresh, now), false);
    assert.equal(isStaleReading('uploaded', fresh, now), false);
  });

  it('finished statuses are never stale', () => {
    const now = Date.now();
    const old = new Date(now - 60 * 60 * 1000).toISOString();
    for (const s of ['needs_review', 'retake_needed', 'error', 'approved', 'rejected', 'missing']) {
      assert.equal(isStaleReading(s, old, now), false);
    }
  });

  it('missing or bad date is never stale', () => {
    const now = Date.now();
    assert.equal(isStaleReading('reading', null, now), false);
    assert.equal(isStaleReading('reading', '', now), false);
    assert.equal(isStaleReading('reading', 'not-a-date', now), false);
  });
});
