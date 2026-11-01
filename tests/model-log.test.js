// tests/model-log.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { logModelCall, callNote } = require('../lib/model-log.js');

describe('model-log', () => {
  it('logs provider, model, task, time and result', () => {
    const line = logModelCall({ provider: 'meta', model: 'muse-spark-1.3', task: 'read valid_id', ms: 5812, ok: true });
    assert.equal(line, '[suri] meta · muse-spark-1.3 · read valid_id · 5.8s · ok');
  });
  it('logs errors with status', () => {
    const line = logModelCall({ provider: 'meta', model: 'muse-spark-1.3', task: 'read valid_id', ms: 900, ok: false, status: 429 });
    assert.equal(line, '[suri] meta · muse-spark-1.3 · read valid_id · 0.9s · error 429');
  });
  it('callNote formats the work-log suffix', () => {
    assert.equal(callNote({ model: 'muse-spark-1.3', ms: 5812 }), ' | model=muse-spark-1.3 | 5.8s');
    assert.equal(callNote(null), '');
    assert.equal(callNote({ model: 'x' }), '');
  });
});
